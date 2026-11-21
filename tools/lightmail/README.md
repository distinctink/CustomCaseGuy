# LightMail

A tiny native Mac window for Gmail. One window, one tab per account, each account in its
own isolated cookie store so all of them stay signed in at once. It runs on the system
WebKit (Safari's engine), so there is no bundled browser. The app binary is a few hundred KB.

## Build and install (on the Mac Studio)

```bash
xcode-select --install        # once, if you don't already have the command line tools
cd tools/lightmail
./build.sh
mv LightMail.app /Applications/
```

The first time you open it, macOS may say it's from an unidentified developer.
Right-click LightMail in Applications, choose **Open**, then **Open** again. You only do this once.

Requires macOS 14 Sonoma or newer, Apple Silicon.

## First run

Each tab starts at the Gmail sign-in page. Sign into a different account in each tab.
The tab labels change to the account's address once you're signed in.

## What it does

- **Account switcher** in the toolbar, with unread counts. Also **Cmd-1 / Cmd-2 / Cmd-3**.
- **Dock badge** with the total unread across all accounts (refreshes every minute).
- **Closing the window hides it**, so badges keep updating. Click the Dock icon to bring it back. Cmd-Q quits.
- **Links in emails** open in your default browser.
- **Attachments** download straight to ~/Downloads.
- **Print, compose pop-out, Google sign-in** open in small in-app windows.
- **Zoom**: Cmd-= / Cmd-- / Cmd-0, remembered across launches.
- **Reload** Cmd-R, **back to Inbox** Cmd-Shift-I, **Back/Forward** Cmd-[ / Cmd-].
- **mailto: links** from other apps open a Gmail compose in the current account,
  once you set LightMail as the default email reader (Mail app > Settings > General > Default email reader).

## Settings (Terminal, then relaunch)

```bash
defaults write local.lightmail accounts -int 4         # number of account tabs (default 3)
defaults write local.lightmail name1 "Distinct Ink"    # short tab name for tab 1 (name2, name3, ...)
defaults delete local.lightmail name1                  # back to showing the email address
```

## Removing an account's login

Each tab's data lives in WebKit's per-app storage. To reset everything, quit LightMail and run:

```bash
rm -rf ~/Library/WebKit/local.lightmail ~/Library/Caches/local.lightmail
```
