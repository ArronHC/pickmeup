import { ExtractedInfo } from '../types';

/** 明确的可取件正向信号 */
const PICKUP_POSITIVE_KEYWORDS = [
  '取件码',
  '取货码',
  '提货码',
  '待取件',
  '已到站',
  '已入柜',
  '已存入',
  '可凭',
  '到店',
  '提取',
  '自提',
  '凭码',
];

const IN_TRANSIT_KEYWORDS = [
  '即将送达',
  '正在派送',
  '快到了',
  '派件中',
  '运输中',
  '已发货',
  '已揽收',
  '揽收成功',
  '运单号',
  '快递单号',
  '物流更新',
  '派送中',
  '预计送达',
];

const NON_DELIVERY_KEYWORDS = [
  '话费',
  '账单',
  '消费',
  '应付',
  '返费',
  '流量',
  '套餐',
  '通信',
  '中国移动',
  '中国联通',
  '中国电信',
  '短信发送',
  '发送2026',
  '发送10086',
  '发送10010',
  '发送10001',
  '本机账单',
];

/** 柜格/门店段式取件码，如 1-5-0366、5-1-1-6154 */
const SEGMENTED_CODE = String.raw`[A-Za-z0-9]{1,4}(?:\s*[-－]\s*[A-Za-z0-9]{1,4}){1,4}`;
const SIMPLE_CODE = String.raw`[A-Za-z0-9-]{4,16}`;

const EXPLICIT_PICKUP_HINT =
  /(?:取件码|取货码|提货码|可凭|凭)[：:\s]*[A-Za-z0-9-\s]{3,20}/i;

const STORE_PICKUP_HINT = /可凭[\s\S]{0,24}(?:到店|到柜|提取|取件|取货)/i;

/** 优先：可凭 / 取件码 / 凭 + 段式码 */
const PRIORITY_PICKUP_CODE_PATTERNS: RegExp[] = [
  new RegExp(String.raw`可凭\s*(${SEGMENTED_CODE})`, 'i'),
  new RegExp(String.raw`可凭\s*(${SIMPLE_CODE})`, 'i'),
  new RegExp(String.raw`(?:取件码|取货码|提货码)[：:\s]*(${SEGMENTED_CODE}|${SIMPLE_CODE})`, 'i'),
  new RegExp(
    String.raw`凭[：:\s]*(${SEGMENTED_CODE}|${SIMPLE_CODE})(?:[：:\s]*(?:取件|取货|提货|到店|到柜|提取))?`,
    'i'
  ),
];

/** 次级：有明确标签，不含裸短数字 */
const SECONDARY_PICKUP_CODE_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:取件|取货|提货)[：:\s]*(${SEGMENTED_CODE}|${SIMPLE_CODE})`, 'i'),
  new RegExp(String.raw`码[：:\s]*(${SEGMENTED_CODE}|${SIMPLE_CODE})`, 'i'),
];

const normalizeText = (text: string): string =>
  text.replace(/[\s\u3000]+/g, '').toLowerCase();

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

export const normalizePickupCode = (code: string): string =>
  code.replace(/\s*[-－]\s*/g, '-').replace(/\s+/g, '').trim().toUpperCase();

export const isValidPickupCode = (code: string): boolean => {
  const normalized = normalizePickupCode(code);
  if (!/^[A-Z0-9-]{4,16}$/.test(normalized)) {
    return false;
  }

  // 运营商客服号
  if (normalized === '10086' || normalized === '10010' || normalized === '10000') {
    return false;
  }

  // 无连字符的长数字串更像运单号
  if (/^\d{10,}$/.test(normalized)) {
    return false;
  }

  // 纯 4 位短数字且无连字符：易与「快递0366」尾号混淆，仅当整体像柜格时放行
  // 段式码 1-5-0366 含连字符，可通过
  if (/^\d{4,6}$/.test(normalized) && !normalized.includes('-')) {
    return false;
  }

  return true;
};

const hasExplicitPickupSignal = (text: string): boolean => {
  if (EXPLICIT_PICKUP_HINT.test(text) || STORE_PICKUP_HINT.test(text)) {
    return true;
  }
  const normalized = normalizeText(text);
  return containsAny(normalized, PICKUP_POSITIVE_KEYWORDS);
};

export const isLikelyPickupMessage = (text: string): boolean => {
  if (!text || !text.trim()) {
    return false;
  }

  const normalized = normalizeText(text);
  const hasPickupSignal = hasExplicitPickupSignal(text);

  if (!hasPickupSignal) {
    return false;
  }

  if (containsAny(normalized, NON_DELIVERY_KEYWORDS) && !EXPLICIT_PICKUP_HINT.test(text)) {
    return false;
  }

  // 在途/运单提醒：无「取件码/可凭」类明确标签时拒绝
  const hasStrongPickupLabel =
    /取件码|取货码|提货码|可凭/.test(text) || STORE_PICKUP_HINT.test(text);
  if (containsAny(normalized, IN_TRANSIT_KEYWORDS) && !hasStrongPickupLabel) {
    return false;
  }

  return true;
};

const tryExtractWithPatterns = (text: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1];
    if (candidate && isValidPickupCode(candidate)) {
      return normalizePickupCode(candidate);
    }
  }
  return null;
};

export const extractPickupCode = (text: string): string | null => {
  if (!isLikelyPickupMessage(text)) {
    return null;
  }

  const priority = tryExtractWithPatterns(text, PRIORITY_PICKUP_CODE_PATTERNS);
  if (priority) {
    return priority;
  }

  return tryExtractWithPatterns(text, SECONDARY_PICKUP_CODE_PATTERNS);
};

export const extractLocationFromText = (text: string): string | undefined => {
  // 到店 XXX 提取 / 到柜
  const storePattern =
    /到店\s*([^，。；,;\n]{2,48}?)(?:提取|取件|取货|自提)/;
  const storeMatch = storePattern.exec(text);
  if (storeMatch?.[1]) {
    return storeMatch[1].trim();
  }

  // 已到 / 已存入 … 地点
  const arrivedPattern =
    /(?:已到|已存入|已放入|已投入|已投递至|已送达|已到达|已存放在|已放置于)\s*([^，。；,;\n]{2,48}?)(?:[，,。；;]|$|，可凭|可凭)/;
  const arrivedMatch = arrivedPattern.exec(text);
  if (arrivedMatch?.[1]) {
    const locationText = arrivedMatch[1].trim();
    if (locationText.length >= 2) {
      return locationText;
    }
  }

  const storedPattern =
    /(?:已存入|已放入|已投入|已投递至|已送达|已到达|已到|已存放在|已放置于)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点|店))/g;
  const storedMatch = storedPattern.exec(text);
  if (storedMatch?.[1]) {
    return storedMatch[1].trim();
  }

  const directionalPattern =
    /(?:到|至|在|前往)\s*([^，。；,;\n到至在]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点|店))/g;
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

export const dedupeInfos = (infos: ExtractedInfo[]): ExtractedInfo[] => {
  const seen = new Set<string>();
  const result: ExtractedInfo[] = [];

  for (const info of infos) {
    const key = normalizePickupCode(info.pickupCode || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ ...info, pickupCode: key });
  }

  return result;
};

export const extractPickupCodesFromAnyText = (text: string): string[] => {
  const codes: string[] = [];

  const direct = extractPickupCode(text);
  if (direct) {
    codes.push(direct);
  }

  for (const pattern of [...PRIORITY_PICKUP_CODE_PATTERNS, ...SECONDARY_PICKUP_CODE_PATTERNS]) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null = globalPattern.exec(text);
    while (match) {
      const candidate = match[1];
      if (candidate) {
        const normalized = normalizePickupCode(candidate);
        if (isValidPickupCode(normalized)) {
          codes.push(normalized);
        }
      }
      match = globalPattern.exec(text);
    }
  }

  return dedupeInfos(
    codes.map((code) => ({ pickupCode: code, location: '未知' }))
  ).map((info) => info.pickupCode);
};

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
    throw new Error('该短信不是快递取件通知');
  }

  const fallbackCode = opts?.fallbackPickupCode
    ? normalizePickupCode(opts.fallbackPickupCode)
    : null;

  const extractedCodes = [
    ...(fallbackCode && isValidPickupCode(fallbackCode) ? [fallbackCode] : []),
    ...extractPickupCodesFromAnyText(text),
    ...extractPickupCodesFromAnyText(sourceText),
  ];

  const uniqueCodes = dedupeInfos(
    extractedCodes.map((pickupCode) => ({ pickupCode, location: '未知', courier: '未知' }))
  ).map((info) => info.pickupCode);

  if (uniqueCodes.length === 0) {
    throw new Error('识别失败：未提取到取件码');
  }

  // 仅返回优先码：若有多码，优先段式（含 -）的最长合理码
  const preferredCodes = uniqueCodes.length === 1
    ? uniqueCodes
    : (() => {
        const segmented = uniqueCodes.filter((code) => code.includes('-'));
        if (segmented.length > 0) {
          return [segmented.sort((left, right) => right.length - left.length)[0]];
        }
        return [uniqueCodes[0]];
      })();

  const location =
    extractLocationFromText(text) || extractLocationFromText(sourceText) || '未知';
  const address = extractAddressFromText(text) || extractAddressFromText(sourceText);

  return preferredCodes.map((pickupCode) => ({
    pickupCode,
    location,
    ...(address ? { address } : {}),
  }));
};
