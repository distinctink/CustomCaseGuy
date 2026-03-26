#!/bin/bash
# ============================================================
# ClaudeSync Configuration
# Bidirectional sync between local project and Dropbox
# ============================================================

# --- EDIT THESE PATHS FOR EACH COMPUTER ---

# Local project directory (where this repo lives)
LOCAL_DIR="$HOME/CustomCaseGuy"

# Dropbox sync folder (shared between computers)
DROPBOX_DIR="/Volumes/External Drive/Dropbox/--ClaudeSync/CustomCaseGuy"

# --- SYNC SETTINGS ---

# Cooldown in seconds after a change before syncing (debounce)
SYNC_COOLDOWN=2

# Lock file to prevent overlapping syncs
LOCK_FILE="/tmp/claudesync.lock"

# Log file
LOG_FILE="/tmp/claudesync.log"

# PID file for stopping the daemon
PID_FILE="/tmp/claudesync.pid"

# Exclude patterns for rsync (files/dirs to NOT sync)
EXCLUDES=(
  ".git/"
  "node_modules/"
  ".next/"
  "out/"
  "build/"
  ".DS_Store"
  ".env"
  ".env*.local"
  "*.pem"
  ".vercel/"
  "coverage/"
  ".pnp*"
  ".yarn/install-state.gz"
  "npm-debug.log*"
  "yarn-debug.log*"
  "yarn-error.log*"
  "*.tsbuildinfo"
  "next-env.d.ts"
  "/tmp/"
  "sync/sync-config.local.sh"
)
