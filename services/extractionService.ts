// 统一信息提取服务入口
// 完全本地化，无 AI API / OCR 依赖

import { ExtractedInfo } from '../types';
import { matchTemplates } from './templateEngine';
import {
  isLikelyPickupMessage,
  extractPickupCode,
  extractInfosHeuristically,
} from './pickupTextRules';
import { detectCourierName } from './courierIcons';

// 从文本提取取件信息（同步，便于批量导入时避免无意义的 microtask 切换）
// 流程：快递短信判定 → 模板匹配 → 规则兜底
export const extractInfoFromTextSync = (text: string): ExtractedInfo => {
  if (!isLikelyPickupMessage(text)) {
    throw new Error('该短信不是快递取件通知');
  }

  const templateResult = matchTemplates(text);
  if (templateResult.matched && templateResult.pickupCode) {
    return {
      pickupCode: templateResult.pickupCode,
      location: templateResult.location || '未知',
      courier: detectCourierName(text, templateResult.courier),
      ...(templateResult.address ? { address: templateResult.address } : {}),
    };
  }

  const fallbackPickupCode = extractPickupCode(text);
  const infos = extractInfosHeuristically(text, {
    strictMessageCheck: true,
    fallbackPickupCode,
  });

  if (infos.length === 0) {
    throw new Error('识别失败：未提取到取件码');
  }

  const first = infos[0];
  return {
    ...first,
    courier: detectCourierName(text, first.courier),
  };
};

export const extractInfoFromText = async (text: string): Promise<ExtractedInfo> =>
  extractInfoFromTextSync(text);
