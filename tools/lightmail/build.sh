#!/bin/bash
# Builds LightMail.app next to this script. Needs Xcode Command Line Tools
# (run `xcode-select --install` once if swiftc is missing).
set -euo pipefail
cd "$(dirname "$0")"

APP="LightMail.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "Compiling..."
swiftc -O -swift-version 5 -target arm64-apple-macos14.0 \
  -framework Cocoa -framework WebKit \
  main.swift -o "$APP/Contents/MacOS/LightMail"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>LightMail</string>
  <key>CFBundleDisplayName</key><string>LightMail</string>
  <key>CFBundleIdentifier</key><string>local.lightmail</string>
  <key>CFBundleExecutable</key><string>LightMail</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key><string>Email Address</string>
      <key>CFBundleURLSchemes</key><array><string>mailto</string></array>
    </dict>
  </array>
</dict>
</plist>
PLIST

echo "Making icon..."
if swift makeicon.swift "$APP/Contents/Resources" >/dev/null 2>&1; then :; else echo "  (icon skipped)"; fi

codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
echo "Built $(pwd)/$APP"
echo "Install with:  mv \"$(pwd)/$APP\" /Applications/"
