import { ExtractedInfo } from '../types';
import { matchTemplates } from './templateEngine';
import {
  extractInfosHeuristically,
  extractPickupCodesFromAnyText,
  normalizePickupCode,
} from './pickupTextRules';

const hasUsefulValue = (value?: string): value is string =>
  Boolean(value && value.trim() && value.trim() !== '未知');

const mergeCandidate = (
  current: ExtractedInfo | undefined,
  incoming: ExtractedInfo
): ExtractedInfo => {
  const normalizedCode = normalizePickupCode(incoming.pickupCode);
  if (!current) {
    return {
      ...incoming,
      pickupCode: normalizedCode,
      location: hasUsefulValue(incoming.location) ? incoming.location.trim() : '未知',
      ...(hasUsefulValue(incoming.address) ? { address: incoming.address.trim() } : {}),
    };
  }

  return {
    ...current,
    pickupCode: normalizedCode,
    location: hasUsefulValue(current.location)
      ? current.location
      : hasUsefulValue(incoming.location)
        ? incoming.location.trim()
        : '未知',
    address: hasUsefulValue(current.address)
      ? current.address
      : hasUsefulValue(incoming.address)
        ? incoming.address.trim()
        : undefined,
    timestamp: current.timestamp || incoming.timestamp,
  };
};

export const mergeExtractedInfos = (candidates: ExtractedInfo[]): ExtractedInfo[] => {
  const merged = new Map<string, ExtractedInfo>();

  for (const candidate of candidates) {
    if (!candidate?.pickupCode) continue;
    const key = normalizePickupCode(candidate.pickupCode);
    if (!key) continue;
    merged.set(key, mergeCandidate(merged.get(key), candidate));
  }

  return [...merged.values()];
};

// OCR 文本可能同时包含多个包裹。模板结果用于补充高质量字段，
// 规则提取负责保留全部取件码，最后按取件码合并而不是首条命中即返回。
export const extractInfosFromRecognizedText = (text: string): ExtractedInfo[] => {
  const candidates: ExtractedInfo[] = [];

  try {
    const templateResult = matchTemplates(text);
    if (templateResult.matched && templateResult.pickupCode) {
      candidates.push({
        pickupCode: templateResult.pickupCode,
        location: templateResult.location || '未知',
        ...(templateResult.address ? { address: templateResult.address } : {}),
      });
    }
  } catch {
    // 模板失败不应阻止规则提取。
  }

  try {
    candidates.push(...extractInfosHeuristically(text, { strictMessageCheck: false }));
  } catch {
    // 继续尝试直接提取所有取件码。
  }

  for (const pickupCode of extractPickupCodesFromAnyText(text)) {
    candidates.push({ pickupCode, location: '未知' });
  }

  return mergeExtractedInfos(candidates);
};
