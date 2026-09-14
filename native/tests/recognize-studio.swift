import Foundation
import Vision

// Anonymous screenshot only. Emit booleans, never OCR text or page URLs.
@main struct RecognizeStudio {
    static func main() throws {
        guard CommandLine.arguments.count == 2 else { throw NSError(domain: "WovoSmoke", code: 1) }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = true
        let handler = VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1]), options: [:])
        try handler.perform([request])
        let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").lowercased()
        let brand = text.contains("wovo")
        let signIn = text.contains("sign in") || text.contains("start free") || text.contains("create account")
        let composer = text.contains("adam") || text.contains("bring your next idea") || text.contains("tell wovo")
        let create = text.contains("create") || text.contains("studio")
        let offline = text.contains("could not load") || text.contains("let’s reconnect") || text.contains("let's reconnect")
        let result: [String: Bool] = [
            "hasBrand": brand, "hasSignIn": signIn, "hasComposer": composer,
            "hasCreate": create, "hasOfflineMessage": offline,
            "publicStudioDetected": brand && signIn && composer && create && !offline
        ]
        let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        print(String(decoding: data, as: UTF8.self))
    }
}
