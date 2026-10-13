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

/** Serves the bundled page and relays its data requests to Binance's, CoinGecko's, OKX's and DefiLlama's public APIs. */
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
        if (path.startsWith("/bspot/api/v3/ticker/")) return fetch("https://api.binance.com/" + u.getEncodedPath().substring(7), u);
        if (path.startsWith("/mexc/api/v3/ticker/")) return fetch("https://api.mexc.com/" + u.getEncodedPath().substring(6), u);
        if (path.startsWith("/news/")) {
            String feed = feed(path.substring(6));
            return feed == null ? reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0])) : get(feed, "*/*", "text/plain");
        }
        if (path.startsWith("/llama/")) return fetch(LLAMA + u.getEncodedPath().substring(7), u);
        // yields: OKX public Earn rates and DefiLlama's list of DeFi pools
        if (path.equals("/okx/api/v5/finance/savings/lending-rate-summary")
                || path.matches("/okx/api/v5/finance/staking-defi/(eth|sol)/apy-history")) {
            return fetch("https://www.okx.com/" + u.getEncodedPath().substring(5), u);
        }
        if (path.equals("/yields/pools")) return get("https://yields.llama.fi/pools", "application/json", "application/json");
        try {
            return new WebResourceResponse("text/html", "utf-8", ctx.getAssets().open("index.html"));
        } catch (Exception e) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
    }

    /** The only news and sentiment sources the page can read. */
    private static String feed(String key) {
        switch (key) {
            case "cryptoast": return "https://cryptoast.fr/feed/";
            case "jdc": return "https://journalducoin.com/feed/";
            case "cointribune": return "https://www.cointribune.com/feed/";
            case "cointelegraph": return "https://cointelegraph.com/rss";
            case "coindesk": return "https://www.coindesk.com/arc/outboundfeeds/rss/";
            case "fng": return "https://api.alternative.me/fng/?limit=30";
            default: return null;
        }
    }

    private static WebResourceResponse fetch(String target, Uri u) {
        String q = u.getEncodedQuery();
        return get(target + (q == null ? "" : "?" + q), "application/json", "application/json");
    }

    private static WebResourceResponse get(String address, String accept, String mime) {
        HttpURLConnection c = null;
        try {
            URL url = new URL(address);
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("Accept", accept);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) RadarTrades");
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            if (code >= 300 && code < 400) code = 502;
            String reason = c.getResponseMessage();
            return reply(code, reason == null || reason.isEmpty() ? "Status" : reason, mime, in);
        } catch (Exception e) {
            if (c != null) c.disconnect();
            return reply(502, "Bad Gateway", mime, new ByteArrayInputStream("{}".getBytes()));
        }
    }

    private static WebResourceResponse reply(int code, String reason, String mime, InputStream body) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse(mime, "utf-8", code, reason, h, body);
    }
}
