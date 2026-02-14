# 本地提取方案设计：去除 AI 依赖

**日期**：2026-02-15
**状态**：已批准

## 背景与目标

当前取件助手使用 GitHub Models API (GPT-4o) 进行快递信息提取，存在以下问题：
- 依赖外部 API Key，无法完全离线使用
- 用户短信/截图内容发送到第三方服务，存在隐私顾虑
- API 可能超时、限流，影响可靠性

**目标**：用本地方案完全替代 AI 提取，实现完全离线、零隐私泄露的信息提取。

## 方案选择

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: 模板+规则（已选）** | 快递公司专用模板 + 增强通用规则 | 准确率高、零延迟、可维护 | 新格式需手动添加 |
| B: 纯增强正则 | 在现有正则基础上扩展 | 改动最小 | 扩展性差、维护困难 |
| C: 结构化 NLP | 轻量级文本分析 | 更灵活 | 实现复杂、需分词 |

## 整体架构

### 数据流

```
用户输入
├── 文本/短信 → 模板匹配 → 命中? → 结构化提取 → 结果
│                           └── 未命中 → 增强规则提取 → 结果
│
└── 图片/截图 → 本地 OCR → 文字识别
                            └── 模板匹配/增强规则提取 → 结果
```

### 文件结构变更

```
services/
├── extractionService.ts      # 新建：统一提取入口（替代 geminiService.ts）
├── templateEngine.ts         # 新建：模板匹配引擎
├── courierTemplates.ts       # 新建：快递公司短信模板库
├── ocrService.ts             # 新建：本地 OCR 服务（Tesseract.js）
├── pickupTextRules.ts        # 重构：增强通用规则提取
├── smsService.ts             # 不变
├── storageService.ts         # 不变
└── geminiService.ts          # 删除
```

## 详细设计

### 1. 模板引擎（templateEngine.ts）

#### 模板数据结构

```typescript
interface CourierTemplate {
  courier: string;           // 快递公司名称
  senderPatterns: RegExp[];  // 发送方号码/签名匹配
  bodyPatterns: {            // 短信正文匹配模式
    pattern: RegExp;         // 整体匹配正则
    groups: {                // 捕获组映射
      pickupCode: number;    // 取件码在第几个捕获组
      location?: number;     // 地点
      address?: number;      // 地址
    };
  }[];
}
```

#### 匹配流程

1. 遍历所有模板，用 `senderPatterns` 缩小候选范围
2. 对候选模板的 `bodyPatterns` 逐一尝试匹配
3. 第一个命中的模板直接提取结构化数据
4. 所有模板未命中 → 交给增强规则引擎

### 2. 快递公司模板库（courierTemplates.ts）

首批覆盖的快递公司/平台（10 家）：
- 丰巢
- 菜鸟驿站
- 顺丰速运
- 中通快递
- 圆通速递
- 韵达快递
- 申通快递
- 极兔速递
- 京东快递
- 中国邮政/EMS

每家快递公司定义 2-5 个常见短信模板。

### 3. 增强规则引擎（pickupTextRules.ts 重构）

将 `geminiService.ts` 中的本地提取函数迁移并增强：

**迁移的函数**：
- `extractCourierFromText` → 增加更多快递公司关键词
- `extractLocationFromText` → 增强地点模式
- `extractAddressFromText` → 增强地址提取
- `extractPickupCodesFromAnyText` → 增加更多取件码格式
- `extractInfosHeuristically` → 作为最终兜底
- `normalizePickupCode`、`dedupeInfos` 等工具函数

**新增能力**：
- 上下文关联提取：取件码附近的文字优先作为地点/快递公司候选
- 多取件码支持：一条短信包含多个取件码时正确拆分
- 置信度评分：返回提取结果的置信度

**删除的代码**：
- 所有 AI API 调用相关函数
- JSON 解析相关函数（用于解析 AI 返回的 JSON）
- `getApiKey` 和 API 常量

### 4. 统一提取入口（extractionService.ts）

```typescript
// 文本提取（短信/粘贴文本）
export async function extractInfoFromText(text: string): Promise<ExtractedInfo>
export async function extractInfosFromText(text: string): Promise<ExtractedInfo[]>

// 图片提取
export async function extractInfoFromImage(base64Image: string): Promise<ExtractedInfo>
export async function extractInfosFromImage(base64Image: string): Promise<ExtractedInfo[]>
```

保持与原 `geminiService.ts` 相同的导出接口，最小化调用方改动。

### 5. 本地 OCR 服务（ocrService.ts）

#### 技术选型

| 环境 | 方案 | 说明 |
|------|------|------|
| Web/PWA | Tesseract.js v5 | 纯前端 WASM，支持中文 |
| Android 原生 | Android ML Kit | 设备端推理，速度快 |

#### 接口设计

```typescript
export interface OcrResult {
  text: string;          // 识别出的全部文字
  confidence: number;    // 整体置信度 0-1
}

export async function recognizeText(base64Image: string): Promise<OcrResult>
```

#### Web 端实现要点
- Web Worker 执行避免阻塞主线程
- 中文语言包按需加载（首次约 2-4MB）
- 支持图片预处理提升识别率

#### Android 端实现要点
- Capacitor 自定义插件 `OcrReader`
- ML Kit 中文识别模型随 Google Play Services 分发
- 离线可用，识别速度 <1 秒

## 影响范围

### 修改的文件

| 文件 | 操作 | 阶段 |
|------|------|------|
| `services/extractionService.ts` | 新建 | 1 |
| `services/templateEngine.ts` | 新建 | 1 |
| `services/courierTemplates.ts` | 新建 | 1 |
| `services/pickupTextRules.ts` | 重构 | 1 |
| `services/geminiService.ts` | 删除 | 1 |
| `App.tsx` | 修改导入 | 1 |
| `components/AddPackageModal.tsx` | 修改调用 | 1 |
| `components/SmsImportModal.tsx` | 修改调用 | 1 |
| `vite.config.ts` | 清理环境变量 | 1 |
| `services/ocrService.ts` | 新建 | 2 |
| `package.json` | 添加 tesseract.js | 2 |

### 不变的文件

- `types.ts` — 数据模型不变
- `services/storageService.ts` — 存储逻辑不变
- `services/smsService.ts` — 短信读取不变
- `components/Onboarding.tsx` — 引导页不变
- `components/PackageCard.tsx` — 卡片展示不变

## 分步实施计划

### 阶段 1：文本/短信的模板+规则提取
1. 新建模板引擎和模板库
2. 重构 pickupTextRules.ts（合并本地提取函数）
3. 新建 extractionService.ts（统一入口）
4. 更新调用方（App.tsx、AddPackageModal、SmsImportModal）
5. 删除 geminiService.ts 和 AI 相关配置
6. 验证所有文本提取功能正常

### 阶段 2：本地 OCR 图片识别
1. 安装 tesseract.js 依赖
2. 新建 ocrService.ts
3. 更新 AddPackageModal 的图片导入流程
4. （可选）新建 Capacitor 插件对接 Android ML Kit
5. 验证图片提取功能正常

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 模板无法覆盖所有格式 | 部分短信提取失败 | 增强规则作为兜底，持续补充模板 |
| Tesseract.js 中文识别率不高 | 图片提取准确率下降 | 图片预处理 + Android 端用 ML Kit |
| 中文语言包首次加载慢 | 用户体验受影响 | 异步加载 + 加载进度提示 |
