import Foundation
import Capacitor

@objc(SaveTransferPlugin)
public final class SaveTransferPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SaveTransferPlugin"
    public let jsName = "SaveTransfer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getBridgeInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportDocument", returnType: CAPPluginReturnPromise),
    ]

    @objc public func getBridgeInfo(_ call: CAPPluginCall) {
        call.resolve([
            "plugin": "SaveTransfer",
            "bridgeVersion": 1,
            "platform": "ios",
            "availability": "available",
            "implementation": "skeleton",
            "capabilities": ["pick_import", "export_document"]
        ])
    }

    @objc public func pickImport(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "pickImport")
    }

    @objc public func exportDocument(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "exportDocument")
    }

    private func rejectNotImplemented(_ call: CAPPluginCall, method: String) {
        call.reject("SaveTransfer.\(method) is not implemented in Phase 04.", "NOT_IMPLEMENTED")
    }
}
