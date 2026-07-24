package com.ceegore.riftwarden;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.ceegore.riftwarden.plugins.GameAudioSessionPlugin;
import com.ceegore.riftwarden.plugins.NativeSaveStorePlugin;
import com.ceegore.riftwarden.plugins.SaveTransferPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSaveStorePlugin.class);
        registerPlugin(SaveTransferPlugin.class);
        registerPlugin(GameAudioSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
