package com.amine.radartrades;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/** Shows the scanner page and lets it switch the background watch on and off. */
public class MainActivity extends Activity {
    static final String PREFS = "watch";
    static final String EXTRA_TAB = "tab";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A1112);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return Relay.handle(getApplicationContext(), request);
            }

            /** Links to news articles open in the phone's browser, never inside the app. */
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (Relay.HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        setContentView(web);
        String tab = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_TAB);
        web.loadUrl(Relay.HOME + (tab == null ? "" : "#" + tab));

        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (p.getBoolean("on", false)) startWatchService();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String tab = intent == null ? null : intent.getStringExtra(EXTRA_TAB);
        if (tab != null && web != null && tab.matches("[a-z0-9]{1,8}")) {
            web.evaluateJavascript("window.openTab&&window.openTab('" + tab + "')", null);
        }
    }

    private void startWatchService() {
        try {
            startForegroundService(new Intent(this, WatchService.class));
        } catch (Exception ignored) {
            // The system can refuse a background start; the watch resumes next time the app is opened.
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public void startWatch(boolean top10, boolean top50, int minutes) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putBoolean("on", true).putBoolean("top10", top10).putBoolean("top50", top50)
                    .putInt("minutes", Math.max(15, minutes)).apply();
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !canNotify()) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                }
                stopService(new Intent(MainActivity.this, WatchService.class));
                startWatchService();
            });
        }

        @JavascriptInterface
        public void stopWatch() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", false).apply();
            runOnUiThread(() -> stopService(new Intent(MainActivity.this, WatchService.class)));
        }

        @JavascriptInterface
        public boolean canNotify() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.areNotificationsEnabled();
        }

        @JavascriptInterface
        public boolean batteryFree() {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        @JavascriptInterface
        public void askBattery() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void test() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !canNotify()) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                }
                WatchService.alert(getApplicationContext(), "Radar Trades · test",
                        "Les alertes fonctionnent. Tu recevras ce type de message quand un setup est prêt.", "test", "all");
            });
        }

        @JavascriptInterface
        public boolean saveKeys(String exchange, String apiKey, String secret, String pass) {
            if (exchange == null || apiKey == null || secret == null) return false;
            return Vault.put(getApplicationContext(), exchange, apiKey.trim(), secret.trim(), pass == null ? "" : pass.trim());
        }

        @JavascriptInterface
        public boolean hasKeys(String exchange) {
            return exchange != null && Vault.has(getApplicationContext(), exchange);
        }

        @JavascriptInterface
        public void clearKeys(String exchange) {
            if (exchange != null) Vault.clear(getApplicationContext(), exchange);
        }

        /** Runs one of the fixed read-only account queries and hands the answer back to the page. */
        @JavascriptInterface
        public void api(final int id, final String exchange, final String name) {
            new Thread(() -> {
                final String[] r = Exchanges.call(getApplicationContext(), String.valueOf(exchange), String.valueOf(name));
                final String status = r[0].matches("\\d{1,3}") ? r[0] : "0";
                runOnUiThread(() -> {
                    if (web != null) {
                        web.evaluateJavascript("window.onApi&&window.onApi(" + id + "," + status + ","
                                + JSONObject.quote(r[1]) + ")", null);
                    }
                });
            }).start();
        }

        @JavascriptInterface
        public String lastCheck() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString("last", "");
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
