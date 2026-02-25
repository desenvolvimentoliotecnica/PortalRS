#!/usr/bin/env bash
set -euo pipefail

is_windows() {
  case "$(uname -s 2>/dev/null || echo "")" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

port_pids() {
  local port="$1"

  if is_windows; then
    # netstat output format: Proto LocalAddress ForeignAddress State PID
    netstat -ano 2>/dev/null \
      | findstr ":$port" \
      | findstr LISTENING \
      | awk '{print $5}' \
      | tr -d '\r' \
      | sort -u
    return 0
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$port" 2>/dev/null | sort -u || true
    return 0
  fi

  # Fallback (Linux): try ss if available
  if command -v ss >/dev/null 2>&1; then
    ss -lptn "sport = :$port" 2>/dev/null \
      | awk -F'pid=' 'NF>1{print $2}' \
      | awk -F',' '{print $1}' \
      | sort -u || true
    return 0
  fi

  return 0
}

kill_pid_tree() {
  local pid="$1"
  if [ -z "${pid:-}" ]; then return 0; fi

  if is_windows; then
    # /T = kill child processes, /F = force
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
    return 0
  fi

  # Best-effort: kill parent first to avoid dotnet watch respawn
  local ppid=""
  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
  if [ -n "$ppid" ] && [ "$ppid" -gt 1 ] 2>/dev/null; then
    kill -9 "$ppid" 2>/dev/null || true
  fi
  kill -9 "$pid" 2>/dev/null || true
}

free_port() {
  local port="$1"
  local pids
  pids="$(port_pids "$port" || true)"
  if [ -z "$pids" ]; then
    echo "▶ Porta $port já está livre"
    return 0
  fi

  echo "▶ Liberando porta $port (PID(s) $pids)..."
  for pid in $pids; do
    kill_pid_tree "$pid"
  done
  sleep 1
}

