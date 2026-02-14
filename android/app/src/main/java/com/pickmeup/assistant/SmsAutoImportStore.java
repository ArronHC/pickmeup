package com.pickmeup.assistant;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class SmsAutoImportStore {
    private static final String PREFS_NAME = "pickmeup_sms_auto_import";
    private static final String KEY_PACKAGES = "packages";
    private static final int MAX_STORED_PACKAGES = 500;

    private SmsAutoImportStore() {}

    public static synchronized boolean addPackage(Context context, JSONObject packageData) {
        if (context == null || packageData == null) {
            return false;
        }

        String incomingCode = normalizePickupCode(packageData.optString("pickupCode", ""));
        if (incomingCode.isEmpty()) {
            return false;
        }

        JSONArray existing = readPackagesRaw(context);
        for (int i = 0; i < existing.length(); i++) {
            JSONObject item = existing.optJSONObject(i);
            if (item == null) {
                continue;
            }
            String currentCode = normalizePickupCode(item.optString("pickupCode", ""));
            if (incomingCode.equals(currentCode)) {
                return false;
            }
        }

        existing.put(packageData);
        JSONArray trimmed = trimToMaxSize(existing);
        writePackagesRaw(context, trimmed);
        return true;
    }

    public static synchronized JSArray getPackages(Context context) {
        JSONArray existing = readPackagesRaw(context);
        JSArray result = new JSArray();
        for (int i = 0; i < existing.length(); i++) {
            JSONObject item = existing.optJSONObject(i);
            if (item != null) {
                result.put(item);
            }
        }
        return result;
    }

    public static synchronized int clearPackages(Context context, List<String> ids) {
        if (context == null) {
            return 0;
        }

        JSONArray existing = readPackagesRaw(context);
        if (ids == null || ids.isEmpty()) {
            int cleared = existing.length();
            writePackagesRaw(context, new JSONArray());
            return cleared;
        }

        Set<String> idSet = new HashSet<>(ids);
        JSONArray kept = new JSONArray();
        int clearedCount = 0;

        for (int i = 0; i < existing.length(); i++) {
            JSONObject item = existing.optJSONObject(i);
            if (item == null) {
                continue;
            }
            String itemId = item.optString("id", "");
            if (idSet.contains(itemId)) {
                clearedCount += 1;
            } else {
                kept.put(item);
            }
        }

        writePackagesRaw(context, kept);
        return clearedCount;
    }

    private static JSONArray trimToMaxSize(JSONArray array) {
        if (array.length() <= MAX_STORED_PACKAGES) {
            return array;
        }

        JSONArray trimmed = new JSONArray();
        int start = array.length() - MAX_STORED_PACKAGES;
        for (int i = start; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item != null) {
                trimmed.put(item);
            }
        }
        return trimmed;
    }

    private static JSONArray readPackagesRaw(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PACKAGES, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static void writePackagesRaw(Context context, JSONArray array) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PACKAGES, array.toString()).apply();
    }

    private static String normalizePickupCode(String code) {
        return code == null ? "" : code.replaceAll("\\s+", "").toUpperCase().trim();
    }
}
