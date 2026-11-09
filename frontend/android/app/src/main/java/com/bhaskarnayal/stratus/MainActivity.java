package com.bhaskarnayal.stratus;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The share-target plugin only hears shares that arrive while the app is
        // open (onNewIntent). One that launches the app from closed comes in as
        // the launch intent, so pass it along the same way. The plugin holds it
        // until the app's JavaScript is listening (src/lib/shareIn.js).
        Intent intent = getIntent();
        String action = intent != null ? intent.getAction() : null;
        if (savedInstanceState == null
                && (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action))) {
            bridge.onNewIntent(intent);
        }
    }
}
