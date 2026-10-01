"""Plan/create one isolated PostgreSQL RDS instance for the fictional demo.

Use a CLI profile authorized for RDS and VPC operations. This does not use the
S3-only keys in .env, and never modifies the existing project RDS instance.
No database passwords are printed or passed on a command line.
"""
import argparse
import ipaddress
import json
import secrets
import string
import sys
import urllib.request
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values, set_key
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[1]
IDENTIFIER = 'cs361-cstu-demo'
GROUP = 'cs361-cstu-demo-rds'
TAGS = [{'Key': 'Project', 'Value': 'CS361'}, {'Key': 'DataKind', 'Value': 'fictional-demo'}]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Authorized AWS CLI profile; defaults to the normal credential chain')
    parser.add_argument('--region', default='ap-southeast-1')
    parser.add_argument('--apply', action='store_true', help='Create resources from the validated plan')
    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    config = Config(connect_timeout=5, read_timeout=15, retries={'max_attempts': 1})
    rds, ec2 = (session.client(service, config=config) for service in ('rds', 'ec2'))
    vpcs = ec2.describe_vpcs(Filters=[{'Name': 'is-default', 'Values': ['true']}])['Vpcs']
    if len(vpcs) != 1:
        raise RuntimeError('A single default VPC is required; review networking before creation')
    vpc = vpcs[0]['VpcId']
    groups = [g for g in rds.describe_db_subnet_groups()['DBSubnetGroups'] if g['VpcId'] == vpc]
    if not groups:
        raise RuntimeError('No DB subnet group in the default VPC; configure one before creation')
    subnet_group = next((g for g in groups if g['DBSubnetGroupName'] == 'default'), groups[0])
    public_ip = urllib.request.urlopen('https://checkip.amazonaws.com/', timeout=10).read().decode().strip()
    cidr = str(ipaddress.IPv4Address(public_ip)) + '/32'
    options = []
    for page in rds.get_paginator('describe_orderable_db_instance_options').paginate(Engine='postgres'):
        options.extend(option for option in page['OrderableDBInstanceOptions']
                       if option['DBInstanceClass'] in ['db.t4g.micro', 'db.t3.micro']
                       and option['EngineVersion'].startswith('16.')
                       and option['StorageType'] == 'gp3' and option.get('SupportsStorageEncryption'))
    if not options:
        raise RuntimeError('No supported PostgreSQL 16 micro/gp3 option; refuse a larger automatic upgrade')
    options.sort(key=lambda o: (o['DBInstanceClass'] == 'db.t4g.micro',
                               tuple(int(part) for part in o['EngineVersion'].split('.'))), reverse=True)
    option = options[0]
    plan = {'identifier': IDENTIFIER, 'database': 'cstu_demo', 'region': args.region,
            'class': option['DBInstanceClass'], 'engine': 'postgres', 'engineVersion': option['EngineVersion'],
            'allocatedStorageGiB': 20, 'storageType': 'gp3', 'storageEncrypted': True,
            'multiAZ': False, 'backupRetentionDays': 1, 'deletionProtection': True,
            'publiclyAccessible': True, 'ingress': {'tcp': 5432, 'source': cidr},
            'vpc': vpc, 'subnetGroup': subnet_group['DBSubnetGroupName']}
    report_dir = ROOT / '.tmp-demo-rds'
    report_dir.mkdir(exist_ok=True)
    (report_dir / 'plan.json').write_text(json.dumps(plan, indent=2), encoding='utf-8')
    print(json.dumps(plan, indent=2))
    if not args.apply:
        return
    # Reuse only the resource created by this script; do not change existing RDS.
    try:
        instance = rds.describe_db_instances(DBInstanceIdentifier=IDENTIFIER)['DBInstances'][0]
        tags = {t['Key']: t['Value'] for t in rds.list_tags_for_resource(ResourceName=instance['DBInstanceArn'])['TagList']}
        if tags.get('DataKind') != 'fictional-demo':
            raise RuntimeError('Identifier already belongs to an unrecognized DB instance')
    except rds.exceptions.DBInstanceNotFoundFault:
        instance = None
    env_path = ROOT / '.env.demo-rds'
    saved = dotenv_values(env_path) if env_path.exists() else {}
    if instance and not saved.get('DEMO_RDS_MASTER_PASSWORD'):
        raise RuntimeError('Existing instance credentials are missing; do not rotate automatically')
    if not instance:
        existing_groups = ec2.describe_security_groups(Filters=[{'Name': 'group-name', 'Values': [GROUP]},
                                                                  {'Name': 'vpc-id', 'Values': [vpc]}])['SecurityGroups']
        if existing_groups:
            group = existing_groups[0]
            if {t['Key']: t['Value'] for t in group.get('Tags', [])}.get('DataKind') != 'fictional-demo':
                raise RuntimeError('Security group name belongs to an unrecognized resource')
            sg_id = group['GroupId']
        else:
            sg_id = ec2.create_security_group(GroupName=GROUP, Description='CS361 fictional demo PostgreSQL; single administrator IP',
                                             VpcId=vpc, TagSpecifications=[{'ResourceType': 'security-group', 'Tags': TAGS}])['GroupId']
        try:
            ec2.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=[{'IpProtocol': 'tcp', 'FromPort': 5432,
                'ToPort': 5432, 'IpRanges': [{'CidrIp': cidr, 'Description': 'Current demo administrator'}]}])
        except ClientError as error:
            if error.response['Error']['Code'] != 'InvalidPermission.Duplicate':
                raise
        password = saved.get('DEMO_RDS_MASTER_PASSWORD') or ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        env_path.touch(exist_ok=True)
        set_key(str(env_path), 'DEMO_RDS_MASTER_PASSWORD', password)
        instance = rds.create_db_instance(DBInstanceIdentifier=IDENTIFIER, DBName='cstu_demo', Engine='postgres',
            EngineVersion=option['EngineVersion'], DBInstanceClass=option['DBInstanceClass'], MasterUsername='demo_admin',
            MasterUserPassword=password, AllocatedStorage=20, StorageType='gp3', StorageEncrypted=True,
            DBSubnetGroupName=subnet_group['DBSubnetGroupName'], VpcSecurityGroupIds=[sg_id],
            PubliclyAccessible=True, MultiAZ=False, BackupRetentionPeriod=1, DeletionProtection=True,
            AutoMinorVersionUpgrade=True, EnablePerformanceInsights=False, MonitoringInterval=0, Tags=TAGS)['DBInstance']
    status = instance['DBInstanceStatus']
    print('RDS state:', status)
    if status != 'available':
        print('Creation is asynchronous. Re-run this command to inspect readiness; no duplicate instance is created.')
        return
    host = instance['Endpoint']['Address']
    password = dotenv_values(env_path)['DEMO_RDS_MASTER_PASSWORD']
    url = URL.create('postgresql+psycopg2', username='demo_admin', password=password,
                     host=host, port=5432, database='cstu_demo', query={'sslmode': 'require', 'connect_timeout': '10'})
    set_key(str(env_path), 'DEMO_RDS_DATABASE_URL', url.render_as_string(hide_password=False))
    print('RDS ready; TLS connection saved in ignored .env.demo-rds (password not printed)')
    (report_dir / 'result.json').write_text(json.dumps({'identifier': IDENTIFIER, 'status': status,
        'endpoint': host, 'port': 5432, 'database': 'cstu_demo', 'region': args.region}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    try:
        main()
    except ClientError as error:
        print('AWS operation blocked:', error.operation_name, error.response['Error']['Code'], file=sys.stderr)
        raise SystemExit(1)
