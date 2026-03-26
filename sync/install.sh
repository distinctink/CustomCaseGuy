#!/bin/bash
# ============================================================
# ClaudeSync Installer
# Sets up bidirectional sync and optional auto-start on macOS
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/claudesync.sh"
CONFIG_FILE="$SCRIPT_DIR/sync-config.sh"
LOCAL_CONFIG="$SCRIPT_DIR/sync-config.local.sh"
PLIST_NAME="com.claudesync.watcher"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/$PLIST_NAME.plist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ClaudeSync Installer             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# Make scripts executable
chmod +x "$SYNC_SCRIPT"

# Check for fswatch
if ! command -v fswatch &>/dev/null; then
  echo -e "${YELLOW}fswatch not found. Installing via Homebrew...${NC}"
  if ! command -v brew &>/dev/null; then
    echo -e "${RED}Homebrew not installed. Install it first: https://brew.sh${NC}"
    exit 1
  fi
  brew install fswatch
fi

# Detect local project path
DETECTED_PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo -e "Detected project directory: ${GREEN}$DETECTED_PROJECT${NC}"

# Ask for Dropbox path
echo ""
echo "Where is your Dropbox --ClaudeSync folder?"
echo -e "  Default: ${YELLOW}/Volumes/External Drive/Dropbox/--ClaudeSync/CustomCaseGuy${NC}"
echo ""
read -rp "Dropbox path (press Enter for default): " dropbox_input

DROPBOX_PATH="${dropbox_input:-/Volumes/External Drive/Dropbox/--ClaudeSync/CustomCaseGuy}"

# Create local config override
cat > "$LOCAL_CONFIG" << EOF
#!/bin/bash
# Local machine config (not committed to git)
LOCAL_DIR="$DETECTED_PROJECT"
DROPBOX_DIR="$DROPBOX_PATH"
EOF

echo ""
echo -e "${GREEN}Local config saved to: $LOCAL_CONFIG${NC}"
echo "  LOCAL_DIR=$DETECTED_PROJECT"
echo "  DROPBOX_DIR=$DROPBOX_PATH"

# Create Dropbox directory if needed
if [[ ! -d "$DROPBOX_PATH" ]]; then
  echo ""
  read -rp "Dropbox folder doesn't exist yet. Create it? [Y/n] " create_dir
  if [[ "${create_dir:-Y}" =~ ^[Yy] ]]; then
    mkdir -p "$DROPBOX_PATH"
    echo -e "${GREEN}Created: $DROPBOX_PATH${NC}"
  fi
fi

# Ask about LaunchAgent (auto-start on login)
echo ""
read -rp "Install LaunchAgent to auto-start on login? [Y/n] " install_agent

if [[ "${install_agent:-Y}" =~ ^[Yy] ]]; then
  mkdir -p "$PLIST_DIR"

  # Unload existing if present
  if [[ -f "$PLIST_FILE" ]]; then
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
  fi

  cat > "$PLIST_FILE" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SYNC_SCRIPT</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/claudesync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claudesync-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST

  launchctl load "$PLIST_FILE"
  echo -e "${GREEN}LaunchAgent installed and started!${NC}"
  echo "  ClaudeSync will now auto-start on login."
  echo ""
  echo "  Manage with:"
  echo "    launchctl stop $PLIST_NAME    # pause"
  echo "    launchctl start $PLIST_NAME   # resume"
  echo "    launchctl unload $PLIST_FILE  # disable auto-start"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo "Usage:"
echo "  ./sync/claudesync.sh start    # Run in foreground"
echo "  ./sync/claudesync.sh daemon   # Run in background"
echo "  ./sync/claudesync.sh stop     # Stop background daemon"
echo "  ./sync/claudesync.sh status   # Check if running"
echo "  ./sync/claudesync.sh push     # One-time: local → Dropbox"
echo "  ./sync/claudesync.sh pull     # One-time: Dropbox → local"
echo "  ./sync/claudesync.sh sync     # One-time: full bidirectional"
echo ""
echo "Logs: tail -f /tmp/claudesync.log"
