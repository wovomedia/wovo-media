import Foundation

// No wildcard hosts, prefix matching, credentials or alternate ports.
enum WovoNavigationPolicy {
    static let studio = URL(string: "https://wovomedia.com")!

    static func isStudio(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host?.lowercased() == "wovomedia.com"
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    static func isLocal(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "capacitor" && url.host?.lowercased() == "localhost"
            && url.port == nil && url.user == nil && url.password == nil
    }

    static func mayLoadInside(_ url: URL) -> Bool { isStudio(url) || isLocal(url) }

    static func mayOfferExternal(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host != nil && url.user == nil
            && url.password == nil && (url.port == nil || url.port == 443)
            && !mayLoadInside(url)
    }
}
