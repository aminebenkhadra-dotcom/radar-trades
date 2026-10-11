package com.amine.radartrades;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/** Shows the bundled scanner page and relays its /fapi/ and /futures/data/ requests to Binance's public market-data API. */
public class MainActivity extends Activity {
    private static final String HOST = "radar.local";
    private static final String HOME = "https://" + HOST + "/";
    private static final String BINANCE = "https://fapi.binance.com";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A1112);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath() == null ? "/" : u.getPath();
                if (path.startsWith("/fapi/") || path.startsWith("/futures/data/")) return relay(u);
                return page();
            }
        });
        setContentView(web);
        web.loadUrl(HOME);
    }

    private WebResourceResponse page() {
        try {
            return new WebResourceResponse("text/html", "utf-8", getAssets().open("index.html"));
        } catch (Exception e) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
    }

    private WebResourceResponse relay(Uri u) {
        HttpURLConnection c = null;
        try {
            String q = u.getEncodedQuery();
            URL url = new URL(BINANCE + u.getEncodedPath() + (q == null ? "" : "?" + q));
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            if (code >= 300 && code < 400) code = 502;
            String reason = c.getResponseMessage();
            return reply(code, reason == null || reason.isEmpty() ? "Status" : reason, "application/json", in);
        } catch (Exception e) {
            if (c != null) c.disconnect();
            return reply(502, "Bad Gateway", "application/json", new ByteArrayInputStream("{}".getBytes()));
        }
    }

    private static WebResourceResponse reply(int code, String reason, String mime, InputStream body) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse(mime, "utf-8", code, reason, h, body);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
