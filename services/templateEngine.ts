// 模板匹配引擎：通过快递公司短信模板进行结构化提取

import { COURIER_TEMPLATES, CourierTemplate } from './courierTemplates';
import {
  normalizePickupCode,
  isValidPickupCode,
  extractLocationFromText,
  extractAddressFromText,
} from './pickupTextRules';

export interface TemplateMatchResult {
  matched: boolean;
  pickupCode?: string;
  location?: string;
  address?: string;
}

// 通过模板匹配提取快递信息
// senderHint 可选：短信发送者号码或名称，用于缩小候选模板范围
export function matchTemplates(text: string, senderHint?: string): TemplateMatchResult {
  // 根据 senderHint 筛选候选模板，未命中则使用全部模板
  const candidates = getCandidateTemplates(text, senderHint);

  for (const template of candidates) {
    const result = tryMatchTemplate(text, template);
    if (result.matched) {
      return result;
    }
  }

  return { matched: false };
}

// 获取候选模板列表：senderHint 命中的排前面，正文中含快递名称的排其次
function getCandidateTemplates(text: string, senderHint?: string): CourierTemplate[] {
  const senderMatched: CourierTemplate[] = [];
  const bodyMatched: CourierTemplate[] = [];
  const rest: CourierTemplate[] = [];

  for (const template of COURIER_TEMPLATES) {
    const matchesSender = senderHint
      && template.senderPatterns.some((p) => p.test(senderHint));
    const bodyContainsCourier = text.includes(template.courier);

    if (matchesSender) {
      senderMatched.push(template);
    } else if (bodyContainsCourier) {
      bodyMatched.push(template);
    } else {
      rest.push(template);
    }
  }

  return [...senderMatched, ...bodyMatched, ...rest];
}

// 清洗提取到的地点文本，去除开头的方向词前缀
const LOCATION_PREFIX_PATTERN = /^(?:到|至|在|前往|去)\s*/;

function cleanLocation(location: string): string {
  return location.replace(LOCATION_PREFIX_PATTERN, '').trim();
}

// 尝试用单个模板匹配文本
function tryMatchTemplate(text: string, template: CourierTemplate): TemplateMatchResult {
  for (const bodyPattern of template.bodyPatterns) {
    const match = bodyPattern.pattern.exec(text);
    if (!match) continue;

    const rawCode = match[bodyPattern.groups.pickupCode];
    if (!rawCode) continue;

    const pickupCode = normalizePickupCode(rawCode);
    if (!isValidPickupCode(pickupCode)) continue;

    // 从模板捕获组获取地点，若无则回退到通用提取
    const location = bodyPattern.groups.location
      ? match[bodyPattern.groups.location]?.trim()
      : undefined;
    const resolvedLocation = cleanLocation(location || extractLocationFromText(text) || "未知");

    // 从模板捕获组获取地址，若无则回退到通用提取
    const address = bodyPattern.groups.address
      ? match[bodyPattern.groups.address]?.trim()
      : undefined;
    const resolvedAddress = address || extractAddressFromText(text);

    return {
      matched: true,
      pickupCode,
      location: resolvedLocation,
      address: resolvedAddress,
    };
  }

  return { matched: false };
}
