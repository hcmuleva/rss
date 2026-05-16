#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ACTION="${1:-}"
MODE="${2:-}"
IP_ADDRESS="${3:-}"
STARTED_SERVICES=()
STARTED_PIDS=()
STARTED_PORTS=()
STARTED_IPS=()

usage() {
  cat <<EOF
Usage:
  $(basename "$0") start [force] [IP_ADDRESS]
  $(basename "$0") stop [force]
  $(basename "$0") restart [force] [IP_ADDRESS]
  
Examples:
  $(basename "$0") start
  $(basename "$0") restart force
  $(basename "$0") restart 192.168.1.100
  $(basename "$0") restart force 192.168.1.100
EOF
}

if [ -z "$ACTION" ]; then
  usage
  exit 1
fi

if [ "$ACTION" = "force" ]; then
  ACTION="restart"
  MODE="force"
fi

# Handle IP address as second or third argument
# If second arg is not "force", it's the IP
if [ -n "$MODE" ] && [ "$MODE" != "force" ]; then
  IP_ADDRESS="$MODE"
  MODE=""
fi

if [ "$ACTION" != "start" ] && [ "$ACTION" != "stop" ] && [ "$ACTION" != "restart" ]; then
  usage
  exit 1
fi

get_services() {
  local dir
  for dir in "$SCRIPT_DIR"/*; do
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
      basename "$dir"
    fi
  done
}

is_pid_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

find_service_pids() {
  local service="$1"
  local service_dir="$SCRIPT_DIR/$service"
  pgrep -f "$service_dir" 2>/dev/null || true
}

get_service_config_port() {
  local service="$1"
  local service_dir="$SCRIPT_DIR/$service"
  local env_file="$service_dir/.env"
  local env_example_file="$service_dir/.env.example"
  local port=""

  if [ -f "$env_file" ]; then
    port="$(awk -F= '/^[[:space:]]*PORT[[:space:]]*=/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "$env_file" 2>/dev/null || true)"
  fi

  if [ -z "$port" ] && [ -f "$env_example_file" ]; then
    port="$(awk -F= '/^[[:space:]]*PORT[[:space:]]*=/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "$env_example_file" 2>/dev/null || true)"
  fi

  echo "${port:-N/A}"
}

get_listening_port_by_pid() {
  local pid="$1"
  local port=""
  port="$(lsof -Pan -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {split($9, a, ":"); print a[length(a)]; exit}' || true)"
  echo "${port:-N/A}"
}

record_started_service() {
  local service="$1"
  local pid="$2"
  local detected_port
  local config_port
  local final_port

  detected_port="$(get_listening_port_by_pid "$pid")"
  config_port="$(get_service_config_port "$service")"

  if [ "$detected_port" != "N/A" ]; then
    final_port="$detected_port"
  else
    final_port="$config_port"
  fi

  STARTED_SERVICES+=("$service")
  STARTED_PIDS+=("${pid:-N/A}")
  STARTED_PORTS+=("${final_port:-N/A}")
  STARTED_IPS+=("${IP_ADDRESS:-localhost}")
}

print_started_services_table() {
  local count="${#STARTED_SERVICES[@]}"
  local i

  if [ "$count" -eq 0 ]; then
    return
  fi

  echo
  printf "%-30s %-10s %-10s %-20s\n" "SERVICE_NAME" "PID" "PORT" "IP_ADDRESS"
  printf "%-30s %-10s %-10s %-20s\n" "------------------------------" "----------" "----------" "--------------------"
  for ((i = 0; i < count; i++)); do
    printf "%-30s %-10s %-10s %-20s\n" "${STARTED_SERVICES[$i]}" "${STARTED_PIDS[$i]}" "${STARTED_PORTS[$i]}" "${STARTED_IPS[$i]}"
  done
}

stop_service() {
  local service="$1"
  local force="${2:-false}"
  local tmp_dir="/tmp/$service"
  local pid_file="$tmp_dir/service.pid"
  local pid=""

  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$pid" ] && is_pid_running "$pid"; then
      if [ "$force" = "true" ]; then
        kill -9 "$pid" 2>/dev/null || true
      else
        kill "$pid" 2>/dev/null || true
      fi
      echo "Stopped $service (pid: $pid)"
    fi
    rm -f "$pid_file"
  fi

  local extra_pids
  extra_pids="$(find_service_pids "$service")"
  if [ -n "$extra_pids" ]; then
    if [ "$force" = "true" ]; then
      echo "$extra_pids" | xargs kill -9 2>/dev/null || true
      echo "Force killed remaining processes for $service"
    else
      echo "$extra_pids" | xargs kill 2>/dev/null || true
      echo "Stopped remaining processes for $service"
    fi
  fi
}

start_service() {
  local service="$1"
  local service_dir="$SCRIPT_DIR/$service"
  local tmp_dir="/tmp/$service"
  local pid_file="$tmp_dir/service.pid"
  local log_file="$tmp_dir/service.log"
  local err_file="$tmp_dir/service.error.log"

  mkdir -p "$tmp_dir"

  if [ -f "$pid_file" ]; then
    local existing_pid
    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$existing_pid" ] && is_pid_running "$existing_pid"; then
      echo "$service is already running (pid: $existing_pid)"
      record_started_service "$service" "$existing_pid"
      return
    fi
  fi

  (
    cd "$service_dir" || exit 1
    if [ -n "$IP_ADDRESS" ]; then
      HOST="$IP_ADDRESS" nohup npm start >>"$log_file" 2>>"$err_file" &
    else
      nohup npm start >>"$log_file" 2>>"$err_file" &
    fi
    echo $! >"$pid_file"
  )

  local new_pid
  new_pid="$(cat "$pid_file" 2>/dev/null || true)"
  local host_info=""
  if [ -n "$IP_ADDRESS" ]; then
    host_info=" (IP: $IP_ADDRESS)"
  fi
  echo "Started $service (pid: $new_pid)$host_info"
  echo "Logs: $log_file"
  echo "Errors: $err_file"
  record_started_service "$service" "$new_pid"
}

run_action() {
  local force_mode="${1:-false}"
  local service

  for service in $(get_services); do
    case "$ACTION" in
      start)
        start_service "$service"
        ;;
      stop)
        stop_service "$service" "$force_mode"
        ;;
      restart)
        stop_service "$service" "$force_mode"
        start_service "$service"
        ;;
    esac
  done
}

if [ "$MODE" = "force" ]; then
  run_action "true"
else
  run_action "false"
fi

if [ "$ACTION" = "start" ] || [ "$ACTION" = "restart" ]; then
  print_started_services_table
fi
