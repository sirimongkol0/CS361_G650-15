"""Plan/create the Cognito User Pool used for V3 login, idempotently.

Creates the pool, an app client without a secret, one group per role and one
fictional test account per role. Use a CLI profile limited to Cognito (for
example an IAM user with AmazonCognitoPowerUser), never root keys. Passwords
of new test accounts go to a private file outside the repo and are never printed.
"""
import argparse
import os
import secrets
import string
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

POOL_NAME = 'cstu-v3-auth'
CLIENT_NAME = 'cstu-backend'
ROLES = ('public', 'student', 'coordinator', 'staff', 'admin')
PASSWORD_FILE = Path.home() / '.config' / 'cstu' / 'cognito-test-users.txt'


def new_password():
    alphabet = string.ascii_letters + string.digits
    chars = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
             secrets.choice(string.digits)] + [secrets.choice(alphabet) for _ in range(17)]
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def find_pool(idp):
    for page in idp.get_paginator('list_user_pools').paginate(MaxResults=60):
        for pool in page['UserPools']:
            if pool['Name'] == POOL_NAME:
                return pool['Id']
    return None


def ensure(idp, apply):
    pool_id = find_pool(idp)
    print('User pool:', pool_id or f'{POOL_NAME} (to create)')
    if not apply:
        print('Plan only; re-run with --apply to create missing resources.')
        return
    if pool_id is None:
        pool_id = idp.create_user_pool(
            PoolName=POOL_NAME, UsernameAttributes=['email'], AutoVerifiedAttributes=['email'],
            Policies={'PasswordPolicy': {'MinimumLength': 8, 'RequireUppercase': True,
                                         'RequireLowercase': True, 'RequireNumbers': True,
                                         'RequireSymbols': False}},
            AdminCreateUserConfig={'AllowAdminCreateUserOnly': True}, MfaConfiguration='OFF',
            AccountRecoverySetting={'RecoveryMechanisms': [{'Priority': 1, 'Name': 'verified_email'}]},
            UserPoolTags={'Project': 'CS361_G650-15'},
        )['UserPool']['Id']
    clients = idp.list_user_pool_clients(UserPoolId=pool_id, MaxResults=60)['UserPoolClients']
    client_id = next((c['ClientId'] for c in clients if c['ClientName'] == CLIENT_NAME), None)
    if client_id is None:
        client_id = idp.create_user_pool_client(
            UserPoolId=pool_id, ClientName=CLIENT_NAME, GenerateSecret=False,
            ExplicitAuthFlows=['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
            AccessTokenValidity=60, IdTokenValidity=60, RefreshTokenValidity=30,
            TokenValidityUnits={'AccessToken': 'minutes', 'IdToken': 'minutes', 'RefreshToken': 'days'},
            PreventUserExistenceErrors='ENABLED', EnableTokenRevocation=True,
        )['UserPoolClient']['ClientId']
    existing_groups = {g['GroupName'] for g in idp.list_groups(UserPoolId=pool_id)['Groups']}
    PASSWORD_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    for role in ROLES:
        if role not in existing_groups:
            idp.create_group(UserPoolId=pool_id, GroupName=role, Description=f'CSTU V3 role: {role}')
        email = f'{role}@example.test'
        try:
            idp.admin_get_user(UserPoolId=pool_id, Username=email)
            print(f'User {email}: exists')
            continue
        except ClientError as error:
            if error.response['Error']['Code'] != 'UserNotFoundException':
                raise
        password = new_password()
        idp.admin_create_user(UserPoolId=pool_id, Username=email, MessageAction='SUPPRESS',
                              UserAttributes=[{'Name': 'email', 'Value': email},
                                              {'Name': 'email_verified', 'Value': 'true'}])
        idp.admin_set_user_password(UserPoolId=pool_id, Username=email, Password=password, Permanent=True)
        idp.admin_add_user_to_group(UserPoolId=pool_id, Username=email, GroupName=role)
        fd = os.open(PASSWORD_FILE, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, 'a') as handle:
            handle.write(f'{role}\t{email}\t{password}\n')
        print(f'User {email}: created (password saved to {PASSWORD_FILE})')
    print(f'COGNITO_USER_POOL_ID={pool_id}\nCOGNITO_APP_CLIENT_ID={client_id}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Cognito-only AWS CLI profile, e.g. cstu')
    parser.add_argument('--region', default='ap-southeast-1')
    parser.add_argument('--apply', action='store_true', help='Create missing resources')
    args = parser.parse_args()
    idp = boto3.Session(profile_name=args.profile, region_name=args.region).client('cognito-idp')
    try:
        ensure(idp, args.apply)
    except ClientError as error:
        print('AWS operation blocked:', error.operation_name, error.response['Error']['Code'], file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
