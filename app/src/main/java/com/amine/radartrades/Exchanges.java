package com.amine.radartrades;

import android.content.Context;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signed account queries for the portfolio tab. Only the fixed, read-only requests below can be
 * sent: the page chooses one by name and never supplies a URL, so it cannot place or cancel orders.
 */
final class Exchanges {
    private Exchanges() {}

    /** Returns {http status, body}. Status 0 means the request never got an answer. */
    static String[] call(Context ctx, String exchange, String name) {
        try {
            String[] cred = Vault.get(ctx, exchange);
            if (cred == null) return new String[]{"401", "{\"msg\":\"Aucune clé enregistrée pour ce compte\"}"};
            if ("binance".equals(exchange)) return binance(cred, name);
            if ("mexc".equals(exchange)) return mexc(cred, name);
            if ("okx".equals(exchange)) return okx(cred, name);
            return new String[]{"400", "{\"msg\":\"Plateforme inconnue\"}"};
        } catch (Exception e) {
            return new String[]{"0", "{\"msg\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}"};
        }
    }

    private static final String[] BAD = {"400", "{\"msg\":\"Requête inconnue\"}"};

    private static String[] binance(String[] cred, String name) throws Exception {
        String host = "https://api.binance.com", path, method = "GET", extra = "";
        // a few queries take one value after a colon: a contract (BTCUSDT) or a coin (SOL), letters and digits only
        String arg = null;
        int colon = name.indexOf(':');
        if (colon > 0 && !name.startsWith("inc:")) {
            arg = name.substring(colon + 1);
            name = name.substring(0, colon);
            boolean contract = name.equals("ord") || name.equals("algo");
            if (!arg.matches(contract ? "[A-Z0-9]{2,24}" : "[A-Z0-9]{1,15}")) return BAD;
            switch (name) {
                case "ord": host = "https://fapi.binance.com"; path = "/fapi/v1/openOrders"; extra = "symbol=" + arg + "&"; break;
                case "algo": host = "https://fapi.binance.com"; path = "/fapi/v1/openAlgoOrders"; extra = "symbol=" + arg + "&"; break;
                case "earnF": path = "/sapi/v1/simple-earn/flexible/list"; extra = "asset=" + arg + "&current=1&size=100&"; break;
                case "earnLk": path = "/sapi/v1/simple-earn/locked/list"; extra = "asset=" + arg + "&current=1&size=100&"; break;
                case "chainLk": path = "/sapi/v1/onchain-yields/locked/list"; extra = "asset=" + arg + "&current=1&size=100&"; break;
                case "soft": path = "/sapi/v1/soft-staking/list"; extra = "asset=" + arg + "&current=1&size=100&"; break;
                default: return BAD;
            }
            String q = extra + "recvWindow=10000&timestamp=" + System.currentTimeMillis();
            return http(method, host + path + "?" + q + "&signature=" + hex(hmac(cred[1], q)), new String[]{"X-MBX-APIKEY", cred[0]});
        }
        if (name.startsWith("inc:")) {
            // realised results of the futures account: inc:<type>:<days>
            String[] p = name.split(":");
            boolean type = p.length == 3 && (p[1].equals("REALIZED_PNL") || p[1].equals("COMMISSION") || p[1].equals("FUNDING_FEE"));
            boolean days = p.length == 3 && (p[2].equals("7") || p[2].equals("30") || p[2].equals("90"));
            if (!type || !days) return new String[]{"400", "{\"msg\":\"Requête inconnue\"}"};
            long start = System.currentTimeMillis() - Long.parseLong(p[2]) * 86400000L;
            String q = "incomeType=" + p[1] + "&startTime=" + start + "&limit=1000&recvWindow=10000&timestamp=" + System.currentTimeMillis();
            return http("GET", "https://fapi.binance.com/fapi/v1/income?" + q + "&signature=" + hex(hmac(cred[1], q)),
                    new String[]{"X-MBX-APIKEY", cred[0]});
        }
        switch (name) {
            case "spot": path = "/api/v3/account"; extra = "omitZeroBalances=true&"; break;
            case "fund": path = "/sapi/v1/asset/get-funding-asset"; method = "POST"; break;
            case "wallets": path = "/sapi/v1/asset/wallet/balance"; break;
            case "earnL": path = "/sapi/v1/simple-earn/locked/position"; extra = "size=100&"; break;
            case "onchain": path = "/sapi/v1/onchain-yields/locked/position"; extra = "size=100&"; break;
            case "fut": host = "https://fapi.binance.com"; path = "/fapi/v2/account"; break;
            case "pos": host = "https://fapi.binance.com"; path = "/fapi/v2/positionRisk"; break;
            case "wbeth": path = "/sapi/v1/eth-staking/eth/history/rateHistory"; extra = "current=1&size=100&"; break;
            case "bnsol": path = "/sapi/v1/sol-staking/sol/history/rateHistory"; extra = "current=1&size=100&"; break;
            default: return BAD;
        }
        String q = extra + "recvWindow=10000&timestamp=" + System.currentTimeMillis();
        String url = host + path + "?" + q + "&signature=" + hex(hmac(cred[1], q));
        return http(method, url, new String[]{"X-MBX-APIKEY", cred[0]});
    }

    private static String[] mexc(String[] cred, String name) throws Exception {
        if ("spot".equals(name)) {
            String q = "recvWindow=10000&timestamp=" + System.currentTimeMillis();
            String url = "https://api.mexc.com/api/v3/account?" + q + "&signature=" + hex(hmac(cred[1], q));
            return http("GET", url, new String[]{"X-MEXC-APIKEY", cred[0], "Content-Type", "application/json"});
        }
        String path;
        if ("fut".equals(name)) path = "/api/v1/private/account/assets";
        else if ("pos".equals(name)) path = "/api/v1/private/position/open_positions";
        else return new String[]{"400", "{\"msg\":\"Requête inconnue\"}"};
        String ts = String.valueOf(System.currentTimeMillis());
        return http("GET", "https://contract.mexc.com" + path, new String[]{
                "ApiKey", cred[0], "Request-Time", ts, "Signature", hex(hmac(cred[1], cred[0] + ts)),
                "Content-Type", "application/json"});
    }

    private static String[] okx(String[] cred, String name) throws Exception {
        String path;
        switch (name) {
            case "bal": path = "/api/v5/account/balance"; break;
            case "val": path = "/api/v5/asset/asset-valuation?ccy=USDT"; break;
            case "fund": path = "/api/v5/asset/balances"; break;
            case "pos": path = "/api/v5/account/positions"; break;
            case "save": path = "/api/v5/finance/savings/balance"; break;
            case "stake": path = "/api/v5/finance/staking-defi/orders-active"; break;
            case "fixed": path = "/api/v5/finance/fixed-loan/lending-orders-list"; break;
            default: return new String[]{"400", "{\"msg\":\"Requête inconnue\"}"};
        }
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        String ts = f.format(new Date());
        String sign = Base64.encodeToString(hmac(cred[1], ts + "GET" + path), Base64.NO_WRAP);
        return http("GET", "https://www.okx.com" + path, new String[]{
                "OK-ACCESS-KEY", cred[0], "OK-ACCESS-SIGN", sign, "OK-ACCESS-TIMESTAMP", ts,
                "OK-ACCESS-PASSPHRASE", cred[2], "Content-Type", "application/json"});
    }

    private static byte[] hmac(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format(Locale.US, "%02x", x & 0xff));
        return sb.toString();
    }

    private static String[] http(String method, String url, String[] headers) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(25000);
            c.setRequestMethod(method);
            c.setRequestProperty("Accept", "application/json");
            for (int i = 0; i + 1 < headers.length; i += 2) c.setRequestProperty(headers[i], headers[i + 1]);
            if ("POST".equals(method)) {
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(0);
                c.getOutputStream().close();
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (in != null) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close();
            }
            String body = new String(out.toByteArray(), StandardCharsets.UTF_8);
            return new String[]{String.valueOf(code), body.isEmpty() ? "{}" : body};
        } finally {
            c.disconnect();
        }
    }
}
