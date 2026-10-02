import Foundation

// This is a transport allowlist, not an authorization check. WOVO's existing
// content endpoint must validate its session or signed capability on every GET.
enum WovoDownloadPolicy {
    static let maximumBytes: Int64 = 256 * 1024 * 1024
    static let maximumArtifactBytes: Int64 = 20 * 1024 * 1024
    static let maximumTextBytes: Int64 = 800_000
    static let maximumSeconds: TimeInterval = 60

    enum Format: String {
        case mp4, mp3, wav, png, txt
        var filename: String { "WOVO-export.\(rawValue)" }
    }

    static func kind(for url: URL) -> String? {
        guard WovoNavigationPolicy.isStudio(url), url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.percentEncodedPath == url.path else { return nil }
        let path = url.path.split(separator: "/", omittingEmptySubsequences: false)
        if path.count == 5, path[0].isEmpty, path[1] == "api", path[2] == "generations",
           path[4] == "artifact", isArtifactJobId(String(path[3])) {
            guard let items = components.queryItems, items.count == 1,
                  items[0].name == "organizationId", let organizationId = items[0].value,
                  isOrganizationId(organizationId),
                  components.percentEncodedQuery == "organizationId=\(organizationId)" else { return nil }
            return "artifact"
        }
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

    // Match the current generation API's UUID version/variant and organization
    // identifier contract. Encoded path/query aliases are rejected above.
    private static func isArtifactJobId(_ value: String) -> Bool {
        value.utf8.count == 36 && value.range(of:
            "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func isOrganizationId(_ value: String) -> Bool {
        (1...128).contains(value.utf8.count) && value.utf8.allSatisfy {
            (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95
        }
    }

    static func mayStart(url: URL, topLevel: URL?, source: URL?, mainSource: Bool, mainTarget: Bool,
                         explicitLink: Bool, downloadAttribute: Bool, method: String?) -> Bool {
        explicitLink && downloadAttribute && mainSource && mainTarget && method == "GET"
            && topLevel.map(WovoNavigationPolicy.isStudio) == true
            && source.map(WovoNavigationPolicy.isStudio) == true && kind(for: url) != nil
    }

    static func format(request: URL, response: URL?, status: Int, mime: String?, length: Int64) -> Format? {
        guard response == request, status == 200, length > 0, length <= maximumBytes,
              let kind = kind(for: request), let rawMime = mime?.lowercased() else { return nil }
        // Current artifacts use the complete Content-Type header. Do not erase
        // a non-UTF-8 charset by passing URLResponse.mimeType for this route.
        let mime = kind == "artifact" ? rawMime.split(separator: ";", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: ";") : rawMime
        switch (kind, mime) {
        case ("artifact", "video/mp4") where length <= maximumArtifactBytes: return .mp4
        case ("artifact", "image/png") where length <= maximumArtifactBytes: return .png
        case ("artifact", "text/plain;charset=utf-8"): return length <= maximumTextBytes ? .txt : nil
        case ("video", "video/mp4"): return .mp4
        case ("music", "audio/mpeg"): return .mp3
        case ("music", "audio/wav"), ("music", "audio/x-wav"), ("music", "audio/wave"): return .wav
        default: return nil
        }
    }

    static func matchesHeader(_ bytes: Data, format: Format, request: URL? = nil, length: Int64? = nil) -> Bool {
        let prefix = Array(bytes.prefix(24))
        switch format {
        case .png: return prefix.count >= 8 && Array(prefix.prefix(8)) == [137, 80, 78, 71, 13, 10, 26, 10]
        case .txt: return matchesText(bytes)
        case .mp4:
            if let request = request, kind(for: request) == "artifact" {
                guard prefix.count >= 24, let length = length, length >= 24, length <= maximumArtifactBytes,
                      Array(prefix[4..<8]) == Array("ftyp".utf8),
                      ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].contains(String(decoding: prefix[8..<12], as: UTF8.self)) else { return false }
                let boxSize = prefix[0..<4].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
                return boxSize >= 16 && Int64(boxSize) <= length
            }
            return prefix.count >= 12 && Array(prefix[4..<8]) == Array("ftyp".utf8)
        case .wav: return prefix.count >= 12 && Array(prefix[0..<4]) == Array("RIFF".utf8) && Array(prefix[8..<12]) == Array("WAVE".utf8)
        case .mp3: return prefix.count >= 3 && (Array(prefix[0..<3]) == Array("ID3".utf8) || (prefix[0] == 0xff && (prefix[1] & 0xe0) == 0xe0))
        }
    }

    // Called with the complete bounded file, never only its initial prefix.
    static func matchesText(_ bytes: Data) -> Bool {
        guard !bytes.isEmpty, Int64(bytes.count) <= maximumTextBytes,
              let text = String(data: bytes, encoding: .utf8) else { return false }
        return text.unicodeScalars.allSatisfy {
            $0.value == 9 || $0.value == 10 || $0.value == 13
                || ($0.value >= 32 && !((127...159).contains($0.value)))
        }
    }
}
