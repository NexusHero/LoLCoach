#!/usr/bin/env bash
# test.sh — run all tests for core (Node/Jest) and app side-by-side
#
# Usage:
#   ./test.sh                  run all tests (app goldens excluded)
#   ./test.sh --coverage       core tests with coverage report
#   ./test.sh --mock-server    start mock LoL server before core tests (guaranteed stop)
#   ./test.sh --goldens        include app golden tests
#   ./test.sh --update-goldens regenerate golden baselines then run all
#   ./test.sh --core-only      skip app
#   ./test.sh --app-only       skip core
#   ./test.sh --watch          core jest --watch (app skipped)
#
# Verbosity:
#   -q / --quiet    only the final summary (no test output, no dir/cmd info)
#   (default)       test results only — console logs from test code are suppressed
#   -v / --verbose  full output including all console logs from test code

set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── flags ────────────────────────────────────────────────────────────────────
RUN_CORE=true
RUN_APP=true
COVERAGE=false
GOLDENS=false
UPDATE_GOLDENS=false
WATCH=false
WITH_MOCK_SERVER=false
VERBOSITY=1   # 0=quiet  1=default  2=verbose

for arg in "$@"; do
  case "$arg" in
    --coverage)       COVERAGE=true ;;
    --mock-server)    WITH_MOCK_SERVER=true ;;
    --goldens)        GOLDENS=true ;;
    --update-goldens) UPDATE_GOLDENS=true; GOLDENS=true ;;
    --core-only)      RUN_APP=false ;;
    --app-only)       RUN_CORE=false ;;
    --watch)          WATCH=true; RUN_APP=false ;;
    -q|--quiet)       VERBOSITY=0 ;;
    -v|--verbose)     VERBOSITY=2 ;;
    --help|-h)
      sed -n '/^# Usage:/,/^[^#]/p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $arg${RESET}"
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="$ROOT/core"
APP_DIR="$ROOT/app"

CORE_EXIT=0
APP_EXIT=0
MOCK_PID=""
MOCK_PORT=29990

# ── helpers ───────────────────────────────────────────────────────────────────
section() { [ "$VERBOSITY" -ge 1 ] && echo -e "\n${CYAN}${BOLD}▶ $1${RESET}" || true; }
ok()      { echo -e "${GREEN}${BOLD}✔ $1${RESET}"; }
fail()    { echo -e "${RED}${BOLD}✖ $1${RESET}"; }
warn()    { echo -e "${YELLOW}$1${RESET}"; }
info()    { [ "$VERBOSITY" -ge 1 ] && echo -e "  $*" || true; }

check_tool() {
  if ! command -v "$1" &>/dev/null; then
    warn "  $1 not found — skipping ${2:-} tests"
    return 1
  fi
  return 0
}

# Run a command with output handling based on VERBOSITY.
#   VERBOSITY=2 : stream everything
#   VERBOSITY=1 : buffer; filter out lines matching FILTER (if non-empty), then print
#   VERBOSITY=0 : buffer; discard all output
# Sets the named variable to the command's exit code.
#
# Usage: run_cmd RESULT_VAR FILTER CMD [ARGS…]
run_cmd() {
  local _var=$1 _filter=$2; shift 2
  local _exit=0 _tmp

  if [ "$VERBOSITY" -ge 2 ]; then
    if "$@" 2>&1; then _exit=0; else _exit=$?; fi
  else
    _tmp=$(mktemp)
    if "$@" >"$_tmp" 2>&1; then _exit=0; else _exit=$?; fi
    if [ "$VERBOSITY" -ge 1 ]; then
      if [ -n "$_filter" ]; then
        grep -v "$_filter" "$_tmp" || true
      else
        cat "$_tmp"
      fi
    fi
    rm -f "$_tmp"
  fi

  printf -v "$_var" '%d' "$_exit"
}

# ── mock server lifecycle ─────────────────────────────────────────────────────

# Guaranteed cleanup — fires on EXIT (normal, Ctrl-C, error, SIGTERM).
cleanup_mock() {
  if [ -n "$MOCK_PID" ]; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
    MOCK_PID=""
  fi
}
trap cleanup_mock EXIT

start_mock_server() {
  section "Mock LoL Server"

  if ! check_tool node "mock server"; then
    warn "  node not found — skipping mock server"
    return
  fi

  info "port : $MOCK_PORT"
  info "cmd  : npx tsx src/mock-lol-server.ts"
  [ "$VERBOSITY" -ge 1 ] && echo "" || true

  MOCK_LOL_PORT=$MOCK_PORT npx --prefix "$CORE_DIR" tsx \
    "$CORE_DIR/src/mock-lol-server.ts" >/tmp/mock-lol.log 2>&1 &
  MOCK_PID=$!

  # Wait until the server responds (max 5s)
  local ready=false
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf \
      "http://localhost:$MOCK_PORT/liveclientdata/allgamedata" \
      >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 0.5
  done

  if $ready; then
    ok "Mock LoL server ready  (pid $MOCK_PID)"
    export LIVE_CLIENT_URL="http://localhost:$MOCK_PORT/liveclientdata/allgamedata"
    info "LIVE_CLIENT_URL=$LIVE_CLIENT_URL"
  else
    fail "Mock LoL server did not start within 5s"
    cat /tmp/mock-lol.log 2>/dev/null || true
    cleanup_mock
  fi
}

# ── core ───────────────────────────────────────────────────────────────────
run_core() {
  section "Core — Node.js / Jest"

  if ! check_tool node "core"; then
    CORE_EXIT=1
    return
  fi

  cd "$CORE_DIR"

  local jest_args=""

  if $WATCH; then
    jest_args="--watch"
  elif $COVERAGE; then
    jest_args="--coverage"
  fi

  # Suppress console.log from test code unless verbose
  if ! $WATCH && [ "$VERBOSITY" -le 1 ]; then
    jest_args="$jest_args --silent"
  fi

  info "dir  : $CORE_DIR"
  info "cmd  : npm test -- $jest_args"
  if [ -n "${LIVE_CLIENT_URL:-}" ]; then
    info "env  : LIVE_CLIENT_URL=$LIVE_CLIENT_URL"
  fi
  [ "$VERBOSITY" -ge 1 ] && echo "" || true

  # shellcheck disable=SC2086
  run_cmd CORE_EXIT "" npm test -- $jest_args

  if [ "$CORE_EXIT" -eq 0 ]; then
    ok "Core tests passed"
  else
    fail "Core tests failed (exit $CORE_EXIT)"
  fi

  cd "$ROOT"
}

# ── app ───────────────────────────────────────────────────────────────────
run_app() {
  section "App (Flutter)"

  if ! check_tool flutter "flutter"; then
    warn "  Install Flutter SDK and add it to PATH to run Flutter tests."
    APP_EXIT=1
    return
  fi

  cd "$APP_DIR"

  info "dir  : $APP_DIR"

  # ── analyze (mirrors CI) ──────────────────────────────────────────────────
  local _analyze_exit=0
  info "cmd  : flutter analyze"
  [ "$VERBOSITY" -ge 1 ] && echo "" || true
  run_cmd _analyze_exit "" flutter analyze
  if [ "$_analyze_exit" -eq 0 ]; then
    ok "Flutter analyze passed"
  else
    fail "Flutter analyze failed (exit $_analyze_exit)"
    APP_EXIT=$_analyze_exit
    cd "$ROOT"
    return
  fi

  # Update goldens first if requested
  if $UPDATE_GOLDENS; then
    [ "$VERBOSITY" -ge 1 ] && echo "" || true
    warn "  Regenerating golden baselines…"
    local _golden_exit=0
    run_cmd _golden_exit "^\[" flutter test \
      --update-goldens \
      test/widgets/recommendation_panel_golden_test.dart
    if [ "$_golden_exit" -eq 0 ]; then
      ok "Goldens updated"
    else
      fail "Golden update failed"
      APP_EXIT=1
      cd "$ROOT"
      return
    fi
  fi

  # Build the test file list (only include paths that exist)
  local _candidates=(
    test/models
    test/services
    test/screens
    test/widgets/recommendation_panel_test.dart
    test/widgets/tactical_insights_test.dart
    test/widgets/connection_form_test.dart
  )
  local test_dirs=()
  for _p in "${_candidates[@]}"; do
    [[ -e "$_p" ]] && test_dirs+=("$_p")
  done

  if $GOLDENS; then
    test_dirs+=("test/widgets/recommendation_panel_golden_test.dart")
    info "mode : all tests (including goldens)"
  else
    info "mode : unit + widget (goldens excluded — use --goldens to include)"
  fi

  info "cmd  : flutter test ${test_dirs[*]}"
  [ "$VERBOSITY" -ge 1 ] && echo "" || true

  # Lines starting with [ are console logs from app code (e.g. [WsService] …)
  run_cmd APP_EXIT "^\[" flutter test "${test_dirs[@]}"

  if [ "$APP_EXIT" -eq 0 ]; then
    ok "App tests passed"
  else
    fail "App tests failed (exit $APP_EXIT)"
  fi

  cd "$ROOT"
}

# ── summary ───────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  Summary${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

  if $WITH_MOCK_SERVER; then
    echo "     Mock LoL server stopped (guaranteed)"
  fi

  if $RUN_CORE; then
    if [ $CORE_EXIT -eq 0 ]; then
      ok "  Core passed"
    else
      fail "  Core FAILED"
    fi
  else
    echo "     Core (skipped)"
  fi

  if $RUN_APP; then
    if [ $APP_EXIT -eq 0 ]; then
      ok "  App  passed"
    else
      fail "  App  FAILED"
    fi
  else
    echo "     App  (skipped)"
  fi

  echo ""

  local overall=0
  $RUN_CORE  && [ $CORE_EXIT -ne 0 ] && overall=1
  $RUN_APP && [ $APP_EXIT -ne 0 ] && overall=1

  if [ $overall -eq 0 ]; then
    echo -e "${GREEN}${BOLD}  All tests passed.${RESET}"
  else
    echo -e "${RED}${BOLD}  Some tests failed.${RESET}"
  fi
  echo ""

  return $overall
}

# ── main ──────────────────────────────────────────────────────────────────────
$WITH_MOCK_SERVER && $RUN_CORE && start_mock_server

$RUN_CORE  && run_core
$RUN_APP && run_app

print_summary
