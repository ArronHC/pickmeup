const DELIVERY_KEYWORDS = [
  "取件码",
  "取货码",
  "提货码",
  "取件",
  "取货",
  "提货",
  "快递",
  "包裹",
  "快件",
  "驿站",
  "代收点",
  "快递柜",
  "自提柜",
  "丰巢",
  "菜鸟",
  "待取件",
  "已到站",
  "已入柜",
  "存入",
];

const NON_DELIVERY_KEYWORDS = [
  "话费",
  "账单",
  "消费",
  "应付",
  "返费",
  "流量",
  "套餐",
  "通信",
  "中国移动",
  "中国联通",
  "中国电信",
  "短信发送",
  "发送2026",
  "发送10086",
  "发送10010",
  "发送10001",
  "本机账单",
];

const PICKUP_HINT_PATTERN =
  /(取件码|取货码|提货码|凭[：:\s]*[A-Za-z0-9-\s]{4,16}(?:[：:\s]*(?:取件|取货|提货|到))?)/i;

const PICKUP_CODE_PATTERNS: RegExp[] = [
  /(?:取件码|取货码|提货码)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,12})/i,
  /凭[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,12})(?:[：:\s]*(?:取件|取货|提货|到))?/i,
  /(?:取件|取货|提货)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,12})/i,
  /(\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{3,4})/,
];

const normalizeText = (text: string): string =>
  text.replace(/[\s\u3000]+/g, "").toLowerCase();

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

const normalizePickupCode = (code: string): string =>
  code.replace(/\s*-\s*/g, "-").replace(/\s+/g, "").trim().toUpperCase();

export const isValidPickupCode = (code: string): boolean => {
  const normalized = normalizePickupCode(code);
  if (!/^[A-Z0-9-]{4,12}$/.test(normalized)) {
    return false;
  }

  if (normalized === "10086" || normalized === "10010" || normalized === "10000") {
    return false;
  }

  return true;
};

export const isLikelyPickupMessage = (text: string): boolean => {
  if (!text || !text.trim()) {
    return false;
  }

  const normalized = normalizeText(text);
  const hasDeliveryKeyword = containsAny(normalized, DELIVERY_KEYWORDS);
  const hasPickupHint = PICKUP_HINT_PATTERN.test(text);
  if (!hasDeliveryKeyword && !hasPickupHint) {
    return false;
  }

  const hasNonDeliveryKeyword = containsAny(normalized, NON_DELIVERY_KEYWORDS);
  if (hasNonDeliveryKeyword && !hasPickupHint) {
    return false;
  }

  return true;
};

export const extractPickupCode = (text: string): string | null => {
  if (!isLikelyPickupMessage(text)) {
    return null;
  }

  for (const pattern of PICKUP_CODE_PATTERNS) {
    const match = text.match(pattern);
    const candidate = match?.[1];
    if (candidate && isValidPickupCode(candidate)) {
      return normalizePickupCode(candidate);
    }
  }

  return null;
};
