#!/bin/bash
# ============================================================
# ClaudeSync - Bidirectional Dropbox Sync Daemon
# Watches local project and Dropbox folder for changes,
# syncs both directions automatically.
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load config
source "$SCRIPT_DIR/sync-config.sh"

# Override with local config if it exists (for per-machine paths)
if [[ -f "$SCRIPT_DIR/sync-config.local.sh" ]]; then
  source "$SCRIPT_DIR/sync-config.local.sh"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  local msg="[$(date '+%H:%M:%S')] $1"
  echo -e "${GREEN}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

log_warn() {
  local msg="[$(date '+%H:%M:%S')] WARNING: $1"
  echo -e "${YELLOW}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

log_error() {
  local msg="[$(date '+%H:%M:%S')] ERROR: $1"
  echo -e "${RED}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

log_sync() {
  local msg="[$(date '+%H:%M:%S')] SYNC: $1"
  echo -e "${BLUE}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

# Build rsync exclude args
build_excludes() {
  local args=()
  for pattern in "${EXCLUDES[@]}"; do
    args+=(--exclude "$pattern")
  done
  echo "${args[@]}"
}

# Check dependencies
check_deps() {
  local missing=()

  if ! command -v rsync &>/dev/null; then
    missing+=("rsync")
  fi

  if ! command -v fswatch &>/dev/null; then
    missing+=("fswatch")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing dependencies: ${missing[*]}"
    echo ""
    echo "Install with:"
    if command -v brew &>/dev/null; then
      echo "  brew install ${missing[*]}"
    else
      echo "  Install Homebrew first: https://brew.sh"
      echo "  Then: brew install ${missing[*]}"
    fi
    exit 1
  fi
}

# Validate paths
validate_paths() {
  if [[ ! -d "$LOCAL_DIR" ]]; then
    log_error "Local directory not found: $LOCAL_DIR"
    exit 1
  fi

  # Create Dropbox sync dir if it doesn't exist
  if [[ ! -d "$DROPBOX_DIR" ]]; then
    log "Creating Dropbox sync directory: $DROPBOX_DIR"
    mkdir -p "$DROPBOX_DIR"
  fi
}

# Acquire lock (prevents overlapping syncs)
acquire_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
      return 1  # Another sync is running
    fi
    rm -f "$LOCK_FILE"  # Stale lock
  fi
  echo $$ > "$LOCK_FILE"
  return 0
}

release_lock() {
  rm -f "$LOCK_FILE"
}

# Sync local -> Dropbox
sync_to_dropbox() {
  if ! acquire_lock; then
    return 0
  fi

  log_sync "Local → Dropbox"
  local excludes
  excludes=$(build_excludes)

  rsync -av --delete \
    $excludes \
    "$LOCAL_DIR/" "$DROPBOX_DIR/" \
    2>> "$LOG_FILE" | tail -n 1 >> "$LOG_FILE" || true

  release_lock
}

# Sync Dropbox -> local
sync_from_dropbox() {
  if ! acquire_lock; then
    return 0
  fi

  log_sync "Dropbox → Local"
  local excludes
  excludes=$(build_excludes)

  rsync -av --delete \
    $excludes \
    "$DROPBOX_DIR/" "$LOCAL_DIR/" \
    2>> "$LOG_FILE" | tail -n 1 >> "$LOG_FILE" || true

  release_lock
}

# Full bidirectional sync (used for initial sync)
full_sync() {
  log "Running full bidirectional sync..."

  # First pull from Dropbox (in case remote has newer changes)
  sync_from_dropbox

  # Then push local to Dropbox
  sync_to_dropbox

  log "Full sync complete."
}

# Watch for local changes and sync to Dropbox
watch_local() {
  log "Watching local: $LOCAL_DIR"

  local exclude_regex=""
  for pattern in "${EXCLUDES[@]}"; do
    local clean="${pattern%/}"  # Remove trailing slash
    if [[ -n "$exclude_regex" ]]; then
      exclude_regex="$exclude_regex|"
    fi
    exclude_regex="$exclude_regex$clean"
  done

  fswatch -r -l "$SYNC_COOLDOWN" \
    --exclude "($exclude_regex)" \
    "$LOCAL_DIR" | while read -r event; do
    log_sync "Local change detected: $(basename "$event")"
    sync_to_dropbox
  done
}

# Watch for Dropbox changes and sync to local
watch_dropbox() {
  log "Watching Dropbox: $DROPBOX_DIR"

  fswatch -r -l "$SYNC_COOLDOWN" \
    "$DROPBOX_DIR" | while read -r event; do
    log_sync "Dropbox change detected: $(basename "$event")"
    sync_from_dropbox
  done
}

# Stop running daemon
stop_daemon() {
  if [[ -f "$PID_FILE" ]]; then
    local pids
    pids=$(cat "$PID_FILE")
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
    rm -f "$PID_FILE"
    rm -f "$LOCK_FILE"
    log "ClaudeSync stopped."
  else
    echo "ClaudeSync is not running."
  fi
}

# Show status
show_status() {
  if [[ -f "$PID_FILE" ]]; then
    local pids
    pids=$(cat "$PID_FILE")
    local running=false
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        running=true
        break
      fi
    done
    if $running; then
      echo -e "${GREEN}ClaudeSync is running${NC} (PIDs: $pids)"
      echo "  Local:   $LOCAL_DIR"
      echo "  Dropbox: $DROPBOX_DIR"
      echo "  Log:     $LOG_FILE"
      return 0
    fi
  fi
  echo -e "${YELLOW}ClaudeSync is not running${NC}"
  return 1
}

# Cleanup on exit
cleanup() {
  log "Shutting down ClaudeSync..."
  rm -f "$LOCK_FILE"
  # Kill child processes
  jobs -p | xargs -r kill 2>/dev/null || true
  rm -f "$PID_FILE"
  log "ClaudeSync stopped."
  exit 0
}

# --- MAIN ---

usage() {
  echo "ClaudeSync - Bidirectional Dropbox Sync"
  echo ""
  echo "Usage: $(basename "$0") <command>"
  echo ""
  echo "Commands:"
  echo "  start      Start watching and syncing (foreground)"
  echo "  daemon     Start as background daemon"
  echo "  stop       Stop the background daemon"
  echo "  status     Show sync status"
  echo "  push       One-time sync: local → Dropbox"
  echo "  pull       One-time sync: Dropbox → local"
  echo "  sync       One-time full bidirectional sync"
  echo ""
}

case "${1:-}" in
  start)
    check_deps
    validate_paths
    trap cleanup SIGINT SIGTERM

    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       ClaudeSync Starting...         ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC} Local:   $LOCAL_DIR"
    echo -e "${GREEN}║${NC} Dropbox: $DROPBOX_DIR"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""

    # Initial full sync
    full_sync

    # Start watchers in background
    watch_local &
    local_pid=$!

    watch_dropbox &
    dropbox_pid=$!

    echo "$local_pid $dropbox_pid $$" > "$PID_FILE"

    log "Watching for changes... (Ctrl+C to stop)"

    # Wait for watchers
    wait
    ;;

  daemon)
    check_deps
    validate_paths

    # Check if already running
    if show_status &>/dev/null; then
      log_warn "ClaudeSync is already running. Stop it first with: $0 stop"
      exit 1
    fi

    log "Starting ClaudeSync daemon..."
    nohup "$0" start >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    log "ClaudeSync daemon started (PID: $!)"
    log "Logs: tail -f $LOG_FILE"
    ;;

  stop)
    stop_daemon
    ;;

  status)
    show_status
    ;;

  push)
    check_deps
    validate_paths
    sync_to_dropbox
    log "Push complete."
    ;;

  pull)
    check_deps
    validate_paths
    sync_from_dropbox
    log "Pull complete."
    ;;

  sync)
    check_deps
    validate_paths
    full_sync
    ;;

  *)
    usage
    exit 1
    ;;
esac
