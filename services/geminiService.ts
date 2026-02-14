import { ExtractedInfo } from "../types";
import {
  extractPickupCode,
  isLikelyPickupMessage,
  isValidPickupCode,
} from "./pickupTextRules";

const API_URL = "https://models.github.ai/inference/chat/completions";
const MODEL = "gpt-4o";

const getApiKey = () => {
  const key =
    (process.env as any).VITE_GH_AI_KEY ||
    (process.env as any).VITE_API_KEY ||
    (process.env as any).VITE_OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "缺少 API Key，请在环境变量中设置 VITE_GH_AI_KEY（或 VITE_API_KEY / VITE_OPENAI_API_KEY）"
    );
  }
  return key as string;
};

const normalizePickupCode = (code: string): string =>
  code.replace(/\s*[-－]\s*/g, "-").replace(/\s+/g, "").trim().toUpperCase();

const toSafeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

const pickFirstValue = (data: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = toSafeString((data as any)[key]);
      if (value) return value;
    }
  }
  return undefined;
};

const dedupeInfos = (infos: ExtractedInfo[]): ExtractedInfo[] => {
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

const extractCourierFromText = (text: string): string | undefined => {
  const source = text.toLowerCase();
  if (source.includes("顺丰")) return "顺丰";
  if (source.includes("中通")) return "中通";
  if (source.includes("圆通")) return "圆通";
  if (source.includes("韵达")) return "韵达";
  if (source.includes("申通")) return "申通";
  if (source.includes("极兔")) return "极兔";
  if (source.includes("京东")) return "京东";
  if (source.includes("邮政") || source.includes("ems")) return "邮政";
  if (source.includes("丰巢")) return "丰巢";
  if (source.includes("菜鸟")) return "菜鸟";
  return undefined;
};

const extractLocationFromText = (text: string): string | undefined => {
  const directionalPattern =
    /(?:到|至|在|前往)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜|门店|站点|取件点))/g;
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

const extractAddressFromText = (text: string): string | undefined => {
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

const extractPickupCodesFromAnyText = (text: string): string[] => {
  const codes: string[] = [];

  const direct = extractPickupCode(text);
  if (direct) {
    const normalized = normalizePickupCode(direct);
    if (isValidPickupCode(normalized)) {
      codes.push(normalized);
    }
  }

  const patterns = [
    /(?:取件码|取货码|提货码|取件|取货|提货|凭)[：:\s]*([A-Za-z0-9]{1,4}(?:[-\s][A-Za-z0-9]{1,4}){1,3}|[A-Za-z0-9-]{4,12})/gi,
    /(\d{1,2}\s*[-－]\s*\d{1,2}\s*[-－]\s*\d{3,4})/g,
    /(?:凭)[：:\s]*([A-Za-z0-9-]{4,12})/gi,
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
    codes.map((code) => ({ pickupCode: code, location: "未知", courier: "未知" }))
  ).map((info) => info.pickupCode);
};

const extractInfosHeuristically = (
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
  const courier = extractCourierFromText(text) || extractCourierFromText(sourceText) || "未知";
  const address = extractAddressFromText(text) || extractAddressFromText(sourceText);

  return uniqueCodes.map((pickupCode) => ({
    pickupCode,
    location,
    courier,
    ...(address ? { address } : {}),
  }));
};

const extractJsonObject = (content: string): any | null => {
  const trimmed = content.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continue
    }
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // continue
    }
  }

  return null;
};

const getCandidateObjects = (data: any): Record<string, unknown>[] => {
  const candidates: Record<string, unknown>[] = [];

  const pushObject = (obj: any) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      candidates.push(obj as Record<string, unknown>);
    }
  };

  if (Array.isArray(data)) {
    data.forEach(pushObject);
    return candidates;
  }

  if (data && typeof data === "object") {
    pushObject(data);
    const listKeys = ["items", "packages", "results", "list", "data", "deliveries"];
    for (const key of listKeys) {
      const value = (data as any)[key];
      if (Array.isArray(value)) {
        value.forEach(pushObject);
      }
    }
  }

  return candidates;
};

const normalizeCandidateInfo = (
  item: Record<string, unknown>,
  rawContent?: string,
  fallbackPickupCode?: string | null
): ExtractedInfo | null => {
  const pickupCodeRaw =
    pickFirstValue(item, [
      "pickupCode",
      "pickup_code",
      "code",
      "pickup",
      "取件码",
      "取货码",
      "提货码",
    ]) || fallbackPickupCode || undefined;

  if (!pickupCodeRaw) return null;

  const pickupCode = normalizePickupCode(pickupCodeRaw);
  if (!isValidPickupCode(pickupCode)) return null;

  const location =
    pickFirstValue(item, [
      "location",
      "pickupLocation",
      "pickup_location",
      "station",
      "site",
      "取件地点",
      "地点",
    ]) || extractLocationFromText(rawContent || "") || "未知";

  const courier =
    pickFirstValue(item, [
      "courier",
      "company",
      "express",
      "expressCompany",
      "快递公司",
      "快递",
    ]) || extractCourierFromText(rawContent || "") || "未知";

  const address =
    pickFirstValue(item, ["address", "pickupAddress", "pickup_address", "地址", "详细地址"]) ||
    extractAddressFromText(rawContent || "");

  const timestamp = pickFirstValue(item, ["timestamp", "time", "date", "时间"]);

  return {
    pickupCode,
    location,
    courier,
    ...(address ? { address } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
};

const parseJsonContentList = (
  content: string,
  sourceText?: string,
  fallbackPickupCode?: string | null,
  strictMessageCheck = false
): ExtractedInfo[] => {
  if (strictMessageCheck && sourceText && !isLikelyPickupMessage(sourceText)) {
    throw new Error("该短信不是快递取件通知");
  }

  const data = extractJsonObject(content);
  if (data) {
    const infos = getCandidateObjects(data)
      .map((candidate) => normalizeCandidateInfo(candidate, content, fallbackPickupCode))
      .filter((item): item is ExtractedInfo => Boolean(item));

    const dedupedInfos = dedupeInfos(infos);
    if (dedupedInfos.length > 0) {
      return dedupedInfos;
    }
  }

  return extractInfosHeuristically(content, {
    strictMessageCheck,
    sourceText,
    fallbackPickupCode,
  });
};

const parseJsonContent = (
  content: string,
  sourceText?: string,
  fallbackPickupCode?: string | null,
  strictMessageCheck = false
): ExtractedInfo => {
  const infos = parseJsonContentList(content, sourceText, fallbackPickupCode, strictMessageCheck);
  if (infos.length === 0) {
    throw new Error("识别结果不完整");
  }
  return infos[0];
};

const callModelApi = async (messages: any[]): Promise<string> => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API 请求失败: ${response.status} ${text}`);
  }

  const data = await response.json();
  const messageContent = data?.choices?.[0]?.message?.content;

  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    const content = messageContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();

    if (content) {
      return content;
    }
  }

  throw new Error("API 未返回有效内容");
};

const callExtractionApi = async (
  messages: any[],
  sourceText?: string,
  fallbackPickupCode?: string | null,
  strictMessageCheck = false
) => {
  const content = await callModelApi(messages);
  return parseJsonContent(content, sourceText, fallbackPickupCode, strictMessageCheck);
};

const callExtractionApiList = async (
  messages: any[],
  sourceText?: string,
  fallbackPickupCode?: string | null,
  strictMessageCheck = false
) => {
  const content = await callModelApi(messages);
  return parseJsonContentList(content, sourceText, fallbackPickupCode, strictMessageCheck);
};

export const extractInfoFromText = async (text: string): Promise<ExtractedInfo> => {
  if (!isLikelyPickupMessage(text)) {
    throw new Error("该短信不是快递取件通知");
  }

  const now = new Date().toISOString();
  const fallbackPickupCode = extractPickupCode(text);
  const system = `你是一个物流信息提取助手。请只返回 JSON，不要包含其他文本。
必须返回以下字段：
- pickupCode: 取件码
- location: 取件地点
- courier: 快递公司或平台
可选字段：
- address: 详细地址（通常在“地址：”后）
- timestamp: ISO 8601 时间字符串（若有相对时间请基于当前时间换算）
如果没有时间，请不要猜测 timestamp。`;

  const user = `当前时间: ${now}
短信/文本内容: """${text}"""`;

  return callExtractionApi(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text,
    fallbackPickupCode,
    true
  );
};

export const extractInfosFromImage = async (base64Image: string): Promise<ExtractedInfo[]> => {
  if (!base64Image) {
    throw new Error("图片内容为空");
  }

  const now = new Date().toISOString();
  const system = `你是一个物流信息提取助手。请只返回 JSON，不要包含其他文本。
如果图片中有多个包裹，请返回数组，每个元素都包含以下字段：
- pickupCode: 取件码
- location: 取件地点
- courier: 快递公司或平台
可选字段：
- address: 详细地址（通常在“地址：”后）
- timestamp: ISO 8601 时间字符串（若有相对时间请基于当前时间换算）
如果图片只有一个包裹，也可以返回单个对象。`;

  const userContent = [
    {
      type: "text",
      text: `当前时间: ${now}\n请从图片中提取全部取件信息并只输出 JSON。`,
    },
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Image}`,
      },
    },
  ];

  try {
    const infos = await callExtractionApiList([
      { role: "system", content: system },
      { role: "user", content: userContent },
    ]);
    const deduped = dedupeInfos(infos);
    if (deduped.length === 0) {
      throw new Error("识别失败：未提取到取件码");
    }
    return deduped;
  } catch (firstError) {
    const ocrSystem = `你是 OCR 助手。请完整抄录图片中的所有可见文字，不要总结，不要解释。`;
    const ocrUserContent = [
      {
        type: "text",
        text: "请逐行输出图片中的文字。",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`,
        },
      },
    ];

    try {
      const ocrText = await callModelApi([
        { role: "system", content: ocrSystem },
        { role: "user", content: ocrUserContent },
      ]);
      const infos = parseJsonContentList(ocrText);
      const deduped = dedupeInfos(infos);
      if (deduped.length === 0) {
        throw firstError;
      }
      return deduped;
    } catch {
      throw firstError;
    }
  }
};

export const extractInfoFromImage = async (base64Image: string): Promise<ExtractedInfo> => {
  const infos = await extractInfosFromImage(base64Image);
  if (infos.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }
  return infos[0];
};
