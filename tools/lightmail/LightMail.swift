// LightMail: a native, low-memory Gmail client for macOS 14+.
//
// Talks to the Gmail API directly instead of loading the Gmail web app.
// Only message lists (metadata) and the thread you open are downloaded.
// Email bodies render in a single shared web view with JavaScript off and
// remote images blocked until you ask for them.

import SwiftUI
import WebKit
import Network
import CryptoKit
import Security

// MARK: - Small helpers

struct AppError: LocalizedError {
    let message: String
    init(_ m: String) { message = m }
    var errorDescription: String? { message }
}

extension Data {
    init?(base64URL s: String) {
        var t = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while t.count % 4 != 0 { t += "=" }
        self.init(base64Encoded: t)
    }
    var base64URL: String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

func decodeText(_ base64url: String) -> String {
    guard let d = Data(base64URL: base64url) else { return "" }
    return String(data: d, encoding: .utf8) ?? String(data: d, encoding: .isoLatin1) ?? ""
}

func escapeHTML(_ s: String) -> String {
    s.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
}

func decodeEntities(_ s: String) -> String {
    var out = s.replacingOccurrences(of: "&amp;", with: "&")
        .replacingOccurrences(of: "&lt;", with: "<")
        .replacingOccurrences(of: "&gt;", with: ">")
        .replacingOccurrences(of: "&quot;", with: "\"")
        .replacingOccurrences(of: "&nbsp;", with: " ")
    guard let re = try? NSRegularExpression(pattern: "&#(\\d+);") else { return out }
    for m in re.matches(in: out, range: NSRange(out.startIndex..., in: out)).reversed() {
        guard let whole = Range(m.range, in: out), let num = Range(m.range(at: 1), in: out),
              let code = UInt32(out[num]), let scalar = Unicode.Scalar(code) else { continue }
        out.replaceSubrange(whole, with: String(Character(scalar)))
    }
    return out
}

func stripTags(_ html: String) -> String {
    let rules: [(String, String)] = [
        ("(?is)<(style|script|head)[^>]*>.*?</\\1>", ""),
        ("(?i)<br\\s*/?>", "\n"),
        ("(?i)</(p|div|tr|li|h[1-6])>", "\n"),
        ("<[^>]+>", ""),
    ]
    var s = html
    for (pattern, replacement) in rules {
        s = s.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
    }
    s = decodeEntities(s)
    s = s.replacingOccurrences(of: "\n[ \t]*\n[ \t\n]*", with: "\n\n", options: .regularExpression)
    return s.trimmed
}

// "Jane Doe" <jane@x.com>  ->  Jane Doe
func senderName(_ h: String) -> String {
    guard let lt = h.firstIndex(of: "<") else { return h.trimmed }
    let name = h[..<lt].trimmingCharacters(in: CharacterSet(charactersIn: "\" \t"))
    if !name.isEmpty { return name }
    return h[h.index(after: lt)...].trimmingCharacters(in: CharacterSet(charactersIn: "<> "))
}

func emailOf(_ s: String) -> String {
    if let a = s.firstIndex(of: "<"), let b = s[a...].firstIndex(of: ">") {
        return String(s[s.index(after: a)..<b]).trimmed.lowercased()
    }
    return s.trimmed.lowercased()
}

// Splits an address list on commas that are not inside quotes or <>.
func splitAddresses(_ s: String) -> [String] {
    var out: [String] = []
    var cur = ""
    var quoted = false, angle = false
    for ch in s {
        if ch == "\"" { quoted.toggle() }
        if ch == "<" { angle = true }
        if ch == ">" { angle = false }
        if ch == ",", !quoted, !angle {
            out.append(cur.trimmed); cur = ""
        } else {
            cur.append(ch)
        }
    }
    out.append(cur.trimmed)
    return out.filter { !$0.isEmpty }
}

func encodeHeaderWord(_ s: String) -> String {
    s.allSatisfy { $0.isASCII } ? s : "=?UTF-8?B?\(Data(s.utf8).base64EncodedString())?="
}

func uniqueDownloadURL(_ name: String) -> URL {
    let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
    let safe = name.replacingOccurrences(of: "/", with: "-")
    var url = dir.appendingPathComponent(safe.isEmpty ? "attachment" : safe)
    let base = url.deletingPathExtension().lastPathComponent, ext = url.pathExtension
    var i = 2
    while FileManager.default.fileExists(atPath: url.path) {
        url = dir.appendingPathComponent(ext.isEmpty ? "\(base) \(i)" : "\(base) \(i).\(ext)")
        i += 1
    }
    return url
}

@MainActor enum Fmt {
    static let time: DateFormatter = { let f = DateFormatter(); f.timeStyle = .short; f.dateStyle = .none; return f }()
    static let monthDay: DateFormatter = { let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("MMMd"); return f }()
    static let short: DateFormatter = { let f = DateFormatter(); f.dateStyle = .short; f.timeStyle = .none; return f }()
    static let full: DateFormatter = { let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short; return f }()
    static let quote: DateFormatter = { let f = DateFormatter(); f.dateFormat = "EEE, MMM d, yyyy 'at' h:mm a"; return f }()

    static func list(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return time.string(from: d) }
        if cal.isDate(d, equalTo: Date(), toGranularity: .year) { return monthDay.string(from: d) }
        return short.string(from: d)
    }
}

// MARK: - Keychain (refresh tokens)

enum Keychain {
    static let service = "local.lightmail"

    private static func base(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func set(_ value: String, for account: String) {
        SecItemDelete(base(account) as CFDictionary)
        var q = base(account)
        q[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(q as CFDictionary, nil)
    }

    static func get(_ account: String) -> String? {
        var q = base(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func delete(_ account: String) {
        SecItemDelete(base(account) as CFDictionary)
    }
}

// MARK: - Google sign-in (OAuth 2.0, loopback redirect + PKCE)

enum Config {
    static var clientID: String { UserDefaults.standard.string(forKey: "clientID")?.trimmed ?? "" }
    static var clientSecret: String { UserDefaults.standard.string(forKey: "clientSecret")?.trimmed ?? "" }
    static let scope = "https://www.googleapis.com/auth/gmail.modify"
}

struct TokenResponse: Decodable {
    let access_token: String
    let expires_in: Int
    let refresh_token: String?
}

func formEncode(_ d: [String: String]) -> Data {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-._~")
    let s = d.map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")" }
    return Data(s.joined(separator: "&").utf8)
}

func tokenRequest(_ form: [String: String]) async throws -> TokenResponse {
    var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
    req.httpMethod = "POST"
    req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    req.httpBody = formEncode(form)
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
        throw AppError("Google sign-in error: \(String(decoding: data, as: UTF8.self))")
    }
    return try JSONDecoder().decode(TokenResponse.self, from: data)
}

// Tiny one-shot HTTP server on 127.0.0.1 that catches Google's redirect.
@MainActor final class Loopback {
    private let listener: NWListener
    private var portContinuation: CheckedContinuation<UInt16, Error>?
    private var codeContinuation: CheckedContinuation<String, Error>?
    private var result: Result<String, Error>?

    init() throws {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: .any)
        listener = try NWListener(using: params)
    }

    func start() async throws -> UInt16 {
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<UInt16, Error>) in
            MainActor.assumeIsolated {
                self.portContinuation = c
                self.listener.stateUpdateHandler = { [weak self] state in
                    MainActor.assumeIsolated { self?.stateChanged(state) }
                }
                self.listener.newConnectionHandler = { [weak self] conn in
                    MainActor.assumeIsolated { self?.accept(conn) }
                }
                self.listener.start(queue: .main)
            }
        }
    }

    func waitForCode() async throws -> String {
        if let result { return try result.get() }
        return try await withCheckedThrowingContinuation { (c: CheckedContinuation<String, Error>) in
            MainActor.assumeIsolated { self.codeContinuation = c }
        }
    }

    func cancel() { finish(.failure(AppError("Sign-in cancelled."))) }

    private func stateChanged(_ state: NWListener.State) {
        switch state {
        case .ready:
            portContinuation?.resume(returning: listener.port?.rawValue ?? 0)
            portContinuation = nil
        case .failed(let e):
            portContinuation?.resume(throwing: e)
            portContinuation = nil
            finish(.failure(e))
        default:
            break
        }
    }

    private func accept(_ conn: NWConnection) {
        conn.start(queue: .main)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] data, _, _, _ in
            MainActor.assumeIsolated {
                let request = data.map { String(decoding: $0, as: UTF8.self) } ?? ""
                let path = request.split(separator: " ").dropFirst().first.map(String.init) ?? "/"
                let items = URLComponents(string: "http://127.0.0.1\(path)")?.queryItems ?? []
                let code = items.first { $0.name == "code" }?.value
                let err = items.first { $0.name == "error" }?.value
                let message = code != nil
                    ? "Signed in. You can close this tab and go back to LightMail."
                    : "Sign-in failed: \(escapeHTML(err ?? "unknown error"))"
                let status = (code != nil || err != nil) ? "200 OK" : "404 Not Found"
                let response = "HTTP/1.1 \(status)\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n"
                    + "<html><body style=\"font:16px -apple-system;padding:40px\">\(message)</body></html>"
                conn.send(content: Data(response.utf8), completion: .contentProcessed { _ in conn.cancel() })
                if let code { self?.finish(.success(code)) }
                else if let err { self?.finish(.failure(AppError("Google sign-in: \(err)"))) }
            }
        }
    }

    private func finish(_ r: Result<String, Error>) {
        listener.cancel()
        if let c = codeContinuation {
            codeContinuation = nil
            c.resume(with: r)
        } else if result == nil {
            result = r
        }
    }
}

// MARK: - Gmail API models

struct GHeader: Decodable { let name: String; let value: String }
struct GBody: Decodable { let size: Int?; let data: String?; let attachmentId: String? }
struct GPart: Decodable {
    let mimeType: String?
    let filename: String?
    let headers: [GHeader]?
    let body: GBody?
    let parts: [GPart]?
}
struct GMessage: Decodable {
    let id: String
    let threadId: String?
    let labelIds: [String]?
    let snippet: String?
    let internalDate: String?
    let payload: GPart?

    func header(_ n: String) -> String? {
        payload?.headers?.first { $0.name.caseInsensitiveCompare(n) == .orderedSame }?.value
    }
    var date: Date { Date(timeIntervalSince1970: (Double(internalDate ?? "") ?? 0) / 1000) }
    var isUnread: Bool { labelIds?.contains("UNREAD") == true }
}
struct GThread: Decodable { let id: String; let messages: [GMessage]? }
struct GThreadRef: Decodable { let id: String }
struct GThreadList: Decodable { let threads: [GThreadRef]?; let nextPageToken: String? }
struct GLabel: Decodable { let id: String; let messagesUnread: Int?; let threadsUnread: Int? }
struct GProfile: Decodable { let emailAddress: String }
struct GSendAs: Decodable { let sendAsEmail: String; let displayName: String? }
struct GSendAsList: Decodable { let sendAs: [GSendAs]? }
struct GAttachment: Decodable { let data: String? }

// MARK: - App models

struct ThreadSummary: Identifiable, Hashable {
    var id: String { account + "|" + threadId }
    let account: String
    let threadId: String
    let from: String
    let subject: String
    let snippet: String
    let date: Date
    var unread: Bool
    let count: Int
}

struct AttachmentRef: Identifiable, Hashable {
    let id: String
    let messageID: String
    let filename: String
    let size: Int
}

struct MessageDetail {
    var id = ""
    var from = "", to = "", cc = "", replyTo = ""
    var date = Date()
    var messageIDHeader: String?
    var references: String?
    var html: String?
    var text: String?
    var unread = false
    var attachments: [AttachmentRef] = []

    var plainText: String { text ?? stripTags(html ?? "") }
}

struct ThreadDetail {
    let account: String
    let threadId: String
    let subject: String
    let messages: [MessageDetail]
    var attachments: [AttachmentRef] { messages.flatMap(\.attachments) }
}

struct Draft: Identifiable {
    let id = UUID()
    var from: String
    var to = ""
    var cc = ""
    var subject = ""
    var body = ""
    var threadId: String?
    var inReplyTo: String?
    var references: String?
}

enum Sidebar: Hashable {
    case all
    case account(String)
}

// MARK: - Gmail client (one per account)

@MainActor final class Gmail {
    var email: String
    var sendAsName: String?
    private let refreshToken: String
    private var accessToken: String?
    private var expiry = Date.distantPast
    private var refreshTask: Task<String, Error>?

    init(email: String, refreshToken: String, accessToken: String? = nil, expiresIn: Int = 0) {
        self.email = email
        self.refreshToken = refreshToken
        self.accessToken = accessToken
        if accessToken != nil { expiry = Date().addingTimeInterval(Double(expiresIn)) }
    }

    func token() async throws -> String {
        if let t = accessToken, expiry > Date().addingTimeInterval(60) { return t }
        if let task = refreshTask { return try await task.value }
        let task = Task<String, Error> { [self] in
            let r = try await tokenRequest([
                "client_id": Config.clientID, "client_secret": Config.clientSecret,
                "refresh_token": refreshToken, "grant_type": "refresh_token",
            ])
            self.accessToken = r.access_token
            self.expiry = Date().addingTimeInterval(Double(r.expires_in))
            return r.access_token
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    func data(_ path: String, method: String = "GET", query: [URLQueryItem] = [],
              json: [String: Any]? = nil) async throws -> Data {
        var c = URLComponents(string: "https://gmail.googleapis.com/gmail/v1/users/me/" + path)!
        if !query.isEmpty {
            c.queryItems = query
            c.percentEncodedQuery = c.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        }
        var req = URLRequest(url: c.url!)
        req.httpMethod = method
        let tok = try await token()
        req.setValue("Bearer \(tok)", forHTTPHeaderField: "Authorization")
        if let json {
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (d, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { accessToken = nil }
        guard (200..<300).contains(status) else {
            var msg = String(decoding: d, as: UTF8.self)
            if let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
               let e = obj["error"] as? [String: Any], let m = e["message"] as? String { msg = m }
            throw AppError("Gmail (\(status)): \(msg)")
        }
        return d
    }

    func get<T: Decodable>(_ type: T.Type, _ path: String, _ query: [URLQueryItem] = []) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await data(path, query: query))
    }

    func loadProfile() async throws {
        email = try await get(GProfile.self, "profile").emailAddress
    }

    func loadSendAs() async {
        guard let list = try? await get(GSendAsList.self, "settings/sendAs") else { return }
        let me = email.lowercased()
        sendAsName = list.sendAs?.first { $0.sendAsEmail.lowercased() == me }?.displayName
        if sendAsName?.isEmpty == true { sendAsName = nil }
    }

    func inboxUnread() async throws -> Int {
        let l = try await get(GLabel.self, "labels/INBOX")
        return l.threadsUnread ?? l.messagesUnread ?? 0
    }

    func listThreads(query: String, pageToken: String?, max: Int) async throws -> ([String], String?) {
        var q = [URLQueryItem(name: "maxResults", value: "\(max)")]
        if query.isEmpty { q.append(URLQueryItem(name: "labelIds", value: "INBOX")) }
        else { q.append(URLQueryItem(name: "q", value: query)) }
        if let pageToken { q.append(URLQueryItem(name: "pageToken", value: pageToken)) }
        let r = try await get(GThreadList.self, "threads", q)
        return ((r.threads ?? []).map(\.id), r.nextPageToken)
    }

    func summary(_ id: String) async throws -> ThreadSummary? {
        let t = try await get(GThread.self, "threads/\(id)", [
            URLQueryItem(name: "format", value: "metadata"),
            URLQueryItem(name: "metadataHeaders", value: "From"),
            URLQueryItem(name: "metadataHeaders", value: "Subject"),
        ])
        let msgs = t.messages ?? []
        guard let first = msgs.first, let last = msgs.last else { return nil }
        let subject = first.header("Subject")?.trimmed ?? ""
        return ThreadSummary(
            account: email, threadId: t.id,
            from: senderName(last.header("From") ?? ""),
            subject: subject.isEmpty ? "(no subject)" : subject,
            snippet: decodeEntities(last.snippet ?? ""),
            date: last.date,
            unread: msgs.contains { $0.isUnread },
            count: msgs.count)
    }

    // Fetch summaries 10 at a time to stay under Gmail's per-user concurrency limit.
    func summaries(_ ids: [String]) async -> [ThreadSummary] {
        var out = [ThreadSummary?](repeating: nil, count: ids.count)
        for start in stride(from: 0, to: ids.count, by: 10) {
            let chunk = Array(ids[start..<min(start + 10, ids.count)])
            await withTaskGroup(of: (Int, ThreadSummary?).self) { group in
                for (offset, id) in chunk.enumerated() {
                    group.addTask { (start + offset, try? await self.summary(id)) }
                }
                for await (i, s) in group { out[i] = s }
            }
        }
        return out.compactMap { $0 }
    }

    func thread(_ id: String) async throws -> ThreadDetail {
        let t = try await get(GThread.self, "threads/\(id)", [URLQueryItem(name: "format", value: "full")])
        let msgs = t.messages ?? []
        var details: [MessageDetail] = []
        for m in msgs {
            var d = MessageDetail()
            d.id = m.id
            d.from = m.header("From") ?? ""
            d.to = m.header("To") ?? ""
            d.cc = m.header("Cc") ?? ""
            d.replyTo = m.header("Reply-To") ?? ""
            d.messageIDHeader = m.header("Message-ID") ?? m.header("Message-Id")
            d.references = m.header("References")
            d.date = m.date
            d.unread = m.isUnread
            if let p = m.payload { Gmail.walk(p, messageID: m.id, into: &d) }
            details.append(d)
        }
        let subject = msgs.first?.header("Subject")?.trimmed ?? ""
        return ThreadDetail(account: email, threadId: t.id,
                            subject: subject.isEmpty ? "(no subject)" : subject, messages: details)
    }

    private static func walk(_ p: GPart, messageID: String, into m: inout MessageDetail) {
        let mime = (p.mimeType ?? "").lowercased()
        if let name = p.filename, !name.isEmpty, let att = p.body?.attachmentId {
            m.attachments.append(AttachmentRef(id: att, messageID: messageID, filename: name, size: p.body?.size ?? 0))
            return
        }
        if mime == "text/html", m.html == nil, let d = p.body?.data { m.html = decodeText(d) }
        else if mime == "text/plain", m.text == nil, let d = p.body?.data { m.text = decodeText(d) }
        for c in p.parts ?? [] { walk(c, messageID: messageID, into: &m) }
    }

    func modify(_ threadId: String, add: [String], remove: [String]) async throws {
        _ = try await data("threads/\(threadId)/modify", method: "POST",
                           json: ["addLabelIds": add, "removeLabelIds": remove])
    }

    func trash(_ threadId: String) async throws {
        _ = try await data("threads/\(threadId)/trash", method: "POST")
    }

    func attachment(_ a: AttachmentRef) async throws -> Data {
        let r = try await get(GAttachment.self, "messages/\(a.messageID)/attachments/\(a.id)")
        guard let s = r.data, let d = Data(base64URL: s) else { throw AppError("Attachment was empty.") }
        return d
    }

    func send(_ d: Draft) async throws {
        var h: [String] = []
        h.append("From: " + (sendAsName.map { "\(encodeHeaderWord($0)) <\(email)>" } ?? email))
        h.append("To: \(d.to.trimmed)")
        if !d.cc.trimmed.isEmpty { h.append("Cc: \(d.cc.trimmed)") }
        h.append("Subject: \(encodeHeaderWord(d.subject))")
        if let r = d.inReplyTo {
            h.append("In-Reply-To: \(r)")
            h.append("References: \(d.references ?? r)")
        }
        h.append("MIME-Version: 1.0")
        h.append("Content-Type: text/plain; charset=UTF-8")
        h.append("Content-Transfer-Encoding: base64")
        let body = Data(d.body.utf8).base64EncodedString(
            options: [.lineLength76Characters, .endLineWithCarriageReturn, .endLineWithLineFeed])
        let raw = h.joined(separator: "\r\n") + "\r\n\r\n" + body
        var json: [String: Any] = ["raw": Data(raw.utf8).base64URL]
        if let t = d.threadId { json["threadId"] = t }
        _ = try await data("messages/send", method: "POST", json: json)
    }
}

// MARK: - App state

typealias Page = ([ThreadSummary], String?)

@MainActor final class Store: ObservableObject {
    @Published var accounts: [String] = UserDefaults.standard.stringArray(forKey: "accounts") ?? []
    @Published var unread: [String: Int] = [:]
    @Published var sidebar: Sidebar? = .all {
        didSet { if sidebar != oldValue { selectedID = nil; reloadList() } }
    }
    @Published var threads: [ThreadSummary] = []
    @Published var nextPage: String?
    @Published var selectedID: String? {
        didSet { if selectedID != oldValue { openSelected() } }
    }
    @Published var detail: ThreadDetail?
    @Published var detailLoading = false
    @Published var loading = false
    @Published var search = "" {
        didSet { if search.isEmpty && !oldValue.isEmpty { reloadList() } }
    }
    @Published var compose: Draft?
    @Published var loadImages = false
    @Published var errorMessage: String?
    @Published var signingIn = false

    private var clients: [String: Gmail] = [:]
    private var loopback: Loopback?
    private var listGen = 0
    private var detailGen = 0
    private var pagesLoaded = 1
    private var timer: Timer?
    private var started = false

    var hasClientConfig: Bool { !Config.clientID.isEmpty && !Config.clientSecret.isEmpty }
    var totalUnread: Int { accounts.reduce(0) { $0 + (unread[$1] ?? 0) } }

    var currentAccount: String? {
        if case .account(let e)? = sidebar { return e }
        return accounts.first
    }

    private var currentClients: [Gmail] {
        if case .account(let e)? = sidebar { return clients[e].map { [$0] } ?? [] }
        return accounts.compactMap { clients[$0] }
    }

    private var isSingleAccountView: Bool {
        if case .account? = sidebar { return true }
        return false
    }

    func start() {
        guard !started else { return }
        started = true
        var missing: [String] = []
        for e in accounts {
            if let rt = Keychain.get(e) {
                let g = Gmail(email: e, refreshToken: rt)
                clients[e] = g
                Task { await g.loadSendAs() }
            } else {
                missing.append(e)
            }
        }
        if !missing.isEmpty {
            errorMessage = "Sign in again for: \(missing.joined(separator: ", ")) (Settings > Remove, then Add Account)."
        }
        reloadList()
        refreshCounts()
        timer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.poll() }
        }
    }

    // MARK: Lists and counts

    private func poll() {
        refreshCounts()
        if search.isEmpty && pagesLoaded == 1 { reloadList(silent: true) }
    }

    func refreshAll() {
        refreshCounts()
        reloadList()
    }

    func refreshCounts() {
        for (e, g) in clients { refreshCount(e, g) }
    }

    private func refreshCount(_ email: String, _ g: Gmail? = nil) {
        guard let g = g ?? clients[email] else { return }
        Task {
            if let n = try? await g.inboxUnread() {
                unread[email] = n
                NSApp.dockTile.badgeLabel = totalUnread > 0 ? "\(totalUnread)" : nil
            }
        }
    }

    private func fetchPage(_ g: Gmail, query: String, token: String?, max: Int) async throws -> Page {
        let (ids, next) = try await g.listThreads(query: query, pageToken: token, max: max)
        return (await g.summaries(ids), next)
    }

    func reloadList(silent: Bool = false) {
        guard !accounts.isEmpty else { threads = []; return }
        listGen += 1
        let gen = listGen
        let targets = currentClients
        let single = isSingleAccountView
        let query = search.trimmed
        if !silent { loading = true }
        Task {
            let results = await withTaskGroup(of: (String, Result<Page, Error>).self) { group -> [(String, Result<Page, Error>)] in
                for g in targets {
                    let email = g.email
                    group.addTask {
                        do { return (email, .success(try await self.fetchPage(g, query: query, token: nil, max: single ? 40 : 25))) }
                        catch { return (email, .failure(error)) }
                    }
                }
                var out: [(String, Result<Page, Error>)] = []
                for await r in group { out.append(r) }
                return out
            }
            guard gen == listGen else { return }
            var all: [ThreadSummary] = []
            var next: String?
            var errors: [String] = []
            for (email, r) in results {
                switch r {
                case .success(let page):
                    all += page.0
                    if single { next = page.1 }
                case .failure(let e):
                    errors.append("\(email): \(e.localizedDescription)")
                }
            }
            threads = all.sorted { $0.date > $1.date }
            nextPage = next
            pagesLoaded = 1
            loading = false
            if !errors.isEmpty && !silent { errorMessage = errors.joined(separator: "\n") }
        }
    }

    func loadMore() {
        guard case .account(let e)? = sidebar, let g = clients[e], let token = nextPage else { return }
        let gen = listGen
        let query = search.trimmed
        loading = true
        Task {
            do {
                let page = try await fetchPage(g, query: query, token: token, max: 40)
                guard gen == listGen else { return }
                let have = Set(threads.map(\.id))
                threads += page.0.filter { !have.contains($0.id) }
                nextPage = page.1
                pagesLoaded += 1
            } catch {
                errorMessage = error.localizedDescription
            }
            loading = false
        }
    }

    // MARK: Reading

    private func openSelected() {
        guard let id = selectedID, let t = threads.first(where: { $0.id == id }), let g = clients[t.account] else {
            if selectedID == nil { detail = nil }
            return
        }
        detailGen += 1
        let gen = detailGen
        detailLoading = true
        Task {
            do {
                let d = try await g.thread(t.threadId)
                guard gen == detailGen else { return }
                loadImages = UserDefaults.standard.bool(forKey: "alwaysImages")
                detail = d
                detailLoading = false
                if t.unread {
                    try? await g.modify(t.threadId, add: [], remove: ["UNREAD"])
                    if let i = threads.firstIndex(where: { $0.id == id }) { threads[i].unread = false }
                    refreshCount(t.account)
                }
            } catch {
                detailLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }

    var renderedHTML: String {
        guard let d = detail else { return "" }
        return renderThread(d, allowImages: loadImages)
    }

    func download(_ a: AttachmentRef) {
        guard let d = detail, let g = clients[d.account] else { return }
        Task {
            do {
                let data = try await g.attachment(a)
                let url = uniqueDownloadURL(a.filename)
                try data.write(to: url)
                NSWorkspace.shared.open(url)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func openInGmail() {
        guard let d = detail else { return }
        let who = d.account.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? d.account
        if let url = URL(string: "https://mail.google.com/mail/u/?authuser=\(who)#all/\(d.threadId)") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: Actions

    private func act(_ id: String?, removeFromList: Bool,
                     _ op: @escaping @MainActor (Gmail, String) async throws -> Void) {
        guard let id = id ?? selectedID, let idx = threads.firstIndex(where: { $0.id == id }),
              let g = clients[threads[idx].account] else { return }
        let t = threads[idx]
        if removeFromList {
            threads.remove(at: idx)
            if selectedID == id {
                selectedID = threads.indices.contains(idx) ? threads[idx].id : threads.last?.id
                if selectedID == nil { detail = nil }
            }
        }
        Task {
            do {
                try await op(g, t.threadId)
                refreshCount(t.account)
            } catch {
                errorMessage = error.localizedDescription
                reloadList(silent: true)
            }
        }
    }

    func archive(_ id: String? = nil) {
        act(id, removeFromList: true) { g, t in try await g.modify(t, add: [], remove: ["INBOX"]) }
    }

    func trash(_ id: String? = nil) {
        act(id, removeFromList: true) { g, t in try await g.trash(t) }
    }

    func markUnread(_ id: String? = nil) {
        guard let id = id ?? selectedID else { return }
        if let i = threads.firstIndex(where: { $0.id == id }) { threads[i].unread = true }
        act(id, removeFromList: false) { g, t in try await g.modify(t, add: ["UNREAD"], remove: []) }
        if selectedID == id { selectedID = nil }
    }

    // MARK: Composing

    func newMessage() {
        guard let from = currentAccount else { return }
        compose = Draft(from: from)
    }

    func composeMailto(_ url: URL) {
        guard url.scheme?.lowercased() == "mailto", let from = currentAccount else { return }
        let c = URLComponents(url: url, resolvingAgainstBaseURL: false)
        var d = Draft(from: from, to: c?.path ?? "")
        for q in c?.queryItems ?? [] {
            switch q.name.lowercased() {
            case "subject": d.subject = q.value ?? ""
            case "body": d.body = q.value ?? ""
            case "cc": d.cc = q.value ?? ""
            default: break
            }
        }
        compose = d
    }

    func reply(all: Bool) {
        guard let d = detail, let m = d.messages.last else { return }
        let me = d.account.lowercased()
        var to: [String]
        var cc: [String] = []
        if emailOf(m.from) == me {
            to = splitAddresses(m.to)
            if all { cc = splitAddresses(m.cc) }
        } else {
            to = [m.replyTo.isEmpty ? m.from : m.replyTo]
            if all { to += splitAddresses(m.to); cc = splitAddresses(m.cc) }
        }
        var seen: Set<String> = [me]
        to = to.filter { seen.insert(emailOf($0)).inserted }
        cc = cc.filter { seen.insert(emailOf($0)).inserted }
        if to.isEmpty { to = [m.from] }

        let subject = d.subject.lowercased().hasPrefix("re:") ? d.subject : "Re: \(d.subject)"
        let quoted = m.plainText.components(separatedBy: "\n").map { "> " + $0 }.joined(separator: "\n")
        let body = "\n\nOn \(Fmt.quote.string(from: m.date)), \(m.from) wrote:\n\(quoted)"
        let refs = [m.references, m.messageIDHeader].compactMap { $0 }.joined(separator: " ")
        compose = Draft(from: d.account, to: to.joined(separator: ", "), cc: cc.joined(separator: ", "),
                        subject: subject, body: body, threadId: d.threadId,
                        inReplyTo: m.messageIDHeader, references: refs.isEmpty ? nil : refs)
    }

    func send(_ d: Draft) async throws {
        guard let g = clients[d.from] else { throw AppError("\(d.from) is not signed in.") }
        try await g.send(d)
        if let t = d.threadId, detail?.threadId == t, detail?.account == d.from,
           let fresh = try? await g.thread(t) {
            detail = fresh
        }
    }

    // MARK: Accounts

    func addAccount() {
        guard hasClientConfig, !signingIn else { return }
        signingIn = true
        Task {
            defer { signingIn = false; loopback = nil }
            do {
                let lb = try Loopback()
                loopback = lb
                let port = try await lb.start()
                let redirect = "http://127.0.0.1:\(port)"
                let verifierChars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
                let verifier = String((0..<64).map { _ in verifierChars.randomElement()! })
                let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
                var c = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
                c.queryItems = [
                    URLQueryItem(name: "client_id", value: Config.clientID),
                    URLQueryItem(name: "redirect_uri", value: redirect),
                    URLQueryItem(name: "response_type", value: "code"),
                    URLQueryItem(name: "scope", value: Config.scope),
                    URLQueryItem(name: "access_type", value: "offline"),
                    URLQueryItem(name: "prompt", value: "consent select_account"),
                    URLQueryItem(name: "code_challenge", value: challenge),
                    URLQueryItem(name: "code_challenge_method", value: "S256"),
                ]
                NSWorkspace.shared.open(c.url!)
                let code = try await lb.waitForCode()
                let tok = try await tokenRequest([
                    "code": code, "client_id": Config.clientID, "client_secret": Config.clientSecret,
                    "redirect_uri": redirect, "grant_type": "authorization_code", "code_verifier": verifier,
                ])
                guard let refresh = tok.refresh_token else {
                    throw AppError("Google did not return a refresh token. Remove LightMail at myaccount.google.com/permissions and try again.")
                }
                let g = Gmail(email: "", refreshToken: refresh, accessToken: tok.access_token, expiresIn: tok.expires_in)
                try await g.loadProfile()
                Keychain.set(refresh, for: g.email)
                clients[g.email] = g
                if !accounts.contains(g.email) {
                    accounts.append(g.email)
                    UserDefaults.standard.set(accounts, forKey: "accounts")
                }
                await g.loadSendAs()
                NSApp.activate(ignoringOtherApps: true)
                refreshAll()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func cancelSignIn() { loopback?.cancel() }

    func remove(_ email: String) {
        if let rt = Keychain.get(email) {
            var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/revoke")!)
            req.httpMethod = "POST"
            req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            req.httpBody = formEncode(["token": rt])
            URLSession.shared.dataTask(with: req).resume()
        }
        Keychain.delete(email)
        clients[email] = nil
        unread[email] = nil
        accounts.removeAll { $0 == email }
        UserDefaults.standard.set(accounts, forKey: "accounts")
        if sidebar == .account(email) { sidebar = .all } else { reloadList() }
        NSApp.dockTile.badgeLabel = totalUnread > 0 ? "\(totalUnread)" : nil
    }
}

// MARK: - Message rendering

let mailCSS = """
:root{color-scheme:light}
body{font:13px -apple-system,Helvetica,sans-serif;margin:0;background:#fff;color:#1d1d1f}
details{border-bottom:1px solid #e6e6e6;padding:10px 18px}
summary{list-style:none;outline:none;cursor:default}
summary::-webkit-details-marker{display:none}
.f{font-weight:600}
.d{color:#888;float:right;font-size:12px}
.t{color:#888;font-size:12px;margin-top:2px}
.b{margin-top:12px;overflow-x:auto}
.p{white-space:pre-wrap;word-wrap:break-word}
img{max-width:100%;height:auto}
"""

@MainActor func renderThread(_ t: ThreadDetail, allowImages: Bool) -> String {
    let csp = allowImages
        ? "default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src *"
        : "default-src 'none'; img-src data:; style-src 'unsafe-inline'"
    var s = "<!doctype html><html><head><meta charset=\"utf-8\">"
        + "<meta http-equiv=\"Content-Security-Policy\" content=\"\(csp)\">"
        + "<style>\(mailCSS)</style></head><body>"
    for (i, m) in t.messages.enumerated() {
        let open = (i == t.messages.count - 1 || m.unread) ? " open" : ""
        let cc = m.cc.isEmpty ? "" : ", cc " + escapeHTML(m.cc)
        s += "<details\(open)><summary><span class=\"f\">\(escapeHTML(senderName(m.from)))</span>"
            + "<span class=\"d\">\(escapeHTML(Fmt.full.string(from: m.date)))</span>"
            + "<div class=\"t\">to \(escapeHTML(m.to))\(cc)</div></summary><div class=\"b\">"
        s += m.html ?? "<div class=\"p\">\(escapeHTML(m.text ?? ""))</div>"
        s += "</div></details>"
    }
    return s + "</body></html>"
}

struct MailWebView: NSViewRepresentable {
    let html: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.defaultWebpagePreferences.allowsContentJavaScript = false
        cfg.websiteDataStore = .nonPersistent()
        cfg.suppressesIncrementalRendering = true
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.navigationDelegate = context.coordinator
        return wv
    }

    func updateNSView(_ wv: WKWebView, context: Context) {
        guard context.coordinator.lastHTML != html else { return }
        context.coordinator.lastHTML = html
        wv.loadHTMLString(html, baseURL: nil)
    }

    @MainActor final class Coordinator: NSObject, WKNavigationDelegate {
        var lastHTML = ""

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.navigationType == .linkActivated, let url = action.request.url {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

// MARK: - Views

struct ContentView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 170, ideal: 210)
        } content: {
            ThreadListView()
                .navigationSplitViewColumnWidth(min: 280, ideal: 360)
        } detail: {
            DetailView()
        }
        .sheet(item: $store.compose) { draft in
            ComposeView(draft: draft)
        }
        .alert("LightMail", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
        .onOpenURL { store.composeMailto($0) }
        .task { store.start() }
    }
}

struct SidebarView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        List(selection: $store.sidebar) {
            if store.accounts.count > 1 {
                Label("All Inboxes", systemImage: "tray.2")
                    .badge(store.totalUnread)
                    .tag(Sidebar.all)
            }
            Section("Accounts") {
                ForEach(store.accounts, id: \.self) { email in
                    Label(email, systemImage: "tray")
                        .lineLimit(1)
                        .badge(store.unread[email] ?? 0)
                        .tag(Sidebar.account(email))
                }
            }
        }
        .overlay {
            if store.accounts.isEmpty {
                VStack(spacing: 10) {
                    Text("No accounts yet").foregroundStyle(.secondary)
                    SettingsLink { Text("Open Settings…") }
                }
            }
        }
    }
}

struct ThreadListView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        List(selection: $store.selectedID) {
            ForEach(store.threads) { t in
                ThreadRow(t: t, showAccount: store.accounts.count > 1 && store.sidebar == .all)
                    .contextMenu {
                        Button("Archive") { store.archive(t.id) }
                        Button("Move to Trash") { store.trash(t.id) }
                        Button("Mark as Unread") { store.markUnread(t.id) }
                    }
            }
            if store.nextPage != nil {
                Button("Load more") { store.loadMore() }
                    .buttonStyle(.link)
                    .frame(maxWidth: .infinity)
            }
        }
        .overlay {
            if store.loading && store.threads.isEmpty { ProgressView() }
            else if !store.loading && store.threads.isEmpty && !store.accounts.isEmpty {
                Text(store.search.isEmpty ? "Inbox is empty" : "No results").foregroundStyle(.secondary)
            }
        }
        .searchable(text: $store.search, placement: .toolbar, prompt: "Search mail")
        .onSubmit(of: .search) { store.reloadList() }
        .toolbar {
            ToolbarItemGroup {
                if store.loading { ProgressView().controlSize(.small) }
                Button { store.refreshAll() } label: { Label("Refresh", systemImage: "arrow.clockwise") }
                Button { store.newMessage() } label: { Label("New Message", systemImage: "square.and.pencil") }
                    .disabled(store.accounts.isEmpty)
            }
        }
    }
}

struct ThreadRow: View {
    let t: ThreadSummary
    let showAccount: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if t.unread { Circle().fill(Color.accentColor).frame(width: 7, height: 7) }
                Text(t.from).fontWeight(t.unread ? .semibold : .regular).lineLimit(1)
                if t.count > 1 { Text("\(t.count)").foregroundStyle(.secondary) }
                Spacer()
                Text(Fmt.list(t.date)).font(.caption).foregroundStyle(.secondary)
            }
            Text(t.subject).fontWeight(t.unread ? .semibold : .regular).lineLimit(1)
            Text(t.snippet).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            if showAccount {
                Text(t.account).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
            }
        }
        .padding(.vertical, 3)
    }
}

struct DetailView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        if let d = store.detail {
            VStack(spacing: 0) {
                HStack {
                    Text(d.subject).font(.title3).bold().textSelection(.enabled).lineLimit(2)
                    Spacer()
                    if store.detailLoading { ProgressView().controlSize(.small) }
                }
                .padding(.horizontal, 18).padding(.vertical, 10)
                if !d.attachments.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(d.attachments) { a in
                                Button { store.download(a) } label: {
                                    Label("\(a.filename)  \(ByteCountFormatter.string(fromByteCount: Int64(a.size), countStyle: .file))",
                                          systemImage: "paperclip")
                                }
                            }
                        }
                        .padding(.horizontal, 18).padding(.bottom, 8)
                    }
                }
                Divider()
                MailWebView(html: store.renderedHTML)
            }
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button { store.reply(all: false) } label: { Label("Reply", systemImage: "arrowshape.turn.up.left") }
                    Button { store.reply(all: true) } label: { Label("Reply All", systemImage: "arrowshape.turn.up.left.2") }
                    Button { store.archive() } label: { Label("Archive", systemImage: "archivebox") }
                    Button { store.trash() } label: { Label("Trash", systemImage: "trash") }
                    Button { store.markUnread() } label: { Label("Mark Unread", systemImage: "envelope.badge") }
                    Toggle(isOn: $store.loadImages) { Label("Load Images", systemImage: "photo") }
                    Button { store.openInGmail() } label: { Label("Open in Gmail", systemImage: "safari") }
                }
            }
        } else if store.detailLoading {
            ProgressView()
        } else {
            Text("No conversation selected").foregroundStyle(.secondary)
        }
    }
}

struct ComposeView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Draft
    @State private var sending = false
    @State private var error: String?

    init(draft: Draft) { _draft = State(initialValue: draft) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if store.accounts.count > 1 && draft.threadId == nil {
                Picker("From", selection: $draft.from) {
                    ForEach(store.accounts, id: \.self) { Text($0).tag($0) }
                }
            } else {
                Text("From: \(draft.from)").foregroundStyle(.secondary)
            }
            TextField("To", text: $draft.to)
            TextField("Cc", text: $draft.cc)
            TextField("Subject", text: $draft.subject)
            TextEditor(text: $draft.body)
                .font(.body)
                .frame(minHeight: 260)
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.secondary.opacity(0.3)))
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
            HStack {
                Button("Discard", role: .cancel) { dismiss() }
                Spacer()
                Button(sending ? "Sending…" : "Send") { send() }
                    .keyboardShortcut(.return, modifiers: .command)
                    .disabled(sending || draft.to.trimmed.isEmpty)
            }
        }
        .textFieldStyle(.roundedBorder)
        .padding()
        .frame(width: 640, height: 540)
    }

    private func send() {
        sending = true
        error = nil
        Task {
            do {
                try await store.send(draft)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                sending = false
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var store: Store
    @AppStorage("clientID") private var clientID = ""
    @AppStorage("clientSecret") private var clientSecret = ""
    @AppStorage("alwaysImages") private var alwaysImages = false

    var body: some View {
        Form {
            Section("Google OAuth client (Desktop app)") {
                TextField("Client ID", text: $clientID)
                SecureField("Client secret", text: $clientSecret)
                Text("One-time setup. See README.md for the five-minute Google Cloud steps.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Section("Accounts") {
                ForEach(store.accounts, id: \.self) { email in
                    HStack {
                        Text(email)
                        Spacer()
                        Button("Remove") { store.remove(email) }
                    }
                }
                if store.signingIn {
                    HStack {
                        ProgressView().controlSize(.small)
                        Text("Finish signing in in your browser…")
                        Spacer()
                        Button("Cancel") { store.cancelSignIn() }
                    }
                } else {
                    Button("Add Account…") { store.addAccount() }
                        .disabled(clientID.trimmed.isEmpty || clientSecret.trimmed.isEmpty)
                }
            }
            Section("Reading") {
                Toggle("Always load remote images", isOn: $alwaysImages)
                Text("Off saves memory and blocks tracking pixels. You can load images per message from the toolbar.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 520, height: 460)
    }
}

// MARK: - App

@main
struct LightMailApp: App {
    @StateObject private var store = Store()

    var body: some Scene {
        Window("LightMail", id: "main") {
            ContentView().environmentObject(store)
        }
        .defaultSize(width: 1200, height: 780)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Message") { store.newMessage() }
                    .keyboardShortcut("n")
                    .disabled(store.accounts.isEmpty)
            }
            CommandMenu("Message") {
                let noThread = store.detail == nil || store.compose != nil
                Button("Reply") { store.reply(all: false) }
                    .keyboardShortcut("r").disabled(noThread)
                Button("Reply All") { store.reply(all: true) }
                    .keyboardShortcut("r", modifiers: [.command, .shift]).disabled(noThread)
                Divider()
                Button("Archive") { store.archive() }
                    .keyboardShortcut("a", modifiers: [.command, .control]).disabled(noThread)
                Button("Move to Trash") { store.trash() }
                    .keyboardShortcut(.delete, modifiers: .command).disabled(noThread)
                Button("Mark as Unread") { store.markUnread() }
                    .keyboardShortcut("u", modifiers: [.command, .shift]).disabled(noThread)
                Divider()
                Button("Open in Gmail") { store.openInGmail() }
                    .keyboardShortcut("o", modifiers: [.command, .shift]).disabled(store.detail == nil)
                Button("Check for New Mail") { store.refreshAll() }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
            }
        }

        Settings {
            SettingsView().environmentObject(store)
        }
    }
}
