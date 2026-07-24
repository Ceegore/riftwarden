package com.ceegore.riftwarden.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GameAudioSession")
public final class GameAudioSessionPlugin extends Plugin {
    private static final int BRIDGE_VERSION = 1;

    @PluginMethod
    public void getBridgeInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("plugin", "GameAudioSession");
        result.put("bridgeVersion", BRIDGE_VERSION);
        result.put("platform", "android");
        result.put("availability", "available");
        result.put("implementation", "skeleton");
        result.put("capabilities", new String[] { "audio_focus", "interruption_events", "silent_mode_policy" });
        call.resolve(result);
    }

    @PluginMethod
    public void configure(PluginCall call) { rejectNotImplemented(call, "configure"); }

    @PluginMethod
    public void activate(PluginCall call) { rejectNotImplemented(call, "activate"); }

    @PluginMethod
    public void deactivate(PluginCall call) { rejectNotImplemented(call, "deactivate"); }

    private void rejectNotImplemented(PluginCall call, String method) {
        call.reject("GameAudioSession." + method + " is not implemented in Phase 04.", "NOT_IMPLEMENTED");
    }
}
