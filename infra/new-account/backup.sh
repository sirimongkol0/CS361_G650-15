#!/usr/bin/env bash
# CS361 PostgreSQL backup and restore helper.
#
# Runs on the backend instance (as root via SSM Run Command) but works from any
# shell with the instance role or an equivalent AWS profile:
#
#   backup.sh backup
#   backup.sh restore <s3-key> --yes
#
# Configuration comes from SSM Parameter Store (the base and backup stacks own
# these values), not from the command line:
#   ${CONFIG_PREFIX}/s3_bucket
#   ${CONFIG_PREFIX}/aws_region
#   ${CONFIG_PREFIX}/backup_topic_arn
#
# CONFIG_PREFIX defaults to /cs361/config. The database user and name come from
# /opt/cs361/db.env (POSTGRES_USER/POSTGRES_DB), falling back to cstu/cstu_demo.
# The password is never read or printed.
set -euo pipefail

CONFIG_PREFIX="${CONFIG_PREFIX:-/cs361/config}"
CONFIG_PREFIX="${CONFIG_PREFIX%/}"
DB_ENV_FILE="${DB_ENV_FILE:-/opt/cs361/db.env}"
METRIC_NAMESPACE="CS361/Backup"
METRIC_NAME="BackupSuccess"

BUCKET=""
REGION=""
TOPIC_ARN=""
DB_USER="cstu"
DB_NAME="cstu_demo"
YES=false

TMP_FILE=""
BACKEND_STOPPED=false

usage() {
  cat <<'EOF'
Usage:
  backup.sh backup
  backup.sh restore <s3-key> [--yes]

  backup   pg_dump cstu_demo, gzip, and upload to s3://<bucket>/backups/
  restore  download an S3 backup and restore it (requires --yes)

Environment:
  CONFIG_PREFIX  SSM parameter prefix (default /cs361/config)
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$TMP_FILE" ]]; then
    rm -f "$TMP_FILE"
  fi
  if [[ "$BACKEND_STOPPED" == true ]]; then
    docker start cs361-backend >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Read one parameter without assuming the CLI already has a region configured
# (on EC2 the CLI resolves it from instance metadata).
ssm_get() {
  local name="$CONFIG_PREFIX/$1"
  if [[ -n "${AWS_REGION:-}" ]]; then
    aws ssm get-parameter --region "$AWS_REGION" --name "$name" \
      --with-decryption --query Parameter.Value --output text
  elif [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then
    aws ssm get-parameter --region "$AWS_DEFAULT_REGION" --name "$name" \
      --with-decryption --query Parameter.Value --output text
  else
    aws ssm get-parameter --name "$name" \
      --with-decryption --query Parameter.Value --output text
  fi
}

load_config() {
  BUCKET="$(ssm_get s3_bucket)" || die "cannot read $CONFIG_PREFIX/s3_bucket from SSM"
  REGION="$(ssm_get aws_region)" || die "cannot read $CONFIG_PREFIX/aws_region from SSM"
  [[ -n "$BUCKET" ]] || die "$CONFIG_PREFIX/s3_bucket is empty"
  [[ -n "$REGION" ]] || die "$CONFIG_PREFIX/aws_region is empty"

  # The topic is created by the backup stack. A manual backup may run before
  # that stack exists; keep working, but warn because failures cannot alert.
  TOPIC_ARN="$(ssm_get backup_topic_arn 2>/dev/null || true)"
  if [[ -z "$TOPIC_ARN" ]]; then
    echo "WARNING: $CONFIG_PREFIX/backup_topic_arn is missing; failure alerts will be skipped" >&2
  fi
}

# Read only the non-secret values from db.env. Sourcing the file would put the
# password in this shell's environment; parsing two keys is enough.
read_env_value() {
  local file="$1" key="$2" value
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
  value="${value%$'\r'}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

load_db_env() {
  local user="" db=""
  if [[ -r "$DB_ENV_FILE" ]]; then
    user="$(read_env_value "$DB_ENV_FILE" POSTGRES_USER)"
    db="$(read_env_value "$DB_ENV_FILE" POSTGRES_DB)"
  fi
  DB_USER="${user:-cstu}"
  DB_NAME="${db:-cstu_demo}"
}

put_backup_metric() {
  local value="$1"
  aws cloudwatch put-metric-data --region "$REGION" \
    --namespace "$METRIC_NAMESPACE" --metric-name "$METRIC_NAME" \
    --value "$value" --unit Count
}

backup_failed() {
  local reason="$1"
  local message
  message="CS361 backup failed at $(date -u +%Y-%m-%dT%H:%M:%SZ) on $(hostname): $reason"

  echo "ERROR: $reason" >&2
  put_backup_metric 0 >/dev/null 2>&1 \
    || echo "WARNING: could not publish the CloudWatch failure metric" >&2

  if [[ -n "$TOPIC_ARN" ]]; then
    aws sns publish --region "$REGION" --topic-arn "$TOPIC_ARN" \
      --subject "CS361 backup failed" --message "$message" >/dev/null \
      || echo "WARNING: could not publish the SNS alert" >&2
  else
    echo "WARNING: no backup topic configured; cannot send an alert" >&2
  fi

  exit 1
}

do_backup() {
  local timestamp key
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  key="backups/${DB_NAME}-${timestamp}.sql.gz"

  echo "Backing up $DB_NAME to s3://$BUCKET/$key"
  # --clean --if-exists makes the dump restorable over an existing database.
  if ! docker exec cs361-db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
      | gzip -c \
      | aws s3 cp - "s3://$BUCKET/$key" --region "$REGION" --only-show-errors; then
    aws s3 rm "s3://$BUCKET/$key" --region "$REGION" >/dev/null 2>&1 || true
    backup_failed "pg_dump or the S3 upload failed (key: $key)"
  fi

  if ! put_backup_metric 1 >/dev/null; then
    # A successful dump without a success metric would trip the alarm, so treat
    # this as a failed run and alert.
    backup_failed "backup uploaded but the CloudWatch success metric could not be published"
  fi

  echo "Backup complete: s3://$BUCKET/$key"
}

do_restore() {
  local key="$1" tables table count

  if ! $YES; then
    die "restore overwrites database data; re-run with --yes to confirm"
  fi

  TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/cs361-restore.XXXXXX.sql.gz")"
  echo "Downloading s3://$BUCKET/$key"
  if ! aws s3 cp "s3://$BUCKET/$key" "$TMP_FILE" --region "$REGION" --only-show-errors; then
    die "could not download s3://$BUCKET/$key"
  fi
  [[ -s "$TMP_FILE" ]] || die "downloaded backup is empty"
  gzip -t "$TMP_FILE" 2>/dev/null || die "downloaded backup is not a valid gzip file"

  tables="$(docker exec cs361-db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")" \
    || die "cannot query the database"
  tables="${tables//[[:space:]]/}"
  if [[ "$tables" -gt 0 ]]; then
    $YES || die "refusing to restore over a non-empty database without --yes"
    echo "WARNING: $DB_NAME already has $tables tables; restoring over them (--yes)"
  fi

  if docker inspect cs361-backend >/dev/null 2>&1; then
    docker stop cs361-backend >/dev/null || die "could not stop cs361-backend"
    BACKEND_STOPPED=true
    echo "Stopped cs361-backend"
  fi

  echo "Restoring into $DB_NAME"
  if ! gunzip -c "$TMP_FILE" \
      | docker exec -i cs361-db psql -U "$DB_USER" -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 -q; then
    die "restore failed; the database may be partially restored"
  fi

  if docker inspect cs361-backend >/dev/null 2>&1; then
    if docker start cs361-backend >/dev/null; then
      BACKEND_STOPPED=false
      echo "Started cs361-backend"
    else
      echo "WARNING: could not start cs361-backend" >&2
    fi
  fi

  echo "Restore complete. Row counts:"
  for table in documents feedbacks outcomes; do
    if count="$(docker exec cs361-db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT count(*) FROM $table" 2>/dev/null)"; then
      printf '  %-12s %s\n' "$table" "$count"
    fi
  done
}

main() {
  local command="${1:-}"
  [[ -n "$command" ]] || { usage >&2; exit 2; }
  shift

  case "$command" in
    backup)
      [[ $# -eq 0 ]] || { usage >&2; exit 2; }
      load_config
      load_db_env
      do_backup
      ;;
    restore)
      local key="" arg
      for arg in "$@"; do
        case "$arg" in
          --yes) YES=true ;;
          -*) echo "unknown option: $arg" >&2; usage >&2; exit 2 ;;
          *)
            [[ -z "$key" ]] || die "only one S3 key may be restored at a time"
            key="$arg"
            ;;
        esac
      done
      [[ -n "$key" ]] || { usage >&2; exit 2; }
      $YES || die "restore overwrites database data; re-run with --yes to confirm"
      load_config
      load_db_env
      do_restore "$key"
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
