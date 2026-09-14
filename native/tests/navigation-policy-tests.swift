import Foundation

@main struct NavigationPolicyTests {
    static func main() {
        let inside = ["https://wovomedia.com", "https://wovomedia.com/library?tab=video", "https://wovomedia.com:443/settings", "capacitor://localhost/offline.html"]
        let blocked = ["http://wovomedia.com", "https://wovomedia.com.evil.test", "https://evil.test/wovomedia.com", "https://wovomedia.com@evil.test", "https://evil.test@wovomedia.com", "https://wovomedia.com:8443", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "capacitor://evil.test", "capacitor://localhost:8080", "capacitor://user@localhost/offline.html", "https://www.wovomedia.com"]
        for value in inside { precondition(WovoNavigationPolicy.mayLoadInside(URL(string: value)!), "Expected trusted URL") }
        for value in blocked { precondition(!WovoNavigationPolicy.mayLoadInside(URL(string: value)!), "Unexpected trusted URL") }
        precondition(WovoNavigationPolicy.mayOfferExternal(URL(string: "https://support.example.com")!))
        for value in ["http://example.com", "mailto:support@wovomedia.com", "tel:1234", "javascript:alert(1)", "https://user@example.com", "https://example.com:8443", "https://wovomedia.com"] {
            precondition(!WovoNavigationPolicy.mayOfferExternal(URL(string: value)!), "Unexpected external launch")
        }
        print("Native navigation policy: 25 assertions passed.")
    }
}
