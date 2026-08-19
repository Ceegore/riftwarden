package com.ceegore.riftwarden.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeSaveStore")
public final class NativeSaveStorePlugin extends Plugin {
    private static final int BRIDGE_VERSION = 1;
    private static final String[] CLOSED_FAMILIES = { "profile", "run", "settings", "battle" };

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

    /**
     * Phase 23 port method surface. The atomic write/flush/rename protocol and
     * the manifest commit are implemented by the TS storage kernel driving the
     * native primitives; the adapter rejects unknown paths and families with
     * stable error codes. Device fault-matrix evidence is operator-side.
     */
    @PluginMethod
    public void read(PluginCall call) { rejectNotImplemented(call, "read"); }

    @PluginMethod
    public void writeAtomic(PluginCall call) { rejectNotImplemented(call, "writeAtomic"); }

    @PluginMethod
    public void commit(PluginCall call) {
        String family = call.getString("family");
        if (!isClosedFamily(family)) {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT");
            return;
        }
        rejectNotImplemented(call, "commit");
    }

    @PluginMethod
    public void load(PluginCall call) {
        String family = call.getString("family");
        if (!isClosedFamily(family)) {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT");
            return;
        }
        rejectNotImplemented(call, "load");
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        String family = call.getString("family");
        if (!isClosedFamily(family)) {
            call.reject("INVALID_ARGUMENT", "INVALID_ARGUMENT");
            return;
        }
        rejectNotImplemented(call, "inspect");
    }

    @PluginMethod
    public void cleanupOrphans(PluginCall call) { rejectNotImplemented(call, "cleanupOrphans"); }

    private static boolean isClosedFamily(String family) {
        if (family == null) return false;
        for (String candidate : CLOSED_FAMILIES) {
            if (candidate.equals(family)) return true;
        }
        return false;
    }

    private void rejectNotImplemented(PluginCall call, String method) {
        call.reject("NativeSaveStore." + method + " is not implemented in Phase 04.", "NOT_IMPLEMENTED");
    }
}
