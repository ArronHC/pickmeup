// 本地 OCR 服务：使用 Tesseract.js 在浏览器端识别图片文字

import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

// 识别图片中的文字，支持中文简体和英文
export async function recognizeText(base64Image: string): Promise<OcrResult> {
  if (!base64Image) {
    throw new Error("图片内容为空");
  }

  const imageData = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const result = await Tesseract.recognize(imageData, 'chi_sim+eng', {
    logger: () => {},
  });

  const text = result.data.text?.trim() || '';
  const confidence = result.data.confidence ?? 0;

  if (!text) {
    throw new Error("OCR 未能识别出任何文字");
  }

  return { text, confidence };
}
