package com.pickmeup.assistant;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SmsRecognitionUtils {
    private static final String[] DELIVERY_KEYWORDS = {
        "取件码", "取货码", "提货码", "取件", "取货", "提货",
        "快递", "包裹", "快件", "驿站", "代收点", "快递柜", "自提柜",
        "丰巢", "菜鸟", "待取件", "已到站", "已入柜", "存入"
    };

    private static final String[] NON_DELIVERY_KEYWORDS = {
        "话费", "账单", "消费", "应付", "返费", "流量", "套餐",
        "中国移动", "中国联通", "中国电信", "本机账单",
        "短信发送", "发送2026", "发送10086", "发送10010", "发送10001"
    };

    private static final Pattern PICKUP_HINT_PATTERN = Pattern.compile(
        "取件码|取货码|提货码|凭[：:\\s]*[A-Za-z0-9\\-]{4,12}[：:\\s]*(?:取件|取货|提货)"
    );

    private static final Pattern[] PICKUP_CODE_PATTERNS = {
        Pattern.compile("(?:取件码|取货码|提货码)[：:\\s]*([A-Za-z0-9\\-]{4,12})", Pattern.CASE_INSENSITIVE),
        Pattern.compile("凭[：:\\s]*([A-Za-z0-9\\-]{4,12})[：:\\s]*(?:取件|取货|提货)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:取件|取货|提货)[：:\\s]*([A-Za-z0-9\\-]{4,12})", Pattern.CASE_INSENSITIVE)
    };

    private SmsRecognitionUtils() {
    }

    public static boolean isDeliveryRelated(String text) {
        if (text == null || text.trim().isEmpty()) {
            return false;
        }

        String normalized = normalizeText(text);
        boolean hasDeliveryKeyword = containsAny(normalized, DELIVERY_KEYWORDS);
        boolean hasPickupHint = PICKUP_HINT_PATTERN.matcher(text).find();
        if (!hasDeliveryKeyword && !hasPickupHint) {
            return false;
        }

        boolean hasNonDeliveryKeyword = containsAny(normalized, NON_DELIVERY_KEYWORDS);
        if (hasNonDeliveryKeyword && !hasPickupHint) {
            return false;
        }

        return true;
    }

    public static String extractPickupCode(String text) {
        if (!isDeliveryRelated(text)) {
            return null;
        }

        for (Pattern pattern : PICKUP_CODE_PATTERNS) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String code = normalizePickupCode(matcher.group(1));
                if (isValidPickupCode(code)) {
                    return code;
                }
            }
        }
        return null;
    }

    private static String normalizeText(String text) {
        return text.replaceAll("[\\s\\u3000]+", "").toLowerCase(Locale.ROOT);
    }

    private static boolean containsAny(String text, String[] keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private static String normalizePickupCode(String code) {
        if (code == null) {
            return "";
        }
        return code.replaceAll("\\s+", "").trim().toUpperCase(Locale.ROOT);
    }

    private static boolean isValidPickupCode(String code) {
        if (code.isEmpty() || !code.matches("[A-Z0-9\\-]{4,12}")) {
            return false;
        }

        return !"10086".equals(code) && !"10010".equals(code) && !"10000".equals(code);
    }
}
