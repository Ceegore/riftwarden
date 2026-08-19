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
        CAPPluginMethod(name: "commit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "inspect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanupOrphans", returnType: CAPPluginReturnPromise),
    ]

    private static let closedFamilies: Set<String> = ["profile", "run", "settings", "battle"]

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

    /// Phase 23 port method surface. The atomic write/flush/rename protocol
    /// and manifest commit are driven by the TS storage kernel; the adapter
    /// rejects unknown families with stable error codes. Device fault-matrix
    /// evidence is operator-side.
    @objc public func read(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "read")
    }

    @objc public func writeAtomic(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "writeAtomic")
    }

    @objc public func commit(_ call: CAPPluginCall) {
        guard let family = call.getString("family"), Self.closedFamilies.contains(family) else {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT")
            return
        }
        rejectNotImplemented(call, method: "commit")
    }

    @objc public func load(_ call: CAPPluginCall) {
        guard let family = call.getString("family"), Self.closedFamilies.contains(family) else {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT")
            return
        }
        rejectNotImplemented(call, method: "load")
    }

    @objc public func inspect(_ call: CAPPluginCall) {
        guard let family = call.getString("family"), Self.closedFamilies.contains(family) else {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT")
            return
        }
        rejectNotImplemented(call, method: "inspect")
    }

    @objc public func cleanupOrphans(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "cleanupOrphans")
    }

    private func rejectNotImplemented(_ call: CAPPluginCall, method: String) {
        call.reject("NativeSaveStore.\(method) is not implemented in Phase 04.", "NOT_IMPLEMENTED")
    }
}
