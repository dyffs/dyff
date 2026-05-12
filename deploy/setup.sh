#!/usr/bin/env bash
# Dyff self-hosted installer.
#
# Run from the deploy/ folder (the same dir as docker-compose.yml).
# Inspired by plane.so's setup.sh.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
SQUID_CONF="squid.conf"
SQUID_EXAMPLE="squid.conf.example"

# ---------- helpers ----------
c_red()    { printf "\033[31m%s\033[0m\n" "$*"; }
c_green()  { printf "\033[32m%s\033[0m\n" "$*"; }
c_yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
c_bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

die() { c_red "$*"; exit 1; }

# Pick the docker compose invocation form available on the host.
docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    die "Neither 'docker compose' nor 'docker-compose' is available. Install Docker Engine + Compose plugin."
  fi
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH"
  docker info >/dev/null 2>&1 || die "Cannot talk to Docker daemon. Is it running, and is your user in the 'docker' group?"
}

rand_hex() { openssl rand -hex "${1:-32}"; }

prompt() {
  # prompt <var> <question> <default>
  local _var=$1 _q=$2 _def=${3:-}
  local _val
  if [[ -n "$_def" ]]; then
    read -r -p "$_q [$_def]: " _val
    _val="${_val:-$_def}"
  else
    read -r -p "$_q: " _val
  fi
  printf -v "$_var" '%s' "$_val"
}

prompt_yn() {
  # prompt_yn <var> <question> <default Y|N>
  local _var=$1 _q=$2 _def=${3:-N}
  local _hint="y/N"; [[ "$_def" == "Y" ]] && _hint="Y/n"
  local _val
  read -r -p "$_q [$_hint]: " _val
  _val="${_val:-$_def}"
  case "${_val:0:1}" in
    y|Y) printf -v "$_var" 'yes' ;;
    *)   printf -v "$_var" 'no'  ;;
  esac
}

# Replace KEY=value (or append) in .env
set_env() {
  local key=$1 val=$2
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # Use a sentinel to avoid sed delim conflicts on values with /
    python3 -c "
import sys, re, pathlib
p = pathlib.Path('$ENV_FILE')
t = p.read_text()
t = re.sub(r'(?m)^${key}=.*$', '${key}=' + r'''${val}''', t)
p.write_text(t)
" 2>/dev/null || {
      # Fallback if python3 missing
      local tmp
      tmp=$(mktemp)
      awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp"
      mv "$tmp" "$ENV_FILE"
    }
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

# ---------- actions ----------

action_install() {
  c_bold "=== Dyff: install ==="
  require_docker

  if [[ -f "$ENV_FILE" ]]; then
    c_yellow ".env already exists."
    prompt_yn overwrite "Overwrite it? (your data volumes will NOT be touched)" "N"
    [[ "$overwrite" == "yes" ]] || { c_yellow "Keeping existing .env. Re-running pull + up."; pull_and_up; return; }
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  prompt frontend_url "Public URL the app will be reached at" "http://localhost:3000"
  prompt dyff_port    "External HTTP port" "3000"
  prompt admin_email  "Admin email" "admin@dyff.local"
  prompt admin_pass   "Admin password" "$(rand_hex 8)"

  set_env FRONTEND_URL "$frontend_url"
  set_env DYFF_PORT "$dyff_port"
  set_env SELF_HOST_ADMIN_EMAIL "$admin_email"
  set_env SELF_HOST_ADMIN_PASSWORD "$admin_pass"
  set_env JWT_SECRET "$(rand_hex 48)"
  set_env LLM_KEY_ENCRYPTION_SECRET "$(rand_hex 48)"

  prompt_yn bundled_pg "Use bundled Postgres?" "Y"
  if [[ "$bundled_pg" == "yes" ]]; then
    set_env DB_HOST "postgres"
    set_env DB_PORT "5432"
    set_env DB_USER "dyff"
    set_env DB_PASSWORD "$(rand_hex 16)"
    set_env DB_NAME "dyff"
  else
    prompt db_host "  External Postgres host" "localhost"
    prompt db_port "  Port" "5432"
    prompt db_user "  User" "dyff"
    prompt db_pass "  Password"
    prompt db_name "  Database name" "dyff"
    set_env DB_HOST "$db_host"
    set_env DB_PORT "$db_port"
    set_env DB_USER "$db_user"
    set_env DB_PASSWORD "$db_pass"
    set_env DB_NAME "$db_name"
  fi

  prompt_yn bundled_redis "Use bundled Redis?" "Y"
  if [[ "$bundled_redis" == "yes" ]]; then
    set_env REDIS_HOST "redis"
    set_env REDIS_PORT "6379"
  else
    prompt rd_host "  External Redis host" "localhost"
    prompt rd_port "  Port" "6379"
    set_env REDIS_HOST "$rd_host"
    set_env REDIS_PORT "$rd_port"
  fi

  prompt_yn use_squid "Enable Squid egress whitelist proxy?" "N"
  if [[ "$use_squid" == "yes" ]]; then
    if [[ ! -f "$SQUID_CONF" ]]; then
      cp "$SQUID_EXAMPLE" "$SQUID_CONF"
      c_green "Wrote $SQUID_CONF — edit it to customise the allowlist."
    fi
    set_env HTTP_PROXY  "http://squid:3128"
    set_env HTTPS_PROXY "http://squid:3128"
    set_env NO_PROXY    "localhost,127.0.0.1,postgres,redis"
    SQUID_PROFILE_FLAG="--profile proxy"
  else
    set_env HTTP_PROXY  ""
    set_env HTTPS_PROXY ""
    SQUID_PROFILE_FLAG=""
  fi

  echo "${SQUID_PROFILE_FLAG}" > .compose-profiles

  c_green "Wrote $ENV_FILE."
  c_bold "Pulling image(s)…"
  # shellcheck disable=SC2086
  docker_compose ${SQUID_PROFILE_FLAG} -f "$COMPOSE_FILE" pull
  c_bold "Starting services…"
  # shellcheck disable=SC2086
  docker_compose ${SQUID_PROFILE_FLAG} -f "$COMPOSE_FILE" up -d

  c_green "Done. Open ${frontend_url}"
  c_green "Admin login: ${admin_email} / ${admin_pass}"
}

profile_flag() {
  [[ -f .compose-profiles ]] && cat .compose-profiles || true
}

pull_and_up() {
  local flag; flag="$(profile_flag)"
  # shellcheck disable=SC2086
  docker_compose ${flag} -f "$COMPOSE_FILE" pull
  # shellcheck disable=SC2086
  docker_compose ${flag} -f "$COMPOSE_FILE" up -d
}

action_start() {
  require_docker
  local flag; flag="$(profile_flag)"
  # shellcheck disable=SC2086
  docker_compose ${flag} -f "$COMPOSE_FILE" up -d
}

action_stop() {
  require_docker
  local flag; flag="$(profile_flag)"
  # shellcheck disable=SC2086
  docker_compose ${flag} -f "$COMPOSE_FILE" down
}

action_restart() {
  action_stop
  action_start
}

action_upgrade() {
  require_docker
  c_bold "Pulling latest images…"
  pull_and_up
  c_green "Upgrade complete."
}

action_logs() {
  require_docker
  local flag; flag="$(profile_flag)"
  # shellcheck disable=SC2086
  docker_compose ${flag} -f "$COMPOSE_FILE" logs -f --tail=200
}

action_backup() {
  require_docker
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local out="dyff-backup-${ts}"
  mkdir -p "$out"

  c_bold "Dumping postgres…"
  # shellcheck disable=SC1091
  set -a; . "$ENV_FILE"; set +a
  docker_compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" > "${out}/postgres.sql"

  c_bold "Archiving asset + git volumes…"
  for vol in git_data asset_data; do
    docker run --rm \
      -v "dyff_${vol}:/src:ro" \
      -v "$(pwd)/${out}:/backup" \
      alpine:3.20 \
      sh -c "cd /src && tar czf /backup/${vol}.tar.gz ."
  done

  tar czf "${out}.tar.gz" "$out"
  rm -rf "$out"
  c_green "Wrote ${out}.tar.gz"
}

# ---------- menu ----------
menu() {
  cat <<EOF

$(c_bold "Dyff — self-hosted control")
  1) Install
  2) Start
  3) Stop
  4) Restart
  5) Upgrade
  6) View Logs
  7) Backup Data
  8) Exit
EOF
  read -r -p "Action [2]: " choice
  choice="${choice:-2}"
  case "$choice" in
    1) action_install ;;
    2) action_start ;;
    3) action_stop ;;
    4) action_restart ;;
    5) action_upgrade ;;
    6) action_logs ;;
    7) action_backup ;;
    8) exit 0 ;;
    *) c_red "Unknown choice: $choice" ;;
  esac
}

# Allow non-interactive use: ./setup.sh install / start / stop / ...
if [[ $# -gt 0 ]]; then
  case "$1" in
    install) action_install ;;
    start)   action_start ;;
    stop)    action_stop ;;
    restart) action_restart ;;
    upgrade) action_upgrade ;;
    logs)    action_logs ;;
    backup)  action_backup ;;
    *)       die "Unknown subcommand: $1" ;;
  esac
else
  menu
fi
