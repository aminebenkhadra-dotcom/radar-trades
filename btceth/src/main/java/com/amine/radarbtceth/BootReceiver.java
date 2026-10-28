package com.amine.radarbtceth;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts the background watch after a phone restart or an app update, when it was on. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        if (!ctx.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getBoolean("on", false)) return;
        try {
            ctx.startForegroundService(new Intent(ctx, WatchService.class));
        } catch (Exception ignored) {
        }
    }
}
