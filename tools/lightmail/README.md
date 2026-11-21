# LightMail

A native, low-memory Gmail client for macOS. It talks to the Gmail API directly instead of
loading the Gmail web app, which is what makes browser Gmail heavy (300 to 600 MB per signed-in tab).

How it stays light:

- No Gmail web app, no Google JavaScript. The UI is native SwiftUI.
- The inbox list downloads only sender, subject and snippet for about 40 threads.
- Only the conversation you open is downloaded, and it renders in one shared viewer with
  JavaScript turned off.
- Remote images (and tracking pixels) are blocked until you click the photo button.
- Nothing is cached to disk. It checks for new mail every 2 minutes with two tiny API calls per account.

Expect roughly 60 to 120 MB total for all accounts, versus well over 1 GB for three Gmail tabs.
Check it yourself in Activity Monitor: look at LightMail plus its "LightMail Web Content" process.

## 1. One-time Google setup (about 5 minutes)

Gmail only lets an app read your mail through an OAuth "client" you own. You create it once.

1. Go to https://console.cloud.google.com and create a project named **LightMail**.
2. **APIs & Services > Library**: search **Gmail API** and click **Enable**.
3. **Google Auth Platform > Branding** (or **OAuth consent screen**): app name LightMail,
   your email as support and developer contact. Audience: **External**.
4. **Audience**: add your Gmail addresses under **Test users**. Then click
   **Publish app** to move it to **In production**. This matters: in Testing mode Google
   expires your sign-in every 7 days. You do not need to submit it for verification.
5. **Clients > Create client**: type **Desktop app**, name LightMail. Copy the **Client ID** and
   **Client secret**.

When you sign in, Google will warn "Google hasn't verified this app". That's expected for a
personal app. Click **Advanced > Go to LightMail**.

Your Google Workspace account (if any) may need its admin console to allow the app:
Admin console > Security > API controls > App access control.

## 2. Build and install (on the Mac)

```bash
xcode-select --install        # once, if you don't already have the command line tools
cd tools/lightmail
./build.sh
mv LightMail.app /Applications/
```

First launch: right-click LightMail in Applications, choose **Open**, then **Open** again.
Requires macOS 14 Sonoma or newer, Apple Silicon.

## 3. Add your accounts

LightMail > Settings (Cmd-,): paste the Client ID and secret, then click **Add Account**.
Your browser opens Google's sign-in. Pick an account, approve, and you're bounced back.
Repeat for each account.

Sign-in tokens are kept in your macOS Keychain. After you rebuild the app, macOS may ask once
whether LightMail can use its Keychain item. Click **Always Allow**.

## Using it

- Sidebar: **All Inboxes** plus each account, with unread counts. Dock icon shows the total.
- Search box uses normal Gmail search syntax (`from:`, `has:attachment`, `older_than:7d`, ...)
  and searches all mail, not just the inbox.
- Keyboard: Cmd-N new, Cmd-R reply, Cmd-Shift-R reply all, Cmd-Ctrl-A archive,
  Cmd-Delete trash, Cmd-Shift-U mark unread, Cmd-Shift-N check mail, Cmd-Shift-O open in Gmail.
- Right-click a conversation in the list to archive, trash or mark unread without opening it.
- Attachments show as buttons above the message. Clicking one saves it to ~/Downloads and opens it.
- Links open in your default browser.
- To make email links in other apps open LightMail: Mail app > Settings > General > Default email reader.

## What it deliberately doesn't do

Kept out to stay small. For these, the **Open in Gmail** button (Cmd-Shift-O) opens the conversation
in your browser:

- Sending attachments, rich-text formatting, signatures (messages send as plain text)
- Labels, filters, snooze, stars, categories
- Push notifications (the Dock badge is the notification)

Note: the unread count is for the whole Inbox, including Promotions/Social tabs if you use them.
