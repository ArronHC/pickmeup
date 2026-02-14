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
      courier: templateResult.courier || "未知",
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
export const extractInfosFromImage = async (base64Image: string): Promise<ExtractedInfo[]> => {
  if (!base64Image) {
    throw new Error("图片内容为空");
  }

  const ocrResult = await recognizeText(base64Image);
  const text = ocrResult.text;

  if (!isLikelyPickupMessage(text)) {
    throw new Error("图片中未识别到快递取件信息");
  }

  // 尝试模板匹配
  const templateResult = matchTemplates(text);
  if (templateResult.matched && templateResult.pickupCode) {
    return [{
      pickupCode: templateResult.pickupCode,
      location: templateResult.location || "未知",
      courier: templateResult.courier || "未知",
      ...(templateResult.address ? { address: templateResult.address } : {}),
    }];
  }

  // 规则兜底
  const fallbackPickupCode = extractPickupCode(text);
  const infos = extractInfosHeuristically(text, {
    fallbackPickupCode,
  });

  const deduped = dedupeInfos(infos);
  if (deduped.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }

  return deduped;
};

// 从图片提取单条取件信息（包装函数）
export const extractInfoFromImage = async (base64Image: string): Promise<ExtractedInfo> => {
  const infos = await extractInfosFromImage(base64Image);
  if (infos.length === 0) {
    throw new Error("识别失败：未提取到取件码");
  }
  return infos[0];
};
