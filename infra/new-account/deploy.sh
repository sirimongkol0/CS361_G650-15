#!/usr/bin/env bash
# Deploy CS361 into a fresh AWS account, low-cost layout:
# Amplify (frontend) + one EC2 instance running the API and PostgreSQL in Docker
# + S3 (files and backups) + Cognito (login).
#
#   infra/new-account/deploy.sh <step> [--apply] [--yes]
#
# Steps, in order:
#   check      who am I, and does the account (or an SCP) allow each service
#   infra      CloudFormation stack: VPC, EC2, Elastic IP, S3, IAM (plan; --apply to create)
#   cognito    User Pool, app client, role groups, test users   (plan; --apply to create)
#   backend    upload backend/ and (re)start PostgreSQL + the API over SSM
#   seed       load fictional demo data into cstu_demo (DELETES its data; needs --yes)
#   amplify    print the values to enter in the Amplify Console
#   status     health check of the API
#   backup     pg_dump the database to s3://<bucket>/backups/ (kept 30 days)
#   teardown   delete the stack, INCLUDING the database (S3 bucket is kept; needs --yes)
#
# Without --apply, infra and cognito only show what would change. Nothing here
# prints a password; the database password is generated on the instance.
#
# Runs from a laptop (AWS_PROFILE, default cstu-new) or from AWS CloudShell
# (uses the console role; no profile needed). Other settings: AWS_REGION
# (default ap-southeast-2), STACK (default cs361), CORS_ORIGINS (the Amplify URL).
set -euo pipefail

if [[ -z "${AWS_PROFILE:-}" && "${AWS_EXECUTION_ENV:-}" != CloudShell ]]; then
  export AWS_PROFILE=cstu-new
fi
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_PAGER=""
STACK="${STACK:-cs361}"
POOL_NAME="cstu-v3-auth"      # must match infra/provision_cognito.py
CLIENT_NAME="cstu-backend"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEMPLATE="$ROOT/infra/new-account/stack.yaml"
STEP="${1:-}"; shift || true
APPLY=false; YES=false
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --yes) YES=true ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n== %s\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

cognito_ids() {
  POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 \
    --query "UserPools[?Name=='$POOL_NAME'].Id | [0]" --output text)
  [[ "$POOL_ID" != "None" && -n "$POOL_ID" ]] || die "User Pool $POOL_NAME not found; run the cognito step with --apply"
  CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
    --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId | [0]" --output text)
}

# Run a shell script on the backend instance via SSM and print its output.
run_remote() {
  local instance params command_id status
  instance=$(output InstanceId)
  params=$(python3 -c 'import json,sys; print(json.dumps({"commands": [sys.stdin.read()], "executionTimeout": ["1800"]}))' <<<"$1")
  command_id=$(aws ssm send-command --instance-ids "$instance" --document-name AWS-RunShellScript \
    --comment "$2" --parameters "$params" --query Command.CommandId --output text)
  echo "SSM command $command_id on $instance: $2"
  aws ssm wait command-executed --command-id "$command_id" --instance-id "$instance" || true
  status=$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
    --query Status --output text)
  aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
    --query '[StandardOutputContent,StandardErrorContent]' --output text | tail -40
  [[ "$status" == "Success" ]] || die "remote step ended with status $status"
}

step_check() {
  log "Identity"
  aws sts get-caller-identity --output table
  log "Service access in $AWS_REGION (an explicit SCP deny shows up here)"
  local ok=true
  probe() {
    local out
    if out=$(timeout 30 "$@" 2>&1 >/dev/null); then echo "  OK    ${*:2:2}"
    else ok=false; echo "  FAIL  ${*:2:2}: ${out:-timed out}" | head -c 300; echo; fi
  }
  probe aws cloudformation list-stacks --max-items 1
  probe aws ec2 describe-vpcs --max-items 1
  probe aws s3api list-buckets
  probe aws cognito-idp list-user-pools --max-results 1
  probe aws ssm describe-instance-information --max-items 1
  probe aws amplify list-apps --max-items 1
  probe aws iam list-roles --max-items 1
  $ok || die "some services are blocked; fix access before continuing"
}

step_infra() {
  aws cloudformation validate-template --template-body "file://$TEMPLATE" >/dev/null
  if ! $APPLY; then
    log "Plan for stack $STACK (no changes are made)"
    local change_set
    change_set=$(aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
      --capabilities CAPABILITY_IAM --no-execute-changeset 2>&1 | grep -o 'arn:aws:cloudformation:[^ ]*changeSet/[^ ]*' || true)
    if [[ -z "$change_set" ]]; then echo "No changes."; return; fi
    aws cloudformation wait change-set-create-complete --change-set-name "$change_set" 2>/dev/null || true
    aws cloudformation describe-change-set --change-set-name "$change_set" \
      --query 'Changes[].ResourceChange.[Action,ResourceType,LogicalResourceId,Replacement]' --output table
    echo "Review the changes above, then re-run: $0 infra --apply"
    return
  fi
  log "Creating/updating stack $STACK (about 3 minutes)"
  aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
    --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset
  aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].Outputs' --output table
}

step_cognito() {
  local args=(--region "$AWS_REGION"); $APPLY && args+=(--apply)
  [[ -n "${AWS_PROFILE:-}" ]] && args+=(--profile "$AWS_PROFILE")
  # boto3 comes from backend/requirements.txt; prefer the backend venv when it exists.
  local py=python3; [[ -x "$ROOT/backend/.venv/bin/python" ]] && py="$ROOT/backend/.venv/bin/python"
  log "Cognito User Pool"
  "$py" "$ROOT/infra/provision_cognito.py" "${args[@]}"
}

step_backend() {
  [[ -n "${CORS_ORIGINS:-}" ]] || echo "WARNING: CORS_ORIGINS is not set; the browser can only reach the API through the Amplify proxy."
  cognito_ids
  local bucket version key
  bucket=$(output BucketName)
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    version=$(git -C "$ROOT" rev-parse --short HEAD)
    [[ -z "$(git -C "$ROOT" status --porcelain backend)" ]] || echo "WARNING: backend/ has uncommitted changes; deploying HEAD ($version) only."
    key="deploy/backend-$version.tgz"
    log "Uploading backend $version to s3://$bucket/$key"
    git -C "$ROOT" archive --format=tar.gz HEAD backend | aws s3 cp - "s3://$bucket/$key"
  else
    # e.g. CloudShell with the uploaded zip: no git history, so tag by date.
    version=$(date -u +%Y%m%d%H%M%S)
    key="deploy/backend-$version.tgz"
    log "Uploading backend $version to s3://$bucket/$key"
    tar -C "$ROOT" -czf - --exclude=.venv --exclude=__pycache__ --exclude='*.db' backend | aws s3 cp - "s3://$bucket/$key"
  fi

  log "Starting PostgreSQL and the API"
  run_remote "$(cat <<EOF
set -euo pipefail
cd /opt/cs361
aws s3 cp "s3://$bucket/$key" app.tgz --region $AWS_REGION
rm -rf backend && tar xzf app.tgz
umask 077
# The database password is created once, here, and never leaves the instance.
[[ -f db.env ]] || printf 'POSTGRES_USER=cstu\nPOSTGRES_DB=cstu_demo\nPOSTGRES_PASSWORD=%s\n' "\$(openssl rand -hex 24)" > db.env
. ./db.env
docker network inspect cs361 >/dev/null 2>&1 || docker network create cs361
if ! docker inspect cs361-db >/dev/null 2>&1; then
  docker run -d --name cs361-db --network cs361 --restart unless-stopped --env-file db.env \
    -v /opt/cs361/pgdata:/var/lib/postgresql/data --memory 300m postgres:16-alpine
fi
for i in \$(seq 1 30); do docker exec cs361-db pg_isready -U cstu -d cstu_demo -q && break; sleep 2; done
cat > .env <<ENV
DATABASE_URL=postgresql://cstu:\$POSTGRES_PASSWORD@cs361-db:5432/cstu_demo
STORAGE_BACKEND=s3
S3_BUCKET=$bucket
AWS_REGION=$AWS_REGION
COGNITO_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$POOL_ID
COGNITO_APP_CLIENT_ID=$CLIENT_ID
CORS_ORIGINS=${CORS_ORIGINS:-}
ENV
docker build -q -t cs361-backend:$version backend
docker rm -f cs361-backend 2>/dev/null || true
docker run -d --name cs361-backend --network cs361 --restart unless-stopped --env-file .env \
  -p 8000:8000 cs361-backend:$version
for i in \$(seq 1 30); do
  curl -fsS http://localhost:8000/api/v1/health && exit 0
  sleep 2
done
docker logs --tail 50 cs361-backend
exit 1
EOF
)" "deploy backend $version"
  step_status
}

step_seed() {
  $YES || die "seed deletes every row in cstu_demo; re-run with --yes to confirm"
  run_remote "$(cat <<'EOF'
set -euo pipefail
cd /opt/cs361
image=$(docker inspect --format '{{.Config.Image}}' cs361-backend)
docker run --rm --network cs361 --env-file .env -e STORAGE_BACKEND=local "$image" python seed_demo.py
EOF
)" "seed demo data"
}

step_backup() {
  local bucket; bucket=$(output BucketName)
  run_remote "$(cat <<EOF
set -euo pipefail
name=backups/cstu_demo-\$(date -u +%Y%m%dT%H%M%SZ).sql.gz
docker exec cs361-db pg_dump -U cstu -d cstu_demo | gzip | aws s3 cp - "s3://$bucket/\$name" --region $AWS_REGION
echo "saved s3://$bucket/\$name"
EOF
)" "backup database"
}

step_amplify() {
  log "Amplify Console (connect GitHub yourself; this script never handles GitHub tokens)"
  cat <<EOF
1. Amplify -> Create new app -> GitHub -> repo sirimongkol0/CS361_G650-15, branch main
2. Tick "My app is a monorepo", app root: frontend
3. Environment variables:
     AMPLIFY_MONOREPO_APP_ROOT = frontend
     API_PROXY_TARGET          = $(output ApiBaseUrl)
     NEXT_PUBLIC_API_URL       = /api/v1
4. Save and deploy, then copy the app URL (https://main.<id>.amplifyapp.com) and run:
     CORS_ORIGINS=<that URL> $0 backend
EOF
}

step_status() {
  log "Health check"
  curl -fsS --max-time 10 "$(output ApiBaseUrl)/api/v1/health" && echo
}

step_teardown() {
  $YES || die "teardown deletes the instance AND its database; run '$0 backup' first, then re-run with --yes"
  aws cloudformation delete-stack --stack-name "$STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK"
  echo "Deleted. Kept: S3 bucket $STACK-docs-<account> (with backups/), Cognito pool $POOL_NAME."
}

case "$STEP" in
  check|infra|cognito|backend|seed|amplify|status|backup|teardown) "step_$STEP" ;;
  *) sed -n '2,25p' "$0"; exit 2 ;;
esac
