import Foundation
import Capacitor

@objc(GameAudioSessionPlugin)
public final class GameAudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameAudioSessionPlugin"
    public let jsName = "GameAudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getBridgeInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
    ]

    @objc public func getBridgeInfo(_ call: CAPPluginCall) {
        call.resolve([
            "plugin": "GameAudioSession",
            "bridgeVersion": 1,
            "platform": "ios",
            "availability": "available",
            "implementation": "skeleton",
            "capabilities": ["audio_focus", "interruption_events", "silent_mode_policy"]
        ])
    }

    @objc public func configure(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "configure")
    }

    @objc public func activate(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "activate")
    }

    @objc public func deactivate(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "deactivate")
    }

    private func rejectNotImplemented(_ call: CAPPluginCall, method: String) {
        call.reject("GameAudioSession.\(method) is not implemented in Phase 04.", "NOT_IMPLEMENTED")
    }
}
