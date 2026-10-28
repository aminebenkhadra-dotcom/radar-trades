package com.amine.radarbtceth;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Keeps a hidden copy of the page, asks it to check BTC and ETH on a timer, and turns what it reports into notifications. */
public class WatchService extends Service {
    private static final String CH_RUN = "watch";
    private static final String CH_ALERT = "configs";
    private static final String ACTION_TICK = "com.amine.radarbtceth.TICK";
    private static final int RUN_ID = 1;

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private PowerManager.WakeLock lock;
    private boolean pageReady, scanPending;

    static void channels(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel run = new NotificationChannel(CH_RUN, "Surveillance en cours", NotificationManager.IMPORTANCE_LOW);
        run.setShowBadge(false);
        nm.createNotificationChannel(run);
        nm.createNotificationChannel(new NotificationChannel(CH_ALERT, "Configurations BTC et ETH", NotificationManager.IMPORTANCE_HIGH));
    }

    private static PendingIntent open(Context ctx, int code) {
        Intent i = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void alert(Context ctx, String title, String text, String tag) {
        channels(ctx);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification n = new Notification.Builder(ctx, CH_ALERT)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(open(ctx, 100 + Math.abs(tag.hashCode() % 1000)))
                .build();
        nm.notify(tag, 2, n);
    }

    private Notification running(String text) {
        return new Notification.Builder(this, CH_RUN)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Radar BTC·ETH surveille")
                .setContentText(text)
                .setOngoing(true)
                .setContentIntent(open(this, 1))
                .build();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        channels(this);
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(RUN_ID, running("Démarrage…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(RUN_ID, running("Démarrage…"));
        } catch (Exception e) {
            stopSelf();
            return;
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "radarbtceth:scan");
            lock.setReferenceCounted(false);
        }
        web = new WebView(getApplicationContext());
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        MainActivity.harden(s);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return Relay.handle(getApplicationContext(), request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (scanPending) scan();
            }
        });
        web.loadUrl(Relay.HOME + "?bg=1");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (web == null || !getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE).getBoolean("on", false)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        scheduleNext();
        scan();
        return START_STICKY;
    }

    private PendingIntent tick() {
        Intent i = new Intent(this, WatchService.class).setAction(ACTION_TICK);
        return PendingIntent.getForegroundService(this, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void scheduleNext() {
        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int minutes = Math.max(15, getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE).getInt("minutes", 15));
        am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + minutes * 60000L, tick());
    }

    private void scan() {
        if (!pageReady) {
            scanPending = true;
            return;
        }
        scanPending = false;
        if (lock != null) lock.acquire(2 * 60 * 1000L);
        web.evaluateJavascript("window.bgScan&&window.bgScan()", null);
    }

    private final class Bridge {
        @JavascriptInterface
        public void notify(String title, String text, String tag) {
            alert(getApplicationContext(), title == null ? "Radar BTC·ETH" : title, text == null ? "" : text, tag == null ? "config" : tag);
        }

        @JavascriptInterface
        public void done(String summary) {
            final String line = new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date()) + " · " + (summary == null ? "" : summary);
            getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE).edit().putString("last", line).apply();
            main.post(() -> {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(RUN_ID, running("Dernier contrôle " + line));
                if (lock != null && lock.isHeld()) lock.release();
            });
        }
    }

    @Override
    public void onDestroy() {
        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(tick());
        if (lock != null && lock.isHeld()) lock.release();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
