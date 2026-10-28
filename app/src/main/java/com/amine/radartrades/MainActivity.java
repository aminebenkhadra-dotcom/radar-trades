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

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Shows the scanner page and lets it switch the background watch on and off. */
public class MainActivity extends Activity {
    static final String PREFS = "watch";
    static final String EXTRA_TAB = "tab";
    private static final int REQ_SAVE = 41, REQ_OPEN = 42;
    private static final int MAX_FILE = 20_000_000;

    private WebView web;
    private byte[] pendingSave;
    private String pendingCb = "onBackup";

    /** The page needs JavaScript and its own storage, nothing else: no files, no content providers, no pop-ups, no plain HTTP. */
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
        web.setBackgroundColor(0xFF0A1112);
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

            /** The page itself stays in the app; web links (news articles) open in the phone's browser; anything else is ignored. */
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String sc = u.getScheme();
                if (Relay.HOST.equals(u.getHost()) && "https".equals(sc)) return false;
                if ("https".equals(sc) || "http".equals(sc)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }
        });
        setContentView(web);
        String tab = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_TAB);
        if (tab != null && !tab.matches("[a-z0-9]{1,8}(~[A-Za-z0-9]{1,30})?")) tab = null;
        web.loadUrl(Relay.HOME + (tab == null ? "" : "#" + tab));

        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (p.getBoolean("on", false)) startWatchService();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String tab = intent == null ? null : intent.getStringExtra(EXTRA_TAB);
        if (tab != null && web != null && tab.matches("[a-z0-9]{1,8}(~[A-Za-z0-9]{1,30})?")) {
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

    /** Hands a result back to the page: window[fn](ok, text). */
    private void callback(final String fn, final boolean ok, final String arg) {
        runOnUiThread(() -> {
            if (web != null) {
                web.evaluateJavascript("window." + fn + "&&window." + fn + "(" + ok + "," + JSONObject.quote(arg == null ? "" : arg) + ")", null);
            }
        });
    }

    /** Backup file chosen by the user through the system file picker: written or read here, never anywhere else. */
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        final Uri u = data == null ? null : data.getData();
        if (req == REQ_SAVE) {
            final byte[] c = pendingSave;
            final String cb = pendingCb;
            pendingSave = null;
            if (res != RESULT_OK || u == null || c == null) {
                callback(cb, false, "annulée");
                return;
            }
            new Thread(() -> {
                boolean ok = false;
                try (OutputStream o = getContentResolver().openOutputStream(u, "wt")) {
                    if (o != null) {
                        o.write(c);
                        ok = true;
                    }
                } catch (Exception ignored) {
                }
                callback(cb, ok, ok ? "" : "écriture impossible");
            }).start();
        } else if (req == REQ_OPEN) {
            if (res != RESULT_OK || u == null) {
                callback("onRestore", false, "annulé");
                return;
            }
            new Thread(() -> {
                String txt = null;
                try (InputStream in = getContentResolver().openInputStream(u)) {
                    if (in != null) {
                        ByteArrayOutputStream b = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        long tot = 0;
                        while ((n = in.read(buf)) > 0) {
                            tot += n;
                            if (tot > MAX_FILE) throw new IllegalStateException("too big");
                            b.write(buf, 0, n);
                        }
                        txt = new String(b.toByteArray(), StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {
                }
                callback("onRestore", txt != null, txt == null ? "lecture impossible" : txt);
            }).start();
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
                        "Les alertes fonctionnent. Tu recevras ce type de message quand un setup est prêt selon les règles.", "test", "all");
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

        /** Backup of the page's own data (journal, settings, entries): the user picks where the file goes. API keys are never in it. */
        @JavascriptInterface
        public void saveFile(String name, String content) {
            if (content == null || content.length() > MAX_FILE) {
                callback("onBackup", false, "fichier trop gros");
                return;
            }
            String n = name != null && name.matches("[A-Za-z0-9._-]{1,80}") ? name : "radar-trades-sauvegarde.json";
            pick(n, "application/json", content.getBytes(StandardCharsets.UTF_8), "onBackup");
        }

        /** Excel export of the trade history (built by the page, sent in base64): the user picks where the file goes. */
        @JavascriptInterface
        public void saveBytes(String name, String b64) {
            byte[] data;
            try {
                if (b64 == null || b64.length() > MAX_FILE * 4 / 3 + 4) throw new IllegalArgumentException();
                data = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            } catch (Exception e) {
                callback("onExport", false, "fichier illisible ou trop gros");
                return;
            }
            String n = name != null && name.matches("[A-Za-z0-9._-]{1,80}\\.xlsx") ? name : "radar-trades-historique.xlsx";
            pick(n, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data, "onExport");
        }

        private void pick(String n, String mime, byte[] data, String cb) {
            runOnUiThread(() -> {
                pendingSave = data;
                pendingCb = cb;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime).putExtra(Intent.EXTRA_TITLE, n);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (Exception e) {
                    pendingSave = null;
                    callback(cb, false, "aucun gestionnaire de fichiers");
                }
            });
        }

        @JavascriptInterface
        public void openFile() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                        .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try {
                    startActivityForResult(i, REQ_OPEN);
                } catch (Exception e) {
                    callback("onRestore", false, "aucun gestionnaire de fichiers");
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
