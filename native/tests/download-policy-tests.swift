import Foundation

@main struct DownloadPolicyTests {
    static func main() {
        let id = "12345678-1234-4234-8234-123456789abc"
        let base = "https://wovomedia.com/api/wovo/video/\(id)?content=1"
        let url = URL(string: base)!
        let studio = URL(string: "https://wovomedia.com/library")!
        let signature = String(repeating: "a", count: 43)
        let valid = [base, base + "&expires=2000000000&signature=\(signature)", base + "&scene=0", base + "&scene=35", base.replacingOccurrences(of: "/video/", with: "/music/")]
        for value in valid { precondition(WovoDownloadPolicy.kind(for: URL(string: value)!) != nil, "Expected export allowlist entry") }
        let invalid = [
            "http://wovomedia.com/api/wovo/video/\(id)?content=1", base.replacingOccurrences(of: "wovomedia.com", with: "wovomedia.com.evil.test"),
            base.replacingOccurrences(of: "wovomedia.com", with: "user@wovomedia.com"), base.replacingOccurrences(of: "wovomedia.com", with: "wovomedia.com:8443"),
            base.replacingOccurrences(of: "/video/", with: "/image/"), base.replacingOccurrences(of: id, with: "not-a-job"),
            base.replacingOccurrences(of: "/video/", with: "/%76ideo/"), base.replacingOccurrences(of: "?content=1", with: "/?content=1"),
            base.replacingOccurrences(of: "content=1", with: "content=0"), base + "&content=1", base + "&unknown=1", base + "#download",
            base + "&expires=2000000000", base + "&signature=\(signature)", base + "&expires=1&signature=short",
            base + "&expires=-1&signature=\(signature)", base + "&expires=01&signature=\(signature)", base + "&scene=36",
            base + "&scene=-1", base + "&scene=01", base.replacingOccurrences(of: "/video/", with: "/music/") + "&scene=0",
            "blob:https://wovomedia.com/\(id)", "file:///tmp/movie.mp4", "https://storage.example.test/export.mp4"
        ]
        for value in invalid { precondition(WovoDownloadPolicy.kind(for: URL(string: value)!) == nil, "Unexpected export allowlist entry") }
        precondition(WovoDownloadPolicy.mayStart(url: url, topLevel: studio, source: studio, mainSource: true, mainTarget: true, explicitLink: true, downloadAttribute: true, method: "GET"))
        for failure in 0..<7 {
            precondition(!WovoDownloadPolicy.mayStart(url: url,
                topLevel: failure == 0 ? URL(string: "capacitor://localhost") : studio,
                source: failure == 1 ? URL(string: "https://external.example") : studio,
                mainSource: failure != 2, mainTarget: failure != 3, explicitLink: failure != 4,
                downloadAttribute: failure != 5, method: failure == 6 ? "POST" : "GET"))
        }
        precondition(WovoDownloadPolicy.format(request: url, response: url, status: 200, mime: "video/mp4", length: 100) == .mp4)
        for status in [206, 301, 401, 403, 500] { precondition(WovoDownloadPolicy.format(request: url, response: url, status: status, mime: "video/mp4", length: 100) == nil) }
        for length in [Int64(-1), 0, WovoDownloadPolicy.maximumBytes + 1] { precondition(WovoDownloadPolicy.format(request: url, response: url, status: 200, mime: "video/mp4", length: length) == nil) }
        for mime in ["text/html", "application/json", "application/octet-stream", "audio/mpeg"] { precondition(WovoDownloadPolicy.format(request: url, response: url, status: 200, mime: mime, length: 100) == nil) }
        precondition(WovoDownloadPolicy.format(request: url, response: studio, status: 200, mime: "video/mp4", length: 100) == nil)
        let music = URL(string: base.replacingOccurrences(of: "/video/", with: "/music/"))!
        precondition(WovoDownloadPolicy.format(request: music, response: music, status: 200, mime: "audio/mpeg", length: 100) == .mp3)
        precondition(WovoDownloadPolicy.format(request: music, response: music, status: 200, mime: "audio/wav", length: 100) == .wav)
        precondition(WovoDownloadPolicy.matchesHeader(Data([0,0,0,20] + Array("ftypisom".utf8)), format: .mp4))
        precondition(WovoDownloadPolicy.matchesHeader(Data("RIFFabcdWAVE".utf8), format: .wav))
        precondition(WovoDownloadPolicy.matchesHeader(Data("ID3".utf8), format: .mp3))
        precondition(WovoDownloadPolicy.matchesHeader(Data([0xff,0xfb,0x90]), format: .mp3))
        for format in [WovoDownloadPolicy.Format.mp4, .mp3, .wav] {
            precondition(!WovoDownloadPolicy.matchesHeader(Data(), format: format))
            precondition(!WovoDownloadPolicy.matchesHeader(Data("<!doctype html>".utf8), format: format))
            precondition(!format.filename.contains("/"))
        }
        print("Native download policy assertions passed (origin, intent, response, bounds and byte headers).")
    }
}
