package com.amine.radartrades;

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

/** Serves the bundled page and relays its data requests to Binance's, CoinGecko's and DefiLlama's public APIs. */
final class Relay {
    static final String HOST = "radar.local";
    static final String HOME = "https://" + HOST + "/";
    private static final String BINANCE = "https://fapi.binance.com";
    private static final String COINGECKO = "https://api.coingecko.com/api/v3/";
    private static final String LLAMA = "https://api.llama.fi/";

    private Relay() {}

    static WebResourceResponse handle(Context ctx, WebResourceRequest request) {
        Uri u = request.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath() == null ? "/" : u.getPath();
        if (path.startsWith("/fapi/") || path.startsWith("/futures/data/")) return fetch(BINANCE + u.getEncodedPath(), u);
        if (path.startsWith("/cg/")) return fetch(COINGECKO + u.getEncodedPath().substring(4), u);
        if (path.startsWith("/llama/")) return fetch(LLAMA + u.getEncodedPath().substring(7), u);
        try {
            return new WebResourceResponse("text/html", "utf-8", ctx.getAssets().open("index.html"));
        } catch (Exception e) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
    }

    private static WebResourceResponse fetch(String target, Uri u) {
        HttpURLConnection c = null;
        try {
            String q = u.getEncodedQuery();
            URL url = new URL(target + (q == null ? "" : "?" + q));
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
}
