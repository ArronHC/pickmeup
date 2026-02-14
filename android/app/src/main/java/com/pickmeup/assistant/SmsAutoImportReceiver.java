package com.pickmeup.assistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SmsAutoImportReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsAutoImportReceiver";

    private static final Pattern[] LOCATION_PATTERNS = {
        Pattern.compile("已(?:存入|放入|投递至|放在)([^，。；,;\\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))"),
        Pattern.compile("请(?:前往|到)([^，。；,;\\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))"),
        Pattern.compile("([^，。；,;\\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))")
    };

    private static final Pattern[] ADDRESS_PATTERNS = {
        Pattern.compile("(?:地址|取件地址|地点)[：:\\s]*([^，。；;\\n]{4,60})"),
        Pattern.compile("位于([^，。；;\\n]{4,60})")
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }

        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null || messages.length == 0) {
                return;
            }

            StringBuilder bodyBuilder = new StringBuilder();
            String sender = null;
            long messageTimestamp = 0L;

            for (SmsMessage smsMessage : messages) {
                if (smsMessage == null) {
                    continue;
                }
                if (sender == null) {
                    sender = smsMessage.getOriginatingAddress();
                }
                if (messageTimestamp <= 0L) {
                    messageTimestamp = smsMessage.getTimestampMillis();
                }
                String part = smsMessage.getMessageBody();
                if (part != null) {
                    bodyBuilder.append(part);
                }
            }

            String body = bodyBuilder.toString().trim();
            if (body.isEmpty() || !SmsRecognitionUtils.isDeliveryRelated(body)) {
                return;
            }

            String pickupCode = SmsRecognitionUtils.extractPickupCode(body);
            if (pickupCode == null || pickupCode.isEmpty()) {
                return;
            }

            long sourceTimestamp = messageTimestamp > 0L ? messageTimestamp : System.currentTimeMillis();
            JSONObject packageData = new JSONObject();
            packageData.put("id", UUID.randomUUID().toString());
            packageData.put("pickupCode", pickupCode);
            packageData.put("location", extractLocation(body));
            String address = extractAddress(body);
            if (!TextUtils.isEmpty(address)) {
                packageData.put("address", address);
            }
            packageData.put("courier", detectCourier(body, sender));
            packageData.put("timestamp", toIsoTimestamp(sourceTimestamp));
            packageData.put("sourceTimestamp", sourceTimestamp);
            packageData.put("originalText", body);
            packageData.put("isPickedUp", false);
            packageData.put("createdAt", System.currentTimeMillis());

            boolean added = SmsAutoImportStore.addPackage(context, packageData);
            if (added) {
                Log.i(TAG, "SMS auto-import queued for pickupCode=" + pickupCode);
            }
        } catch (Exception error) {
            Log.e(TAG, "Failed to process incoming SMS", error);
        }
    }

    private static String extractLocation(String text) {
        for (Pattern pattern : LOCATION_PATTERNS) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String location = sanitizeText(matcher.group(1));
                if (!location.isEmpty()) {
                    return location;
                }
            }
        }
        return "未知";
    }

    private static String extractAddress(String text) {
        for (Pattern pattern : ADDRESS_PATTERNS) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String address = sanitizeText(matcher.group(1));
                if (!address.isEmpty()) {
                    return address;
                }
            }
        }
        return null;
    }

    private static String detectCourier(String text, String sender) {
        String source = (text + " " + (sender == null ? "" : sender)).toLowerCase(Locale.ROOT);
        if (source.contains("顺丰")) return "顺丰";
        if (source.contains("中通")) return "中通";
        if (source.contains("圆通")) return "圆通";
        if (source.contains("韵达")) return "韵达";
        if (source.contains("申通")) return "申通";
        if (source.contains("极兔")) return "极兔";
        if (source.contains("京东")) return "京东";
        if (source.contains("邮政") || source.contains("ems")) return "邮政";
        if (source.contains("丰巢")) return "丰巢";
        if (source.contains("菜鸟")) return "菜鸟";
        return "未知";
    }

    private static String sanitizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[\\s\\u3000]+", " ").trim();
    }

    private static String toIsoTimestamp(long timestamp) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(timestamp));
    }
}
