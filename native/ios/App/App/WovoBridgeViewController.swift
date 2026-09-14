import UIKit
import WebKit
import Capacitor

// INTERNAL TEST ONLY. The current online studio is not a bundled native client.
final class WovoBridgeViewController: CAPBridgeViewController {
    private var secureDelegate: WovoWebViewDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationItem.title = "WOVO · Internal"
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Back", style: .plain, target: self, action: #selector(goBack))
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reconnect))
    }

    @objc private func goBack() {
        if webView?.canGoBack == true { webView?.goBack() }
    }

    @objc private func reconnect() {
        // Never resubmit a generation request: load the ordinary studio GET.
        webView?.load(URLRequest(url: WovoNavigationPolicy.studio))
    }

    override func webViewConfiguration(for configuration: InstanceConfiguration) -> WKWebViewConfiguration {
        let webConfiguration = super.webViewConfiguration(for: configuration)
        webConfiguration.mediaTypesRequiringUserActionForPlayback = .all
        webConfiguration.defaultWebpagePreferences.preferredContentMode = .mobile
        return webConfiguration
    }

    override func capacitorDidLoad() {
        guard let webView = webView else { return }
        secureDelegate = WovoWebViewDelegate(owner: self, navigation: webView.navigationDelegate, ui: webView.uiDelegate)
        webView.navigationDelegate = secureDelegate
        webView.uiDelegate = secureDelegate
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 11 / 255, green: 11 / 255, blue: 12 / 255, alpha: 1)
    }
}

// Forward Capacitor's lifecycle/dialog handlers, replacing only sensitive decisions.
// Do not replace the bridge's script-message handler or expose any native API.
private final class WovoWebViewDelegate: NSObject, WKNavigationDelegate, WKUIDelegate {
    private weak var owner: UIViewController?
    private weak var navigation: WKNavigationDelegate?
    private weak var ui: WKUIDelegate?
    private let downloads: WovoDownloadCoordinator

    init(owner: UIViewController, navigation: WKNavigationDelegate?, ui: WKUIDelegate?) {
        self.owner = owner
        self.navigation = navigation
        self.ui = ui
        self.downloads = WovoDownloadCoordinator(owner: owner)
        super.init()
    }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || navigation?.responds(to: selector) == true || ui?.responds(to: selector) == true
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        if navigation?.responds(to: selector) == true { return navigation }
        if ui?.responds(to: selector) == true { return ui }
        return super.forwardingTarget(for: selector)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        // Capacitor's bridge proxy must never fetch another origin behind our origin.
        guard !url.path.hasPrefix("/_capacitor_http_interceptor_") else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload {
            let approved = mayDownload(action, in: webView) && downloads.begin(action)
            decisionHandler(approved ? .download : .cancel)
            if !approved, action.navigationType == .linkActivated, action.sourceFrame.isMainFrame,
               webView.url.map(WovoNavigationPolicy.isStudio) == true { downloads.unavailable() }
            return
        }
        if WovoNavigationPolicy.mayLoadInside(url) {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        // Redirects, iframes, scripts and unknown schemes cannot launch other apps.
        if action.navigationType == .linkActivated,
           action.targetFrame == nil || action.targetFrame?.isMainFrame == true,
           WovoNavigationPolicy.mayOfferExternal(url) {
            offerExternal(url)
        }
    }

    private func mayDownload(_ action: WKNavigationAction, in webView: WKWebView) -> Bool {
        guard let url = action.request.url else { return false }
        return WovoDownloadPolicy.mayStart(url: url, topLevel: webView.url, source: action.sourceFrame.request.url,
            mainSource: action.sourceFrame.isMainFrame, mainTarget: action.targetFrame == nil || action.targetFrame?.isMainFrame == true,
            explicitLink: action.navigationType == .linkActivated, downloadAttribute: action.shouldPerformDownload,
            method: action.request.httpMethod)
    }

    func webView(_ webView: WKWebView, navigationAction action: WKNavigationAction, didBecome download: WKDownload) {
        guard mayDownload(action, in: webView) else { download.cancel(nil); return }
        downloads.attach(download, action: action)
    }

    func webView(_ webView: WKWebView, navigationResponse response: WKNavigationResponse, didBecome download: WKDownload) {
        // An unsolicited attachment/response must not bypass an explicit action.
        download.cancel(nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
            decisionHandler(.cancel)
            loadOffline(webView)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { loadOffline(webView) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { loadOffline(webView) }
    }

    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // Standard platform trust evaluation only; never bypass TLS or inject credentials.
        completionHandler(.performDefaultHandling, nil)
    }

    private func loadOffline(_ webView: WKWebView) {
        // Never loop on a broken bundled fallback, print URLs/tokens, or retry a job.
        guard webView.url?.absoluteString != "capacitor://localhost/offline.html" else { return }
        webView.isOpaque = true
        webView.load(URLRequest(url: URL(string: "capacitor://localhost/offline.html")!))
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        if WovoNavigationPolicy.mayLoadInside(url) { webView.load(URLRequest(url: url)) }
        // Only the navigation action handler can offer an explicit external link.
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let trusted = origin.protocol == "https" && origin.host == "wovomedia.com" && (origin.port == 0 || origin.port == 443)
            && frame.isMainFrame && webView.url.map(WovoNavigationPolicy.isStudio) == true
        // Never auto-grant. iOS still requests camera/microphone permission.
        decisionHandler(trusted ? .prompt : .deny)
    }

    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.deny)
    }

    private func offerExternal(_ url: URL) {
        guard let owner = owner, owner.presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Open in your browser?", message: "This leaves the WOVO test app and opens \(url.host ?? "the selected website").", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Stay in WOVO", style: .cancel))
        alert.addAction(UIAlertAction(title: "Open browser", style: .default) { _ in
            UIApplication.shared.open(url, options: [:])
        })
        owner.present(alert, animated: true)
    }
}
