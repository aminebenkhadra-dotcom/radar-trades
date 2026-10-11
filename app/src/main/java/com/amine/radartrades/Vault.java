package com.amine.radartrades;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Stores exchange API credentials encrypted with a key held by the Android Keystore. */
final class Vault {
    private static final String ALIAS = "radar_vault";
    private static final String PREFS = "vault";

    private Vault() {}

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build());
            kg.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    static boolean valid(String exchange) {
        return "binance".equals(exchange) || "mexc".equals(exchange) || "okx".equals(exchange);
    }

    static boolean put(Context ctx, String exchange, String apiKey, String secret, String pass) {
        if (!valid(exchange) || apiKey.isEmpty() || secret.isEmpty()) return false;
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] ct = c.doFinal((apiKey + "\n" + secret + "\n" + pass).getBytes(StandardCharsets.UTF_8));
            String v = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(exchange, v).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Returns {apiKey, secret, passphrase} or null when nothing usable is stored. */
    static String[] get(Context ctx, String exchange) {
        if (!valid(exchange)) return null;
        try {
            String v = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(exchange, null);
            if (v == null) return null;
            int i = v.indexOf(':');
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(v.substring(0, i), Base64.NO_WRAP)));
            String plain = new String(c.doFinal(Base64.decode(v.substring(i + 1), Base64.NO_WRAP)), StandardCharsets.UTF_8);
            String[] parts = plain.split("\n", -1);
            return parts.length >= 3 ? parts : null;
        } catch (Exception e) {
            return null;
        }
    }

    static boolean has(Context ctx, String exchange) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return valid(exchange) && p.contains(exchange);
    }

    static void clear(Context ctx, String exchange) {
        if (valid(exchange)) ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(exchange).apply();
    }
}
