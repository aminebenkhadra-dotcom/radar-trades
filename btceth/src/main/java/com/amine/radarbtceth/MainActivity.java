package com.amine.radarbtceth;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Shows the BTC/ETH page and lets it switch the background watch on and off. No API key, no order: market data only. */
public class MainActivity extends Activity {
    static final String PREFS = "watch";
    private WebView web;

    static void harden(WebSettings s) {
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(false);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0F1B2D);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        harden(s);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return Relay.handle(getApplicationContext(), request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (Relay.HOST.equals(u.getHost()) && "https".equals(u.getScheme())) return false;
                if ("https".equals(u.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(Relay.HOME);
        if (getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("on", false)) startWatch();
    }

    private void startWatch() {
        try {
            startForegroundService(new Intent(this, WatchService.class));
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.goBack&&window.goBack()", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private final class Bridge {
        @JavascriptInterface
        public void startWatch(int minutes) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", true).putInt("minutes", Math.max(15, minutes)).apply();
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !canNotify()) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                MainActivity.this.startWatch();
            });
        }

        @JavascriptInterface
        public void stopWatch() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", false).apply();
            runOnUiThread(() -> stopService(new Intent(MainActivity.this, WatchService.class)));
        }

        @JavascriptInterface
        public boolean watching() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("on", false);
        }

        @JavascriptInterface
        public boolean canNotify() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.areNotificationsEnabled();
        }

        @JavascriptInterface
        public String lastCheck() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString("last", "");
        }

        @JavascriptInterface
        public void test() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !canNotify()) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                WatchService.alert(getApplicationContext(), "Radar BTC·ETH · test", "Les alertes arrivent bien sur ce téléphone.", "test");
            });
        }
    }
}
