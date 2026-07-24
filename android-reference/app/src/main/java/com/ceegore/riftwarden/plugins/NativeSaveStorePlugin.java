package com.ceegore.riftwarden.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeSaveStore")
public final class NativeSaveStorePlugin extends Plugin {
    private static final int BRIDGE_VERSION = 1;

    @PluginMethod
    public void getBridgeInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("plugin", "NativeSaveStore");
        result.put("bridgeVersion", BRIDGE_VERSION);
        result.put("platform", "android");
        result.put("availability", "available");
        result.put("implementation", "skeleton");
        result.put("capabilities", new String[] { "atomic_write", "durable_flush", "slot_rotation" });
        call.resolve(result);
    }

    @PluginMethod
    public void read(PluginCall call) { rejectNotImplemented(call, "read"); }

    @PluginMethod
    public void writeAtomic(PluginCall call) { rejectNotImplemented(call, "writeAtomic"); }

    private void rejectNotImplemented(PluginCall call, String method) {
        call.reject("NativeSaveStore." + method + " is not implemented in Phase 04.", "NOT_IMPLEMENTED");
    }
}
