import Foundation

// This is a transport allowlist, not an authorization check. WOVO's existing
// content endpoint must validate its session or signed capability on every GET.
enum WovoDownloadPolicy {
    static let maximumBytes: Int64 = 256 * 1024 * 1024
    static let maximumSeconds: TimeInterval = 60

    enum Format: String {
        case mp4, mp3, wav
        var filename: String { "WOVO-export.\(rawValue)" }
    }

    static func kind(for url: URL) -> String? {
        guard WovoNavigationPolicy.isStudio(url), url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.percentEncodedPath == url.path else { return nil }
        let path = url.path.split(separator: "/", omittingEmptySubsequences: false)
        guard path.count == 5, path[0].isEmpty, path[1] == "api", path[2] == "wovo",
              path[3] == "video" || path[3] == "music", UUID(uuidString: String(path[4])) != nil else { return nil }
        let items = components.queryItems ?? []
        var query: [String: String] = [:]
        for item in items {
            guard ["content", "expires", "signature", "scene"].contains(item.name),
                  query[item.name] == nil, let value = item.value else { return nil }
            query[item.name] = value
        }
        guard query["content"] == "1" else { return nil }
        if let scene = query["scene"] {
            guard path[3] == "video", let number = Int(scene), (0...35).contains(number), String(number) == scene else { return nil }
        }
        if query["expires"] != nil || query["signature"] != nil {
            guard let expires = query["expires"], let number = Int64(expires), number > 0, String(number) == expires,
                  let signature = query["signature"], (40...60).contains(signature.count),
                  signature.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95 }) else { return nil }
        }
        return String(path[3])
    }

    static func mayStart(url: URL, topLevel: URL?, source: URL?, mainSource: Bool, mainTarget: Bool,
                         explicitLink: Bool, downloadAttribute: Bool, method: String?) -> Bool {
        explicitLink && downloadAttribute && mainSource && mainTarget && method == "GET"
            && topLevel.map(WovoNavigationPolicy.isStudio) == true
            && source.map(WovoNavigationPolicy.isStudio) == true && kind(for: url) != nil
    }

    static func format(request: URL, response: URL?, status: Int, mime: String?, length: Int64) -> Format? {
        guard response == request, status == 200, length > 0, length <= maximumBytes,
              let kind = kind(for: request), let mime = mime?.lowercased() else { return nil }
        switch (kind, mime) {
        case ("video", "video/mp4"): return .mp4
        case ("music", "audio/mpeg"): return .mp3
        case ("music", "audio/wav"), ("music", "audio/x-wav"), ("music", "audio/wave"): return .wav
        default: return nil
        }
    }

    static func matchesHeader(_ bytes: Data, format: Format) -> Bool {
        let prefix = Array(bytes.prefix(16))
        switch format {
        case .mp4: return prefix.count >= 12 && Array(prefix[4..<8]) == Array("ftyp".utf8)
        case .wav: return prefix.count >= 12 && Array(prefix[0..<4]) == Array("RIFF".utf8) && Array(prefix[8..<12]) == Array("WAVE".utf8)
        case .mp3: return prefix.count >= 3 && (Array(prefix[0..<3]) == Array("ID3".utf8) || (prefix[0] == 0xff && (prefix[1] & 0xe0) == 0xe0))
        }
    }
}
