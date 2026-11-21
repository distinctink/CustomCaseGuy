// LightMail: a minimal multi-account Gmail window for macOS 14+.
// One window, one tab per account, each account in its own isolated
// cookie store so every account stays signed in at the same time.
// Uses the system WebKit (same engine as Safari), no bundled browser.

import Cocoa
import WebKit

let safariUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15"
let gmailHome = URL(string: "https://mail.google.com/mail/u/0/")!
let defaults = UserDefaults.standard

// Hosts that belong inside the app when the main page navigates.
func isGoogleHost(_ url: URL) -> Bool {
    guard let h = url.host?.lowercased() else { return false }
    if h == "www.google.com" && url.path == "/url" { return false } // outbound link redirector
    return h == "google.com" || h.hasSuffix(".google.com")
        || h.hasSuffix(".googleusercontent.com") || h.hasSuffix(".gstatic.com")
}

// Hosts that may open as an in-app popup window (print view, compose pop-out, sign-in).
func isPopupHost(_ url: URL) -> Bool {
    guard let h = url.host?.lowercased() else { return false }
    return h == "mail.google.com" || h == "accounts.google.com" || h.hasSuffix(".googleusercontent.com")
}

func isBlank(_ url: URL?) -> Bool {
    guard let s = url?.absoluteString else { return true }
    return s.isEmpty || s == "about:blank"
}

// MARK: - Downloads (attachments go straight to ~/Downloads)

@MainActor final class Downloads: NSObject, WKDownloadDelegate {
    static let shared = Downloads()
    private var destinations: [ObjectIdentifier: URL] = [:]

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
        let name = suggestedFilename.isEmpty ? "download" : suggestedFilename
        var url = dir.appendingPathComponent(name)
        let base = url.deletingPathExtension().lastPathComponent
        let ext = url.pathExtension
        var i = 2
        while FileManager.default.fileExists(atPath: url.path) {
            url = dir.appendingPathComponent(ext.isEmpty ? "\(base) \(i)" : "\(base) \(i).\(ext)")
            i += 1
        }
        destinations[ObjectIdentifier(download)] = url
        completionHandler(url)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let url = destinations.removeValue(forKey: ObjectIdentifier(download)) {
            // Bounces the Downloads stack in the Dock, same as Safari.
            DistributedNotificationCenter.default().post(
                name: Notification.Name("com.apple.DownloadFileFinished"), object: url.path)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        destinations.removeValue(forKey: ObjectIdentifier(download))
        NSSound.beep()
    }
}

// MARK: - Shared web view behavior

var openPopups: [Popup] = []

@MainActor class WebHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        guard let url = action.request.url else { decisionHandler(.allow); return }
        let scheme = url.scheme?.lowercased() ?? ""
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        // Clicked links that leave Google open in your default browser.
        if mainFrame, action.navigationType == .linkActivated,
           scheme == "http" || scheme == "https", !isGoogleHost(url) {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        if !["http", "https", "about", "blob", "data"].contains(scheme) {
            NSWorkspace.shared.open(url) // tel:, facetime:, zoommtg:, etc.
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disp = (response.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?.lowercased() ?? ""
        if disp.hasPrefix("attachment") || !response.canShowMIMEType {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = Downloads.shared
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = Downloads.shared
    }

    // target=_blank / window.open
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, !isBlank(url), !isPopupHost(url) {
            NSWorkspace.shared.open(url)
            return nil
        }
        let w = windowFeatures.width?.doubleValue ?? 960
        let h = windowFeatures.height?.doubleValue ?? 760
        return Popup(configuration: configuration, size: NSSize(width: w, height: h)).webView
    }

    // File picker for attaching files.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        if let win = webView.window {
            alert.beginSheetModal(for: win) { _ in completionHandler() }
        } else {
            alert.runModal()
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        if let win = webView.window {
            alert.beginSheetModal(for: win) { r in completionHandler(r == .alertFirstButtonReturn) }
        } else {
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }
    }

    func webViewDidClose(_ webView: WKWebView) {}
}

// MARK: - Popup windows (print, compose pop-out, Google sign-in)

@MainActor final class Popup: WebHandler, NSWindowDelegate {
    let webView: WKWebView
    private let size: NSSize
    private var window: NSWindow?
    private var titleObs: NSKeyValueObservation?

    init(configuration: WKWebViewConfiguration, size: NSSize) {
        self.size = size
        webView = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: configuration)
        super.init()
        webView.customUserAgent = safariUA
        webView.navigationDelegate = self
        webView.uiDelegate = self
        openPopups.append(self)
        // If it never navigates anywhere useful, throw it away.
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 15_000_000_000)
            if let self, self.window == nil { self.dispose() }
        }
    }

    override func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                          decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard window == nil, let url = action.request.url, !isBlank(url) else {
            super.webView(webView, decidePolicyFor: action, decisionHandler: decisionHandler)
            return
        }
        // First real navigation decides: Gmail stays in-app, everything else goes to the browser.
        if isPopupHost(url) {
            showWindow()
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            dispose()
        }
    }

    private func showWindow() {
        let win = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                           styleMask: [.titled, .closable, .miniaturizable, .resizable],
                           backing: .buffered, defer: false)
        win.isReleasedWhenClosed = false
        win.delegate = self
        webView.frame = win.contentView!.bounds
        webView.autoresizingMask = [.width, .height]
        win.contentView!.addSubview(webView)
        win.cascadeTopLeft(from: NSApp.mainWindow?.frame.origin ?? .zero)
        win.center()
        win.makeKeyAndOrderFront(nil)
        window = win
        titleObs = webView.observe(\.title, options: [.new]) { [weak self] wv, _ in
            MainActor.assumeIsolated { self?.window?.title = wv.title ?? "" }
        }
    }

    override func webViewDidClose(_ webView: WKWebView) {
        if let window { window.close() } else { dispose() }
    }

    func windowWillClose(_ notification: Notification) { dispose() }

    private func dispose() {
        titleObs = nil
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        openPopups.removeAll { $0 === self }
    }
}

// MARK: - One Gmail account

@MainActor final class Account: WebHandler {
    let index: Int
    let webView: WKWebView
    private(set) var email: String?
    private(set) var unread = 0
    var onChange: (@MainActor () -> Void)?
    private var titleObs: NSKeyValueObservation?

    init(index: Int) {
        self.index = index
        let config = WKWebViewConfiguration()
        // Fixed per-slot ID so each account keeps its own persistent cookies across launches.
        let id = UUID(uuidString: String(format: "6C1A11A0-0000-4000-8000-%012d", index))!
        config.websiteDataStore = WKWebsiteDataStore(forIdentifier: id)
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.customUserAgent = safariUA // Google refuses sign-in from "embedded" browsers otherwise
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        titleObs = webView.observe(\.title, options: [.new]) { [weak self] _, _ in
            MainActor.assumeIsolated { self?.titleChanged() }
        }
        webView.load(URLRequest(url: gmailHome))
    }

    var displayName: String {
        if let nick = defaults.string(forKey: "name\(index + 1)"), !nick.isEmpty { return nick }
        return email ?? "Account \(index + 1)"
    }

    // Gmail titles look like "Inbox (12) - you@example.com - Gmail".
    private func titleChanged() {
        let t = webView.title ?? ""
        if let e = Account.matches(#"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"#, in: t).last {
            email = e
        }
        if t.hasPrefix("Inbox") {
            if let n = Account.matches(#"^Inbox \(([\d,]+)\)"#, in: t, group: 1).first {
                unread = Int(n.replacingOccurrences(of: ",", with: "")) ?? unread
            } else {
                unread = 0
            }
        }
        onChange?()
        refreshUnread()
    }

    // Accurate unread inbox count regardless of which view is open.
    func refreshUnread() {
        guard webView.url?.host == "mail.google.com" else { return }
        let js = """
        try {
          const r = await fetch('/mail/u/0/feed/atom', {credentials: 'include', cache: 'no-store'});
          if (!r.ok) return -1;
          const t = await r.text();
          const m = t.match(/<fullcount>(\\d+)<\\/fullcount>/);
          return m ? parseInt(m[1], 10) : -1;
        } catch (e) { return -1; }
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self, case .success(let value) = result,
                  let n = (value as? NSNumber)?.intValue, n >= 0, n != self.unread else { return }
            self.unread = n
            self.onChange?()
        }
    }

    static func matches(_ pattern: String, in s: String, group: Int = 0) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).compactMap {
            Range($0.range(at: group), in: s).map { String(s[$0]) }
        }
    }
}

// MARK: - Main window

@MainActor final class MainWindow: NSObject, NSWindowDelegate, NSToolbarDelegate {
    static let pickerID = NSToolbarItem.Identifier("accounts")
    let window: NSWindow
    let accounts: [Account]
    private let picker = NSSegmentedControl()
    private var accountMenuItems: [NSMenuItem] = []
    private(set) var selected = 0
    private var zoom: Double = defaults.object(forKey: "zoom") as? Double ?? 1.0

    override init() {
        let count = max(1, min(9, defaults.object(forKey: "accounts") as? Int ?? 3))
        accounts = (0..<count).map { Account(index: $0) }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        super.init()

        window.title = "LightMail"
        window.titleVisibility = .hidden
        window.toolbarStyle = .unifiedCompact
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.minSize = NSSize(width: 640, height: 420)
        window.center()
        window.setFrameAutosaveName("LightMailMain")

        let content = NSView(frame: window.contentRect(forFrameRect: window.frame))
        window.contentView = content
        for a in accounts {
            a.webView.frame = content.bounds
            a.webView.autoresizingMask = [.width, .height]
            a.webView.pageZoom = zoom
            content.addSubview(a.webView)
            a.onChange = { [weak self] in self?.refreshLabels() }
        }

        picker.segmentCount = count
        picker.trackingMode = .selectOne
        picker.target = self
        picker.action = #selector(pickerChanged(_:))

        let toolbar = NSToolbar(identifier: "LightMailToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar

        refreshLabels()
        select(min(defaults.integer(forKey: "selected"), count - 1))

        Timer.scheduledTimer(timeInterval: 60, target: self, selector: #selector(tick),
                             userInfo: nil, repeats: true)
    }

    // Toolbar: a single centered account switcher.
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, MainWindow.pickerID, .flexibleSpace]
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier,
                 willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        guard id == MainWindow.pickerID else { return nil }
        let item = NSToolbarItem(itemIdentifier: id)
        item.label = "Accounts"
        item.view = picker
        return item
    }

    func refreshLabels() {
        for (i, a) in accounts.enumerated() {
            let label = a.unread > 0 ? "\(a.displayName)   \(a.unread)" : a.displayName
            picker.setLabel(label, forSegment: i)
            picker.setWidth(0, forSegment: i)
            if i < accountMenuItems.count { accountMenuItems[i].title = a.displayName }
        }
        picker.sizeToFit()
        let total = accounts.reduce(0) { $0 + $1.unread }
        NSApp.dockTile.badgeLabel = total > 0 ? "\(total)" : nil
    }

    func select(_ i: Int) {
        guard accounts.indices.contains(i) else { return }
        selected = i
        for (j, a) in accounts.enumerated() { a.webView.isHidden = (j != i) }
        picker.selectedSegment = i
        window.makeFirstResponder(accounts[i].webView)
        defaults.set(i, forKey: "selected")
        accounts[i].refreshUnread()
    }

    func show() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // mailto: links from other apps open a compose window in the current account.
    func compose(_ mailto: URL) {
        show()
        let enc = mailto.absoluteString.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        if let url = URL(string: "https://mail.google.com/mail/u/0/?extsrc=mailto&url=\(enc)") {
            accounts[selected].webView.load(URLRequest(url: url))
        }
    }

    // Closing the window just hides it, so badges keep updating.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        window.orderOut(nil)
        return false
    }

    @objc func tick() { accounts.forEach { $0.refreshUnread() } }
    @objc func pickerChanged(_ sender: NSSegmentedControl) { select(sender.selectedSegment) }
    @objc func selectAccount(_ sender: NSMenuItem) { select(sender.tag); show() }
    @objc func reload(_ sender: Any?) { accounts[selected].webView.reload() }
    @objc func goHome(_ sender: Any?) { accounts[selected].webView.load(URLRequest(url: gmailHome)) }
    @objc func goBack(_ sender: Any?) { accounts[selected].webView.goBack() }
    @objc func goForward(_ sender: Any?) { accounts[selected].webView.goForward() }
    @objc func zoomIn(_ sender: Any?) { setZoom(zoom + 0.1) }
    @objc func zoomOut(_ sender: Any?) { setZoom(zoom - 0.1) }
    @objc func zoomReset(_ sender: Any?) { setZoom(1.0) }

    private func setZoom(_ z: Double) {
        zoom = min(2.0, max(0.5, (z * 10).rounded() / 10))
        accounts.forEach { $0.webView.pageZoom = zoom }
        defaults.set(zoom, forKey: "zoom")
    }

    func makeViewMenu() -> NSMenu {
        let m = NSMenu(title: "View")
        func add(_ title: String, _ sel: Selector, _ key: String,
                 _ mods: NSEvent.ModifierFlags = .command) {
            let item = m.addItem(withTitle: title, action: sel, keyEquivalent: key)
            item.keyEquivalentModifierMask = mods
            item.target = self
        }
        add("Reload", #selector(reload(_:)), "r")
        add("Inbox", #selector(goHome(_:)), "i", [.command, .shift])
        add("Back", #selector(goBack(_:)), "[")
        add("Forward", #selector(goForward(_:)), "]")
        m.addItem(.separator())
        add("Actual Size", #selector(zoomReset(_:)), "0")
        add("Zoom In", #selector(zoomIn(_:)), "=")
        add("Zoom Out", #selector(zoomOut(_:)), "-")
        m.addItem(.separator())
        for (i, a) in accounts.enumerated() {
            let item = m.addItem(withTitle: a.displayName, action: #selector(selectAccount(_:)),
                                 keyEquivalent: "\(i + 1)")
            item.tag = i
            item.target = self
            accountMenuItems.append(item)
        }
        return m
    }
}

// MARK: - App

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    var main: MainWindow?
    private var pending: [URL] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        let mw = MainWindow()
        main = mw
        buildMenu(mw)
        mw.show()
        pending.forEach { mw.compose($0) }
        pending.removeAll()
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme?.lowercased() == "mailto" {
            if let main { main.compose(url) } else { pending.append(url) }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        main?.show()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    private func buildMenu(_ mw: MainWindow) {
        let bar = NSMenu()

        let app = NSMenu(title: "LightMail")
        app.addItem(withTitle: "About LightMail",
                    action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide LightMail", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(withTitle: "Hide Others",
                    action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
            .keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All",
                    action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit LightMail", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Without an Edit menu, copy/paste shortcuts do nothing in a web view.
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
            .keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Paste and Match Style",
                     action: #selector(NSTextView.pasteAsPlainText(_:)), keyEquivalent: "v")
            .keyEquivalentModifierMask = [.command, .option, .shift]
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let win = NSMenu(title: "Window")
        win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        win.addItem(.separator())
        win.addItem(withTitle: "Bring All to Front",
                    action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        for menu in [app, edit, mw.makeViewMenu(), win] {
            let item = NSMenuItem()
            item.submenu = menu
            bar.addItem(item)
        }
        NSApp.windowsMenu = win
        NSApp.mainMenu = bar
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    withExtendedLifetime(delegate) { app.run() }
}
