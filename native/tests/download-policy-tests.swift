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
        let artifactBase = "https://wovomedia.com/api/generations/\(id)/artifact?organizationId=org_Wovo-1"
        let artifact = URL(string: artifactBase)!
        let artifactValid = [artifactBase, artifactBase.replacingOccurrences(of: id, with: id.uppercased()),
            artifactBase.replacingOccurrences(of: "-4234-", with: "-1234-"), artifactBase.replacingOccurrences(of: "-4234-", with: "-8234-"),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "a"),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: String(repeating: "A", count: 128))]
        for value in artifactValid {
            precondition(WovoDownloadPolicy.kind(for: URL(string: value)!) == "artifact", "Expected canonical current artifact route")
        }
        let artifactInvalid = [
            artifactBase.replacingOccurrences(of: "https:", with: "http:"),
            artifactBase.replacingOccurrences(of: "wovomedia.com", with: "wovomedia.com.evil.test"),
            artifactBase.replacingOccurrences(of: "wovomedia.com", with: "user@wovomedia.com"),
            artifactBase.replacingOccurrences(of: "wovomedia.com", with: "wovomedia.com:8443"),
            artifactBase.replacingOccurrences(of: "/generations/", with: "/%67enerations/"),
            artifactBase.replacingOccurrences(of: "/artifact?", with: "/%61rtifact?"),
            artifactBase.replacingOccurrences(of: "/artifact?", with: "/artifact/?"),
            artifactBase.replacingOccurrences(of: id, with: "not-a-job"),
            artifactBase.replacingOccurrences(of: "-4234-", with: "-0234-"),
            artifactBase.replacingOccurrences(of: "-4234-", with: "-9234-"),
            artifactBase.replacingOccurrences(of: "-8234-", with: "-7234-"),
            artifactBase.replacingOccurrences(of: "-8234-", with: "-c234-"),
            artifactBase.replacingOccurrences(of: "organizationId=org_Wovo-1", with: ""),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: ""),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: String(repeating: "a", count: 129)),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "org%20one"),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "%6frg_Wovo-1"),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "org%2Fone"),
            artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "org.one"),
            artifactBase.replacingOccurrences(of: "organizationId", with: "%6frganizationId"),
            artifactBase + "&organizationId=other", artifactBase + "&signature=\(signature)",
            artifactBase + "&expires=2000000000", artifactBase + "&content=1", artifactBase + "&scene=0",
            artifactBase + "#download", artifactBase + "#",
            "blob:\(artifactBase)", "https://storage.example.test/api/generations/\(id)/artifact?organizationId=org_Wovo-1"
        ]
        for value in artifactInvalid {
            precondition(WovoDownloadPolicy.kind(for: URL(string: value)!) == nil, "Unexpected current artifact route")
        }
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
        precondition(WovoDownloadPolicy.mayStart(url: artifact, topLevel: studio, source: studio, mainSource: true, mainTarget: true, explicitLink: true, downloadAttribute: true, method: "GET"))
        for (mime, expected) in [("image/png", WovoDownloadPolicy.Format.png), ("video/mp4", .mp4)] {
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: mime, length: WovoDownloadPolicy.maximumArtifactBytes) == expected)
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: mime, length: WovoDownloadPolicy.maximumArtifactBytes + 1) == nil)
        }
        for mime in ["text/plain; charset=utf-8", "text/plain;charset=utf-8", "text/plain;\tcharset=UTF-8"] {
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: mime, length: WovoDownloadPolicy.maximumTextBytes) == .txt)
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: mime, length: WovoDownloadPolicy.maximumTextBytes + 1) == nil)
        }
        for mime in ["text/html", "application/json", "application/octet-stream", "audio/mpeg", "audio/wav", "image/jpeg", "text/plain", "text/plain; charset=iso-8859-1", "text/plain;charset=utf-8; charset=iso-8859-1", "image/png;charset=utf-8", "video/mp4; charset=utf-8"] {
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: mime, length: 100) == nil)
        }
        for status in [206, 301, 401, 403, 500] {
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: status, mime: "image/png", length: 100) == nil)
        }
        for length in [Int64(-1), 0] {
            precondition(WovoDownloadPolicy.format(request: artifact, response: artifact, status: 200, mime: "text/plain;charset=utf-8", length: length) == nil)
        }
        precondition(WovoDownloadPolicy.format(request: artifact, response: URL(string: artifactBase.replacingOccurrences(of: "org_Wovo-1", with: "other")), status: 200, mime: "image/png", length: 100) == nil)
        precondition(WovoDownloadPolicy.format(request: artifact, response: url, status: 200, mime: "video/mp4", length: 100) == nil)
        precondition(WovoDownloadPolicy.format(request: url, response: url, status: 200, mime: "image/png", length: 100) == nil)
        precondition(WovoDownloadPolicy.matchesHeader(Data([0,0,0,20] + Array("ftypisom".utf8)), format: .mp4))
        func mp4Header(brand: String, boxSize: UInt32 = 24) -> Data {
            let size = [UInt8((boxSize >> 24) & 255), UInt8((boxSize >> 16) & 255), UInt8((boxSize >> 8) & 255), UInt8(boxSize & 255)]
            return Data(size + Array("ftyp\(brand)".utf8) + Array(repeating: UInt8(0), count: 12))
        }
        for brand in ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "] {
            precondition(WovoDownloadPolicy.matchesHeader(mp4Header(brand: brand), format: .mp4, request: artifact, length: 24))
        }
        precondition(WovoDownloadPolicy.matchesHeader(mp4Header(brand: "isom", boxSize: 16), format: .mp4, request: artifact, length: 24))
        for brand in ["html", "xxxx", "ISOM"] {
            precondition(!WovoDownloadPolicy.matchesHeader(mp4Header(brand: brand), format: .mp4, request: artifact, length: 24))
        }
        for boxSize in [UInt32(0), 1, 15, 25] {
            precondition(!WovoDownloadPolicy.matchesHeader(mp4Header(brand: "isom", boxSize: boxSize), format: .mp4, request: artifact, length: 24))
        }
        precondition(!WovoDownloadPolicy.matchesHeader(Data([0,0,0,20] + Array("ftypisom".utf8)), format: .mp4, request: artifact, length: 24))
        precondition(!WovoDownloadPolicy.matchesHeader(mp4Header(brand: "isom"), format: .mp4, request: artifact, length: WovoDownloadPolicy.maximumArtifactBytes + 1))
        precondition(WovoDownloadPolicy.matchesHeader(Data("RIFFabcdWAVE".utf8), format: .wav))
        precondition(WovoDownloadPolicy.matchesHeader(Data("ID3".utf8), format: .mp3))
        precondition(WovoDownloadPolicy.matchesHeader(Data([0xff,0xfb,0x90]), format: .mp3))
        precondition(WovoDownloadPolicy.matchesHeader(Data([137,80,78,71,13,10,26,10]), format: .png))
        precondition(!WovoDownloadPolicy.matchesHeader(Data([137,80,78,71,13,10,26]), format: .png))
        precondition(!WovoDownloadPolicy.matchesHeader(Data("<!doctype html>".utf8), format: .png))
        precondition(WovoDownloadPolicy.matchesHeader(Data("A useful caption\n".utf8), format: .txt))
        precondition(WovoDownloadPolicy.matchesHeader(Data("Caf\u{00e9}\t\u{1f603}".utf8), format: .txt))
        precondition(!WovoDownloadPolicy.matchesText(Data(Array(repeating: UInt8(65), count: 15) + [0xe2])))
        precondition(!WovoDownloadPolicy.matchesText(Data(Array(repeating: UInt8(65), count: 14) + [0xf0,0x9f])))
        precondition(WovoDownloadPolicy.matchesText(Data(repeating: 65, count: Int(WovoDownloadPolicy.maximumTextBytes))))
        precondition(!WovoDownloadPolicy.matchesText(Data(repeating: 65, count: Int(WovoDownloadPolicy.maximumTextBytes) + 1)))
        precondition(WovoDownloadPolicy.matchesText(Data((String(repeating: "caption ", count: 20) + "\u{1f603}").utf8)))
        let badTextTails: [[UInt8]] = [[0], [0xff], [0xe2], [0xc2,0x85], [0x7f]]
        for tail in badTextTails {
            precondition(!WovoDownloadPolicy.matchesText(Data(Array("Good text before byte sixteen ".utf8) + tail)))
        }
        let badTextPrefixes: [[UInt8]] = [[], [0], [0x1b], [0x7f], [0xff], [0xc0,0xaf], [0xed,0xa0,0x80], [0xf4,0x90,0x80,0x80], [0xe2], [0xe2,0x41], [137,80,78,71,13,10,26,10]]
        for bytes in badTextPrefixes {
            precondition(!WovoDownloadPolicy.matchesHeader(Data(bytes), format: .txt))
        }
        for format in [WovoDownloadPolicy.Format.png, .txt] {
            precondition(!format.filename.contains("/"))
            precondition(!format.filename.contains(".."))
            precondition(format.filename == "WOVO-export.\(format.rawValue)")
        }
        for format in [WovoDownloadPolicy.Format.mp4, .mp3, .wav] {
            precondition(!WovoDownloadPolicy.matchesHeader(Data(), format: format))
            precondition(!WovoDownloadPolicy.matchesHeader(Data("<!doctype html>".utf8), format: format))
            precondition(!format.filename.contains("/"))
        }
        print("Native download policy assertions passed (origin, intent, response, bounds and byte headers).")
    }
}
