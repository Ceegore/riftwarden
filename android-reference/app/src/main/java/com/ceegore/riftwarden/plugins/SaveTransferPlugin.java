package com.ceegore.riftwarden.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SaveTransfer")
public final class SaveTransferPlugin extends Plugin {
    private static final int BRIDGE_VERSION = 1;

    @PluginMethod
    public void getBridgeInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("plugin", "SaveTransfer");
        result.put("bridgeVersion", BRIDGE_VERSION);
        result.put("platform", "android");
        result.put("availability", "available");
        result.put("implementation", "skeleton");
        result.put("capabilities", new String[] { "pick_import", "export_document" });
        call.resolve(result);
    }

    @PluginMethod
    public void pickImport(PluginCall call) { rejectNotImplemented(call, "pickImport"); }

    @PluginMethod
    public void exportDocument(PluginCall call) { rejectNotImplemented(call, "exportDocument"); }

    private void rejectNotImplemented(PluginCall call, String method) {
        call.reject("SaveTransfer." + method + " is not implemented in Phase 04.", "NOT_IMPLEMENTED");
    }
}
