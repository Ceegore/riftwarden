import Foundation
import Capacitor

@objc(NativeSaveStorePlugin)
public final class NativeSaveStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSaveStorePlugin"
    public let jsName = "NativeSaveStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getBridgeInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeAtomic", returnType: CAPPluginReturnPromise),
    ]

    @objc public func getBridgeInfo(_ call: CAPPluginCall) {
        call.resolve([
            "plugin": "NativeSaveStore",
            "bridgeVersion": 1,
            "platform": "ios",
            "availability": "available",
            "implementation": "skeleton",
            "capabilities": ["atomic_write", "durable_flush", "slot_rotation"]
        ])
    }

    @objc public func read(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "read")
    }

    @objc public func writeAtomic(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "writeAtomic")
    }

    private func rejectNotImplemented(_ call: CAPPluginCall, method: String) {
        call.reject("NativeSaveStore.\(method) is not implemented in Phase 04.", "NOT_IMPLEMENTED")
    }
}
