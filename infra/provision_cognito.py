"""Add role groups and fictional test users to the V5 Cognito User Pool.

The user pool and app client are owned by CloudFormation
(infra/new-account/cognito.yaml); this script only fills in the role groups and
one fictional test account per role, idempotently. Use a CLI profile limited to
Cognito (for example an IAM user with AmazonCognitoPowerUser), never root keys.
Passwords of new test accounts go to a private file outside the repo and are
never printed.
"""
import argparse
import os
import secrets
import string
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

POOL_NAME = 'cstu-v5-auth'
CLIENT_NAME = 'cstu-backend'
ROLES = ('public', 'student', 'coordinator', 'staff', 'admin')


def password_file(pool_id):
    """Keep test passwords per pool so an old pool cannot shadow a new one."""
    return Path.home() / '.config' / 'cstu' / f'cognito-test-users-{pool_id}.txt'


def new_password():
    alphabet = string.ascii_letters + string.digits
    chars = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
             secrets.choice(string.digits)] + [secrets.choice(alphabet) for _ in range(17)]
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def fail(message):
    print(f'ERROR: {message}', file=sys.stderr)
    sys.exit(1)


def find_pool(idp, pool_name):
    for page in idp.get_paginator('list_user_pools').paginate(MaxResults=60):
        for pool in page['UserPools']:
            if pool['Name'] == pool_name:
                return pool['Id']
    return None


def resolve_pool(idp, pool_id, pool_name):
    if pool_id:
        try:
            idp.describe_user_pool(UserPoolId=pool_id)
        except ClientError as error:
            if error.response['Error']['Code'] != 'ResourceNotFoundException':
                raise
            fail(f'User Pool {pool_id} was not found in this account/region.')
        return pool_id
    found = find_pool(idp, pool_name)
    if found is None:
        fail(f"User Pool '{pool_name}' was not found in this account/region. "
             'Deploy infra/new-account/cognito.yaml first (CloudFormation stack '
             'cs361-cognito), then re-run this script; it never creates the pool.')
    return found


def resolve_client(idp, pool_id, client_name):
    for page in idp.get_paginator('list_user_pool_clients').paginate(
            UserPoolId=pool_id, MaxResults=60):
        for client in page['UserPoolClients']:
            if client['ClientName'] == client_name:
                return client['ClientId']
    fail(f"App client '{client_name}' was not found in User Pool {pool_id}. "
         'Deploy or update infra/new-account/cognito.yaml (CloudFormation stack '
         'cs361-cognito) so it creates the client, then re-run this script.')


def list_groups(idp, pool_id):
    groups = set()
    for page in idp.get_paginator('list_groups').paginate(UserPoolId=pool_id):
        groups.update(group['GroupName'] for group in page['Groups'])
    return groups


def ensure_membership(idp, pool_id, email, role):
    groups = idp.admin_list_groups_for_user(UserPoolId=pool_id, Username=email)['Groups']
    if role not in {group['GroupName'] for group in groups}:
        idp.admin_add_user_to_group(UserPoolId=pool_id, Username=email, GroupName=role)
        print(f'User {email}: added to group {role}')


def save_password(pool_id, role, email, password):
    path = password_file(pool_id)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    new_file = not path.exists()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'a') as handle:
        if new_file:
            handle.write(f'# CSTU V5 Cognito test accounts (fictional, demo only) - pool {pool_id}\n')
        handle.write(f'{role}\t{email}\t{password}\n')


def ensure(idp, pool_id, client_id, apply_changes):
    print('User pool:', pool_id)
    print('App client:', client_id)
    existing_groups = list_groups(idp, pool_id)
    for role in ROLES:
        if role in existing_groups:
            print(f'Group {role}: exists')
        elif apply_changes:
            idp.create_group(UserPoolId=pool_id, GroupName=role,
                             Description=f'CSTU V5 role: {role}')
            print(f'Group {role}: created')
        else:
            print(f'Group {role}: missing (would create)')
    for role in ROLES:
        email = f'{role}@example.test'
        try:
            idp.admin_get_user(UserPoolId=pool_id, Username=email)
            print(f'User {email}: exists')
            if apply_changes:
                ensure_membership(idp, pool_id, email, role)
            continue
        except ClientError as error:
            if error.response['Error']['Code'] != 'UserNotFoundException':
                raise
        if not apply_changes:
            print(f'User {email}: missing (would create)')
            continue
        password = new_password()
        idp.admin_create_user(UserPoolId=pool_id, Username=email, MessageAction='SUPPRESS',
                              UserAttributes=[{'Name': 'email', 'Value': email},
                                              {'Name': 'email_verified', 'Value': 'true'}])
        idp.admin_set_user_password(UserPoolId=pool_id, Username=email, Password=password,
                                    Permanent=True)
        ensure_membership(idp, pool_id, email, role)
        save_password(pool_id, role, email, password)
        print(f'User {email}: created (password saved to {password_file(pool_id)})')
    if not apply_changes:
        print('Plan only; re-run with --apply to create missing groups and test users.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Cognito-only AWS CLI profile, e.g. cstu')
    parser.add_argument('--region', default='ap-southeast-2')
    parser.add_argument('--pool-id', help='Use this exact User Pool ID instead of searching by name')
    parser.add_argument('--pool-name', default=POOL_NAME,
                        help=f'User Pool name to find (default {POOL_NAME})')
    parser.add_argument('--client-name', default=CLIENT_NAME,
                        help=f'App client name to find (default {CLIENT_NAME})')
    parser.add_argument('--apply', action='store_true',
                        help='Create missing groups and test users')
    args = parser.parse_args()
    idp = boto3.Session(profile_name=args.profile, region_name=args.region).client('cognito-idp')
    try:
        pool_id = resolve_pool(idp, args.pool_id, args.pool_name)
        client_id = resolve_client(idp, pool_id, args.client_name)
        ensure(idp, pool_id, client_id, args.apply)
    except ClientError as error:
        print('AWS operation blocked:', error.operation_name, error.response['Error']['Code'],
              file=sys.stderr)
        sys.exit(1)
    print(f'COGNITO_USER_POOL_ID={pool_id}\nCOGNITO_APP_CLIENT_ID={client_id}')


if __name__ == '__main__':
    main()
