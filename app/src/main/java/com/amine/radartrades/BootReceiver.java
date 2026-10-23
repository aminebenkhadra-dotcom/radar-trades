package com.amine.radartrades;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts the background watch after the phone restarts or the app is updated, when the user had switched it on. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        // both actions are protected broadcasts: only the system can send them
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        if (!ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getBoolean("on", false)) return;
        try {
            ctx.startForegroundService(new Intent(ctx, WatchService.class));
        } catch (Exception ignored) {
            // refused by the system: the watch resumes the next time the app is opened
        }
    }
}
