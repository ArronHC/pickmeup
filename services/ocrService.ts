// 本地 OCR 服务：使用 Tesseract.js 在浏览器端识别图片文字

import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

// Canvas 图片预处理：灰度化 + 对比度增强，提升 OCR 识别率
function preprocessImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const contrastFactor = 1.5;
        for (let i = 0; i < data.length; i += 4) {
          // 灰度化（加权平均）
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // 对比度增强
          const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrastFactor + 128));
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // 预处理失败时降级返回原图
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// 识别图片中的文字，支持中文简体和英文
export async function recognizeText(imageInput: string): Promise<OcrResult> {
  if (!imageInput) {
    throw new Error("图片内容为空");
  }

  const dataUrl = imageInput.startsWith('data:')
    ? imageInput
    : `data:image/jpeg;base64,${imageInput}`;

  // 预处理图片以提升识别率
  const processedImage = await preprocessImage(dataUrl);

  const worker = await Tesseract.createWorker('chi_sim+eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    });

    const result = await worker.recognize(processedImage);
    const text = result.data.text?.trim() || '';
    const confidence = result.data.confidence ?? 0;

    if (!text) {
      throw new Error("OCR 未能识别出任何文字");
    }

    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}
