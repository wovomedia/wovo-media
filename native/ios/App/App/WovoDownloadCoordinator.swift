import UIKit
import WebKit

// No script bridge, URLSession, token extraction, resumable/background transfer,
// or automatic posting. WebKit retains the original authorized export request.
final class WovoDownloadCoordinator: NSObject, WKDownloadDelegate {
    private weak var owner: UIViewController?
    private var request: URL?
    private var approvedAction: WKNavigationAction?
    private var attempt: UUID?
    private var transfer: WKDownload?
    private var timer: Timer?
    private var startedAt: Date?
    private var directory: URL?
    private var destination: URL?
    private var format: WovoDownloadPolicy.Format?
    private var expectedBytes: Int64 = 0
    private var progressAlert: UIAlertController?
    private var sharing = false

    init(owner: UIViewController) {
        self.owner = owner
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(enteredBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        timer?.invalidate()
        let folder = directory
        if let transfer = transfer { transfer.cancel { _ in Self.remove(folder) } }
        else { Self.remove(folder) }
    }

    func begin(_ action: WKNavigationAction) -> Bool {
        guard request == nil, let owner = owner, owner.presentedViewController == nil,
              let url = action.request.url, UIApplication.shared.applicationState == .active,
              WovoDownloadPolicy.kind(for: url) != nil else { return false }
        let identifier = UUID()
        attempt = identifier
        approvedAction = action
        request = url
        startedAt = Date()
        let alert = UIAlertController(title: "Preparing your download", message: "Keep WOVO open. When it's ready, choose where to save or share it.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in self?.stop(showError: false, for: identifier) })
        progressAlert = alert
        owner.present(alert, animated: true)
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.checkLimits() }
        return true
    }

    func unavailable() { offerError() }

    func attach(_ download: WKDownload, action: WKNavigationAction) {
        guard approvedAction === action, let request = request, transfer == nil, download.originalRequest?.url == request,
              download.originalRequest?.httpMethod == "GET", !sharing else { download.cancel(nil); return }
        if #available(iOS 18.2, *) {
            guard download.isUserInitiated, download.originatingFrame.isMainFrame else {
                download.cancel(nil)
                stop(showError: true)
                return
            }
        }
        transfer = download
        download.delegate = self
    }

    private func checkLimits() {
        guard !sharing, let startedAt = startedAt else { return }
        let bytes = transfer?.progress.completedUnitCount ?? 0
        let total = transfer?.progress.totalUnitCount ?? 0
        if Date().timeIntervalSince(startedAt) > WovoDownloadPolicy.maximumSeconds
            || bytes > WovoDownloadPolicy.maximumBytes || total > WovoDownloadPolicy.maximumBytes {
            stop(showError: true)
        }
    }

    @objc private func enteredBackground() {
        // Choosing another app from the share sheet is the user's action. Only
        // an unfinished transfer is canceled when WOVO goes to the background.
        if !sharing { stop(showError: false) }
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard transfer === download, let request = request, let http = response as? HTTPURLResponse,
              let format = WovoDownloadPolicy.format(request: request, response: response.url, status: http.statusCode,
                                                     mime: response.mimeType, length: response.expectedContentLength) else {
            completionHandler(nil)
            if transfer === download { stop(showError: true) }
            return
        }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("wovo-export-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.complete])
            directory = folder
            // Ignore untrusted suggested filenames; no traversal or overwriting.
            let file = folder.appendingPathComponent(format.filename, isDirectory: false)
            destination = file
            self.format = format
            expectedBytes = response.expectedContentLength
            completionHandler(file)
        } catch {
            completionHandler(nil)
            stop(showError: true)
        }
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
        // WOVO serves these endpoints in place. Never forward a signed capability.
        decisionHandler(.cancel)
        if transfer === download { stop(showError: true) }
    }

    func download(_ download: WKDownload, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            completionHandler(.performDefaultHandling, nil)
        } else { completionHandler(.cancelAuthenticationChallenge, nil) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if transfer === download { stop(showError: true) }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard transfer === download, let destination = destination, let format = format, let identifier = attempt else { return }
        transfer = nil
        timer?.invalidate()
        timer = nil
        do {
            let values = try destination.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true,
                  let count = values.fileSize, Int64(count) == expectedBytes, count > 0,
                  Int64(count) <= WovoDownloadPolicy.maximumBytes else { stop(showError: true); return }
            let handle = try FileHandle(forReadingFrom: destination)
            defer { try? handle.close() }
            guard WovoDownloadPolicy.matchesHeader(try handle.read(upToCount: 16) ?? Data(), format: format) else { stop(showError: true); return }
        } catch { stop(showError: true); return }
        sharing = true
        dismissProgress { [weak self] in self?.presentShare(destination, attempt: identifier) }
    }

    private func presentShare(_ file: URL, attempt identifier: UUID) {
        // A delayed completion from a canceled attempt cannot cancel or share a new one.
        guard attempt == identifier else { return }
        guard sharing, destination == file, let owner = owner, owner.presentedViewController == nil,
              owner.viewIfLoaded?.window != nil, UIApplication.shared.applicationState == .active else {
            stop(showError: false)
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.completionWithItemsHandler = { [weak self] _, _, _, _ in self?.stop(showError: false, for: identifier) }
        // A popover anchor is required on iPad. iPhone uses the standard sheet.
        sheet.popoverPresentationController?.sourceView = owner.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: owner.view.bounds.midX, y: owner.view.bounds.maxY - 20, width: 1, height: 1)
        owner.present(sheet, animated: true)
    }

    private func stop(showError: Bool, for identifier: UUID? = nil) {
        if let identifier = identifier, attempt != identifier { return }
        let active = transfer
        let folder = directory
        transfer = nil
        request = nil
        approvedAction = nil
        attempt = nil
        directory = nil
        destination = nil
        format = nil
        startedAt = nil
        expectedBytes = 0
        sharing = false
        timer?.invalidate()
        timer = nil
        // Remove only this attempt's UUID directory, after WebKit stops writing.
        if let active = active { active.cancel { _ in Self.remove(folder) } }
        else { Self.remove(folder) }
        dismissProgress { [weak self] in if showError { self?.offerError() } }
    }

    private func dismissProgress(_ completion: @escaping () -> Void) {
        let alert = progressAlert
        progressAlert = nil
        if let alert = alert, alert.presentingViewController != nil { alert.dismiss(animated: true, completion: completion) }
        else { completion() }
    }

    private func offerError() {
        guard let owner = owner, owner.presentedViewController == nil, UIApplication.shared.applicationState == .active else { return }
        let alert = UIAlertController(title: "Download couldn't finish", message: "Keep WOVO open and try Download again from your Library. This app supports WOVO video and audio files up to 256 MB. Nothing was posted or generated.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        owner.present(alert, animated: true)
    }

    private static func remove(_ folder: URL?) {
        guard let folder = folder, folder.isFileURL,
              folder.deletingLastPathComponent().standardizedFileURL == FileManager.default.temporaryDirectory.standardizedFileURL,
              folder.lastPathComponent.hasPrefix("wovo-export-"),
              UUID(uuidString: String(folder.lastPathComponent.dropFirst("wovo-export-".count))) != nil else { return }
        try? FileManager.default.removeItem(at: folder)
    }
}
