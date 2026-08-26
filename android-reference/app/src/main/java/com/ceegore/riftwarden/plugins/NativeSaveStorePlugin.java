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

    @PluginMethod
    public void commit(PluginCall call) { rejectNotImplemented(call, "commit"); }

    @PluginMethod
    public void load(PluginCall call) { rejectNotImplemented(call, "load"); }

    @PluginMethod
    public void inspect(PluginCall call) { rejectNotImplemented(call, "inspect"); }

    @PluginMethod
    public void cleanupOrphans(PluginCall call) { rejectNotImplemented(call, "cleanupOrphans"); }

    private void rejectNotImplemented(PluginCall call, String method) {
        call.reject("NativeSaveStore." + method + " is not implemented in Phase 04.", "NOT_IMPLEMENTED");
    }
}
