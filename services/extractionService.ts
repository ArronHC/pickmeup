// 统一信息提取服务入口
// 完全本地化，无 AI API 依赖

import { ExtractedInfo } from '../types';
import { matchTemplates } from './templateEngine';
import { recognizeText } from './ocrService';
import {
  isLikelyPickupMessage,
  extractPickupCode,
  extractInfosHeuristically,
  dedupeInfos,
  extractPickupCodesFromAnyText,
} from './pickupTextRules';

// 从文本提取取件信息
// 流程：快递短信判定 → 模板匹配 → 规则兜底
export const extractInfoFromText = async (text: string): Promise<ExtractedInfo> => {
  if (!isLikelyPickupMessage(text)) {
    throw new Error("该短信不是快递取件通知");
  }

  // 阶段一：模板匹配
  const templateResult = matchTemplates(text);
  if (templateResult.matched && templateResult.pickupCode) {
    return {
      pickupCode: templateResult.pickupCode,
      location: templateResult.location || "未知",
      ...(templateResult.address ? { address: templateResult.address } : {}),
    };
  }

  // 阶段二：规则兜底
  const fallbackPickupCode = extractPickupCode(text);
  const infos = extractInfosHeuristically(text, {
    strictMessageCheck: true,
    fallbackPickupCode,
  });

  if (infos.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }

  return infos[0];
};

// 从图片提取多条取件信息：OCR 识别文字 → 模板匹配 → 规则兜底
export const extractInfosFromImage = async (imageInput: string): Promise<ExtractedInfo[]> => {
  if (!imageInput) {
    throw new Error("图片内容为空");
  }

  // OCR 识别阶段
  let text: string;
  try {
    const ocrResult = await recognizeText(imageInput);
    text = ocrResult.text;
  } catch (err) {
    const detail = err instanceof Error ? err.message : '未知错误';
    throw new Error(`OCR 识别失败：${detail}`);
  }

  // 模板匹配阶段
  try {
    const templateResult = matchTemplates(text);
    if (templateResult.matched && templateResult.pickupCode) {
      return [{
        pickupCode: templateResult.pickupCode,
        location: templateResult.location || "未知",
        ...(templateResult.address ? { address: templateResult.address } : {}),
      }];
    }
  } catch {
    // 模板匹配失败，继续规则兜底
  }

  // 规则兜底阶段（不启用严格短信判定）
  try {
    const fallbackPickupCode = extractPickupCode(text);
    const infos = extractInfosHeuristically(text, {
      strictMessageCheck: false,
      fallbackPickupCode,
    });

    const deduped = dedupeInfos(infos);
    if (deduped.length > 0) {
      return deduped;
    }
  } catch {
    // 规则兜底失败，尝试最终提取
  }

  // 最终尝试：直接从 OCR 文本中提取取件码
  const codes = extractPickupCodesFromAnyText(text);
  if (codes.length > 0) {
    return codes.map((pickupCode) => ({
      pickupCode,
      location: "未知",
    }));
  }

  throw new Error("图片中未识别到取件码，请尝试更清晰的截图");
};

// 从图片提取单条取件信息（包装函数）
export const extractInfoFromImage = async (base64Image: string): Promise<ExtractedInfo> => {
  const infos = await extractInfosFromImage(base64Image);
  if (infos.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }
  return infos[0];
};
