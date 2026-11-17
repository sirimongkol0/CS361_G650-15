#!/usr/bin/env bash
# Lightweight sampler for the EC2 host. Run through SSM Session Manager while
# Locust is running, for example:
#   bash monitor.sh | tee /tmp/loadtest-monitor.log
set -euo pipefail

INTERVAL="${INTERVAL:-5}"
DB_CONTAINER="${DB_CONTAINER:-cs361-database}"
DB_NAME="${DB_NAME:-cstu_demo}"

while true; do
  date -u +'%Y-%m-%dT%H:%M:%SZ'
  uptime
  free -m | sed -n '1,2p'
  docker stats --no-stream --format \
    'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}'
  docker exec "$DB_CONTAINER" psql -U cstu_app -d "$DB_NAME" -Atc \
    "select 'db_connections=' || count(*) from pg_stat_activity where datname = '$DB_NAME';" \
    2>/dev/null || true
  echo
  sleep "$INTERVAL"
done
