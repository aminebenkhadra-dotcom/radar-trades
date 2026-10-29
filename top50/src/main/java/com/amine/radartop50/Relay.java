package com.amine.radartop50;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/** Serves the bundled page and relays its requests to Binance Futures' public market data (USDT contracts only). */
final class Relay {
    static final String HOST = "radar.local";
    static final String HOME = "https://" + HOST + "/";
    private static final String BINANCE = "https://fapi.binance.com";

    private Relay() {}

    static WebResourceResponse handle(Context ctx, WebResourceRequest request) {
        Uri u = request.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath() == null ? "/" : u.getPath();
        if (path.matches("/fapi/v1/(klines|ticker/24hr|exchangeInfo|premiumIndex)")) {
            String sym = u.getQueryParameter("symbol");
            if (sym != null && !sym.matches("[A-Z0-9]{2,20}USDT")) return reply(403, "Forbidden", "application/json", new ByteArrayInputStream("{}".getBytes()));
            String q = u.getEncodedQuery();
            return get(BINANCE + u.getEncodedPath() + (q == null ? "" : "?" + q));
        }
        try {
            return new WebResourceResponse("text/html", "utf-8", ctx.getAssets().open("index.html"));
        } catch (Exception e) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
    }

    private static WebResourceResponse get(String address) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(address).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) RadarTop50");
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
}
