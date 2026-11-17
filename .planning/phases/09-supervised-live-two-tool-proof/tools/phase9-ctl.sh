#!/usr/bin/env bash
# Phase 9 evidence capture and guarded sim-server control (09-03, D-10, D-16, D-18).
#
# READ-ONLY toward every real tool: this script only does HTTP GET against galago-web, reads local
# files (trace logs, the STACK ledger), and runs ss and git read commands. It never sends a tool
# command, never calls a gRPC service, never uses the container CLI, and never kills by process
# name. Its single signal-sending path is stop-sim, which can stop only the one PID that listens on
# a sim port (40091 or 40092), whose command line names that exact port, and which does not also
# listen on any real port.
#
# Subcommands:
#   baseline LABEL              write EVID/STAMP-LABEL.baseline.txt (provenance, listeners, log counts, ledger)
#   snapshot LABEL              write EVID/STAMP-LABEL.queue.json (laneStatus, getAll, getAllRuns)
#   logs-since BASELINE LABEL   copy the lines appended to both tool logs since BASELINE (redacted)
#   ledger LABEL PREFIX         copy ledger records whose key starts with PREFIX
#   start-sim stack|fast        launch a sim tool server on its sim port
#   stop-sim stack|fast         stop the sim tool server on its sim port (the only signal)
#   check-guards                prove the kill guards without sending any signal; prints GUARDS OK
#
# Environment overrides: GALAGO_WEB_URL, GALAGO_TOOLS_DIR, XDG_STATE_HOME.
# Evidence files hold values read from the host, never an environment-file value.

set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
TOOLS_HERE="$(dirname "$SELF")"
PHASE_DIR="$(dirname "$TOOLS_HERE")"
CORE_DIR="$(cd "$PHASE_DIR/../../.." && pwd)"

WEB="${GALAGO_WEB_URL:-http://localhost:3010}"
TOOLS_DIR="${GALAGO_TOOLS_DIR:-$HOME/data/nikko/galago-tools}"
EVID="$PHASE_DIR/evidence"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/galago-phase9"
LEDGER="$HOME/.local/state/galago-tools/stack/stack-ledger.json"
TRACE_ROOT="$HOME/.local/share/galago/trace_logs"
REAL_PORTS="3010 8081 11010 40001 40012"
SIM_PORT_STACK=40091
SIM_PORT_FAST=40092
AUTOMINT_COMMIT=0604348

stamp() { date -u +%Y%m%dT%H%M%SZ; }

die() { echo "phase9-ctl: $*" >&2; exit 2; }

check_label() {
  case "${1:-}" in
    ''|*[!A-Za-z0-9_-]*) die "LABEL must be non-empty and match [A-Za-z0-9_-]+" ;;
  esac
}

sim_port_for() {
  case "${1:-}" in
    stack) echo "$SIM_PORT_STACK" ;;
    fast) echo "$SIM_PORT_FAST" ;;
    *) return 1 ;;
  esac
}

# Distinct PIDs that listen on TCP port $1 (empty when none, or when ss cannot see the owner).
pids_on_port() {
  { ss -ltnpH "sport = :$1" 2>/dev/null || true; } | { grep -o 'pid=[0-9]*' || true; } | cut -d= -f2 | sort -u
}

redact() {
  sed -E \
    -e 's/Bearer [A-Za-z0-9._~+\/=-]+/Bearer <redacted>/g' \
    -e 's/(STACK_(USER|PASSWORD)[[:space:]]*[=:][[:space:]]*)[^[:space:],;]+/\1<redacted>/g'
}

newest_trace() { { ls -t "$TRACE_ROOT" 2>/dev/null || true; } | head -1; }

web_get() { curl -fsS -m 15 "$WEB$1"; }

# Decide whether PID may be signalled as the sim server on port $1. Prints the reason and returns 0
# when the PID must be REFUSED, returns 1 when it may be stopped.
refuse_reason() {
  local port="$1" pid="$2" p
  case "$pid" in ''|*[!0-9]*) echo "not a PID: '$pid'"; return 0 ;; esac
  if [ ! -r "/proc/$pid/cmdline" ]; then
    echo "cannot read /proc/$pid/cmdline"; return 0
  fi
  if ! tr '\0' '\n' < "/proc/$pid/cmdline" | grep -Fxq -- "--port=$port"; then
    echo "PID $pid command line does not name --port=$port"; return 0
  fi
  for p in $REAL_PORTS; do
    if pids_on_port "$p" | grep -Fxq -- "$pid"; then
      echo "PID $pid also listens on real port $p"; return 0
    fi
  done
  return 1
}

cmd_baseline() {
  check_label "${1:-}"
  mkdir -p "$EVID"
  local label="$1" out trace d p n real_pids
  out="$EVID/$(stamp)-$label.baseline.txt"
  {
    echo "baseline_label=$label"
    echo "utc_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "galago_core_head=$(git -C "$CORE_DIR" rev-parse HEAD)"
    echo "galago_core_controller_dirty_lines=$(git -C "$CORE_DIR" status --porcelain -- controller | wc -l)"
    echo "galago_tools_head=$(git -C "$TOOLS_DIR" rev-parse HEAD)"
    git -C "$TOOLS_DIR" merge-base --is-ancestor "$AUTOMINT_COMMIT" HEAD && n=0 || n=$?
    echo "galago_tools_automint_${AUTOMINT_COMMIT}_ancestor_exit=$n"
    echo "galago_tools_tools_dirty_lines=$(git -C "$TOOLS_DIR" status --porcelain -- tools | wc -l)"
    echo "--- listeners (ss -ltnpH, real and sim ports)"
    for p in $REAL_PORTS $SIM_PORT_STACK $SIM_PORT_FAST; do
      echo "port=$p pids=$(pids_on_port "$p" | tr '\n' ',')"
      { ss -ltnpH "sport = :$p" 2>/dev/null || true; } | sed 's/^/  /'
    done
    trace="$(newest_trace)"
    echo "--- trace logs"
    echo "trace_folder=$trace"
    for d in STACK2-6.log FA100056.log; do
      if [ -n "$trace" ] && [ -f "$TRACE_ROOT/$trace/$d" ]; then
        echo "$d.wc=$(wc -l < "$TRACE_ROOT/$trace/$d")"
        echo "$d.running_command=$(grep -c 'Running command' "$TRACE_ROOT/$trace/$d" || true)"
        echo "$d.running_command_transfer=$(grep -c 'Running command Transfer' "$TRACE_ROOT/$trace/$d" || true)"
      else
        echo "$d.wc=absent"
        echo "$d.running_command=absent"
        echo "$d.running_command_transfer=absent"
      fi
    done
    echo "--- ledger"
    if [ -f "$LEDGER" ]; then
      echo "ledger_sha256=$(sha256sum "$LEDGER" | cut -d' ' -f1)"
      python3 -I - "$LEDGER" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
recs = d.get("records", {})
print("ledger_record_count=%d" % len(recs))
for k in sorted(recs):
    v = recs[k]
    print("record key=%s state=%s result.kind=%s createdAt=%s updatedAt=%s" % (
        k, v.get("state"), (v.get("result") or {}).get("kind"), v.get("createdAt"), v.get("updatedAt")))
PY
    else
      echo "ledger_sha256=absent"
    fi
    echo "--- galago-web (HTTP GET)"
    echo "health=$(web_get /api/health || echo UNREACHABLE)"
    echo "selected_workcell=$(web_get /api/settings/workcell || echo UNREACHABLE)"
    echo "laneStatus=$(web_get /api/trpc/commandQueue.laneStatus || echo UNREACHABLE)"
  } > "$out"
  echo "$out"
}

cmd_snapshot() {
  check_label "${1:-}"
  mkdir -p "$EVID"
  local label="$1" out tmp
  out="$EVID/$(stamp)-$label.queue.json"
  tmp="$(mktemp -d)"
  web_get /api/trpc/commandQueue.laneStatus > "$tmp/laneStatus.json"
  web_get /api/trpc/commandQueue.getAll > "$tmp/getAll.json"
  web_get /api/trpc/commandQueue.getAllRuns > "$tmp/getAllRuns.json"
  python3 -I - "$tmp" "$out" <<'PY'
import datetime, json, sys
tmp, out = sys.argv[1], sys.argv[2]
obj = {"capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
for name in ("laneStatus", "getAll", "getAllRuns"):
    obj[name] = json.load(open("%s/%s.json" % (tmp, name)))
json.dump(obj, open(out, "w"), indent=2, sort_keys=True)
PY
  rm -rf "$tmp"
  echo "$out"
}

baseline_value() { grep -m1 "^$2=" "$1" | cut -d= -f2-; }

cmd_logs_since() {
  local base="${1:-}" label="${2:-}"
  [ -f "$base" ] || die "baseline file not found: $base"
  check_label "$label"
  mkdir -p "$EVID"
  local old_trace now_trace d old_wc now_wc out_prefix
  old_trace="$(baseline_value "$base" trace_folder)"
  now_trace="$(newest_trace)"
  if [ "$old_trace" != "$now_trace" ]; then
    echo "TRUNCATED-OR-RESTARTED (trace folder changed: $old_trace -> $now_trace)"
    exit 3
  fi
  out_prefix="$EVID/$(stamp)-$label"
  for d in STACK2-6 FA100056; do
    old_wc="$(baseline_value "$base" "$d.log.wc")"
    case "$old_wc" in ''|*[!0-9]*) die "baseline has no numeric $d.log.wc" ;; esac
    now_wc="$(wc -l < "$TRACE_ROOT/$now_trace/$d.log")"
    if [ "$now_wc" -lt "$old_wc" ]; then
      echo "TRUNCATED-OR-RESTARTED ($d.log now $now_wc lines, baseline $old_wc)"
      exit 3
    fi
  done
  for d in STACK2-6 FA100056; do
    old_wc="$(baseline_value "$base" "$d.log.wc")"
    tail -n +"$((old_wc + 1))" "$TRACE_ROOT/$now_trace/$d.log" | redact > "$out_prefix.$d.log"
    echo "$out_prefix.$d.log ($(wc -l < "$out_prefix.$d.log") lines)"
  done
}

cmd_ledger() {
  check_label "${1:-}"
  local label="$1" prefix="${2:-}" out
  [ -f "$LEDGER" ] || die "ledger not found"
  mkdir -p "$EVID"
  out="$EVID/$(stamp)-$label.ledger.json"
  python3 -I - "$LEDGER" "$prefix" "$out" <<'PY'
import json, sys
ledger, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
recs = json.load(open(ledger)).get("records", {})
keep = {}
for k in sorted(recs):
    if k.startswith(prefix):
        v = recs[k]
        keep[k] = {
            "state": v.get("state"),
            "result.kind": (v.get("result") or {}).get("kind"),
            "createdAt": v.get("createdAt"),
            "updatedAt": v.get("updatedAt"),
        }
json.dump(keep, open(out, "w"), indent=2, sort_keys=True)
print(len(keep))
PY
  echo "$out"
}

cmd_start_sim() {
  local name="${1:-}" port mod stampv logf
  port="$(sim_port_for "$name")" || die "start-sim takes stack or fast"
  [ -n "$(ss -ltnH "sport = :$port" 2>/dev/null)" ] && die "port $port already has a listener"
  case "$name" in stack) mod=tools.stack.server ;; fast) mod=tools.fast.server ;; esac
  mkdir -p "$STATE"
  stampv="$(stamp)"
  logf="$STATE/sim-$name-$stampv.log"
  # setsid -f detaches the server fully: a backgrounded `cd && setsid ...` list leaves a waiting bash
  # parent that keeps the caller's stdout pipe open, so `PID=$(phase9-ctl.sh start-sim ...)` hung.
  ( cd "$TOOLS_DIR" && setsid -f nohup "$TOOLS_DIR/.venv/bin/python3" -m "$mod" --port="$port" > "$logf" 2>&1 < /dev/null )
  local i pid=""
  for i in $(seq 1 30); do
    pid="$(pids_on_port "$port" | head -1)"
    [ -n "$pid" ] && break
    sleep 1
  done
  [ -n "$pid" ] || die "sim $name did not listen on $port within 30 s (see $logf)"
  echo "$pid" > "$STATE/sim-$name.pid"
  echo "$pid"
}

cmd_stop_sim() {
  local name="${1:-}" port pids pid reason i
  port="$(sim_port_for "$name")" || die "stop-sim takes stack or fast"
  pids="$(pids_on_port "$port")"
  [ -n "$pids" ] || die "no listener on sim port $port"
  [ "$(printf '%s\n' "$pids" | wc -l)" -eq 1 ] || die "more than one PID on sim port $port: $(echo $pids)"
  pid="$pids"
  if reason="$(refuse_reason "$port" "$pid")"; then
    die "refusing: $reason"
  fi
  kill -TERM "$pid"
  for i in $(seq 1 15); do
    [ -z "$(pids_on_port "$port")" ] && { echo "$pid"; return 0; }
    sleep 1
  done
  die "PID $pid still listens on $port after 15 s"
}

cmd_check_guards() {
  local rc=0 p pid reason checked=0
  bash "$SELF" stop-sim bogus >/dev/null 2>&1 || rc=$?
  [ "$rc" -eq 2 ] || { echo "GUARD FAIL: stop-sim bogus exited $rc, expected 2" >&2; exit 1; }
  rc=0
  bash "$SELF" stop-sim real >/dev/null 2>&1 || rc=$?
  [ "$rc" -eq 2 ] || { echo "GUARD FAIL: stop-sim real exited $rc, expected 2" >&2; exit 1; }
  [ "$SIM_PORT_STACK $SIM_PORT_FAST" = "40091 40092" ] || { echo "GUARD FAIL: sim map changed" >&2; exit 1; }
  for p in $SIM_PORT_STACK $SIM_PORT_FAST; do
    case " $REAL_PORTS " in *" $p "*) echo "GUARD FAIL: sim port $p is in REAL_PORTS" >&2; exit 1 ;; esac
  done
  [ "$REAL_PORTS" = "3010 8081 11010 40001 40012" ] || { echo "GUARD FAIL: REAL_PORTS changed" >&2; exit 1; }
  # No signal is sent: ask the guard about the real listeners and this shell. Each must be refused
  # for both sim ports.
  for p in $REAL_PORTS; do
    for pid in $(pids_on_port "$p"); do
      for sp in $SIM_PORT_STACK $SIM_PORT_FAST; do
        reason="$(refuse_reason "$sp" "$pid")" || { echo "GUARD FAIL: real listener PID $pid (port $p) not refused for sim port $sp" >&2; exit 1; }
        checked=$((checked + 1))
      done
    done
  done
  for sp in $SIM_PORT_STACK $SIM_PORT_FAST; do
    reason="$(refuse_reason "$sp" "$$")" || { echo "GUARD FAIL: own PID not refused for sim port $sp" >&2; exit 1; }
    reason="$(refuse_reason "$sp" "")" || { echo "GUARD FAIL: empty PID not refused" >&2; exit 1; }
  done
  echo "refusals verified for $checked real-listener/sim-port pairs"
  echo "GUARDS OK"
}

main() {
  local sub="${1:-}"
  [ $# -gt 0 ] && shift
  case "$sub" in
    baseline) cmd_baseline "$@" ;;
    snapshot) cmd_snapshot "$@" ;;
    logs-since) cmd_logs_since "$@" ;;
    ledger) cmd_ledger "$@" ;;
    start-sim) cmd_start_sim "$@" ;;
    stop-sim) cmd_stop_sim "$@" ;;
    check-guards) cmd_check_guards ;;
    *) die "usage: phase9-ctl.sh baseline|snapshot|logs-since|ledger|start-sim|stop-sim|check-guards" ;;
  esac
}

main "$@"
