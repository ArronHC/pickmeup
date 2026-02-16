import { ExtractedInfo } from '../types';

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
  /(?:取件码|取货码|提货码)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,16})/i,
  /凭[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,16})(?:[：:\s]*(?:取件|取货|提货|到))?/i,
  /(?:取件|取货|提货)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,16})/i,
  /(\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{3,4}|\d{1,2}\s*-\s*\d{2,4})/,
  /码[：:\s]*([A-Za-z0-9]{4,16})/i,
  /(?:取|凭|拿)[：:\s]*(\d{4,8})/i,
];

const normalizeText = (text: string): string =>
  text.replace(/[\s\u3000]+/g, "").toLowerCase();

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

// 取件码规范化：去除空格、统一连字符格式、转大写
export const normalizePickupCode = (code: string): string =>
  code.replace(/\s*[-－]\s*/g, "-").replace(/\s+/g, "").trim().toUpperCase();

export const isValidPickupCode = (code: string): boolean => {
  const normalized = normalizePickupCode(code);
  if (!/^[A-Z0-9-]{4,16}$/.test(normalized)) {
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

// 从文本中提取取件地点
export const extractLocationFromText = (text: string): string | undefined => {
  // 优先匹配"已存入""已放入""已投入"等前缀模式
  const storedPattern =
    /(?:已存入|已放入|已投入|已投递至|已送达|已到达|已到|已存放在|已放置于)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))/g;
  const storedMatch = storedPattern.exec(text);
  if (storedMatch?.[1]) {
    return storedMatch[1].trim();
  }

  // 匹配方向性前缀后的地点（"到""至""在""前往"后面的内容）
  const directionalPattern =
    /(?:到|至|在|前往)\s*([^，。；,;\n到至在]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))/g;
  const directionalMatch = directionalPattern.exec(text);
  if (directionalMatch?.[1]) {
    return directionalMatch[1].trim();
  }

  const locationPattern =
    /([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))/g;
  const locationMatch = locationPattern.exec(text);
  if (locationMatch?.[1]) {
    return locationMatch[1].trim();
  }

  return undefined;
};

// 从文本中提取详细地址
export const extractAddressFromText = (text: string): string | undefined => {
  const patterns = [
    /(?:地址|取件地址|地点)[：:\s]*([^，。；;\n]{4,80})/i,
    /位于([^，。；;\n]{4,80})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
};

// 对提取结果按取件码去重
export const dedupeInfos = (infos: ExtractedInfo[]): ExtractedInfo[] => {
  const seen = new Set<string>();
  const result: ExtractedInfo[] = [];

  for (const info of infos) {
    const key = normalizePickupCode(info.pickupCode || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ ...info, pickupCode: key });
  }

  return result;
};

// 从任意文本中提取所有取件码
export const extractPickupCodesFromAnyText = (text: string): string[] => {
  const codes: string[] = [];

  const direct = extractPickupCode(text);
  if (direct) {
    const normalized = normalizePickupCode(direct);
    if (isValidPickupCode(normalized)) {
      codes.push(normalized);
    }
  }

  const patterns = [
    /(?:取件码|取货码|提货码|取件|取货|提货|凭)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,16})/gi,
    /(\d{1,2}\s*[-－]\s*\d{1,2}\s*[-－]\s*\d{3,4}|\d{1,2}\s*[-－]\s*\d{2,4})/g,
    /(?:凭)[：:\s]*([A-Za-z0-9-]{4,16})/gi,
    /码[：:\s]*([A-Za-z0-9]{4,16})/gi,
    /(?:取|凭|拿)[：:\s]*(\d{4,8})/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match) {
      const candidate = match[1];
      if (candidate) {
        const normalized = normalizePickupCode(candidate);
        if (isValidPickupCode(normalized)) {
          codes.push(normalized);
        }
      }
      match = pattern.exec(text);
    }
  }

  return dedupeInfos(
    codes.map((code) => ({ pickupCode: code, location: "未知" }))
  ).map((info) => info.pickupCode);
};

// 启发式提取快递信息（规则兜底）
export const extractInfosHeuristically = (
  text: string,
  opts?: {
    strictMessageCheck?: boolean;
    sourceText?: string;
    fallbackPickupCode?: string | null;
  }
): ExtractedInfo[] => {
  const strictMessageCheck = opts?.strictMessageCheck ?? false;
  const sourceText = opts?.sourceText || text;

  if (strictMessageCheck && !isLikelyPickupMessage(sourceText)) {
    throw new Error("该短信不是快递取件通知");
  }

  const fallbackCode = opts?.fallbackPickupCode
    ? normalizePickupCode(opts.fallbackPickupCode)
    : null;

  const extractedCodes = [
    ...(fallbackCode ? [fallbackCode] : []),
    ...extractPickupCodesFromAnyText(text),
    ...extractPickupCodesFromAnyText(sourceText),
  ];

  const uniqueCodes = dedupeInfos(
    extractedCodes.map((pickupCode) => ({ pickupCode, location: "未知", courier: "未知" }))
  ).map((info) => info.pickupCode);

  if (uniqueCodes.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }

  const location = extractLocationFromText(text) || extractLocationFromText(sourceText) || "未知";
  const address = extractAddressFromText(text) || extractAddressFromText(sourceText);

  return uniqueCodes.map((pickupCode) => ({
    pickupCode,
    location,
    ...(address ? { address } : {}),
  }));
};
