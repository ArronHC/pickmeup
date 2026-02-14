# 取件助手 (PickMeUp) 项目开发指南

## 项目概述

取件助手是一款智能快递取件码管理应用，能自动识别短信和截图中的取件信息，帮助用户集中管理快递包裹。

- **应用名称**: 取件助手 (PickMeUp)
- **应用ID**: `com.pickmeup.assistant`
- **版本**: 0.0.0
- **语言**: 简体中文

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | ^19.2.4 |
| 语言 | TypeScript | ~5.8.2 |
| 构建工具 | Vite | ^6.2.0 |
| 样式方案 | Tailwind CSS | CDN 引入 |
| 动画库 | framer-motion | ^12.31.0 |
| 原生桥接 | Capacitor | ^8.0.2 |
| 图片 OCR | Tesseract.js | ^5.1.1 |
| CSS 工具 | clsx + tailwind-merge | ^2.1.1 / ^3.4.0 |

## 项目结构

```
pickmeup/
├── .claude/                    # Claude 工作文件目录
│   ├── settings.local.json     # Claude 本地设置
│   ├── operations-log.md       # 操作日志
│   └── verification-report.md  # 验证报告
├── android/                    # Capacitor Android 原生项目
├── components/                 # React 组件
│   ├── AddPackageModal.tsx     # 新增取件弹窗（文本/图片导入）
│   ├── Onboarding.tsx          # 首次使用引导页
│   ├── PackageCard.tsx         # 包裹卡片组件
│   └── SmsImportModal.tsx      # 短信批量导入弹窗
├── services/                   # 服务层
│   ├── courierTemplates.ts     # 快递公司短信模板库（10家快递）
│   ├── extractionService.ts    # 统一信息提取入口（模板+规则+OCR）
│   ├── ocrService.ts           # 本地 OCR 服务（Tesseract.js）
│   ├── pickupTextRules.ts      # 取件码规则引擎（正则匹配/验证/启发式提取）
│   ├── smsService.ts           # 短信读取服务（Capacitor 插件）
│   ├── storageService.ts       # 本地存储服务（localStorage）
│   └── templateEngine.ts       # 模板匹配引擎
├── dist/                       # 构建输出目录
├── App.tsx                     # 主应用组件
├── index.tsx                   # React 入口
├── index.html                  # HTML 入口（含 Tailwind CDN 配置）
├── index.css                   # 全局样式（Tailwind 指令 + 自定义组件类）
├── types.ts                    # TypeScript 类型定义
├── capacitor.config.ts         # Capacitor 配置
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # 项目依赖
├── .gitignore                  # Git 忽略规则
├── metadata.json               # 应用元数据
└── CLAUDE.md                   # 本文件
```

## 架构设计

### 数据流

```
用户输入（文本/图片/短信）
  → services/extractionService.ts（统一入口）
    → services/templateEngine.ts（模板匹配，优先）
    → services/pickupTextRules.ts（规则兜底）
    → services/ocrService.ts（图片 OCR 识别）
  → App.tsx handleAddPackage（去重 + 合并）
  → services/storageService.ts（localStorage 持久化）
  → components/PackageCard.tsx（UI 渲染）
```

### 核心数据模型

```typescript
// types.ts
interface PackageData {
  id: string;            // crypto.randomUUID() 生成
  pickupCode: string;    // 取件码
  location: string;      // 取件地点
  address?: string;      // 详细地址
  courier: string;       // 快递公司
  timestamp: string;     // ISO 时间字符串
  originalText: string;  // 原始文本
  isPickedUp: boolean;   // 是否已取件
  pickedUpAt?: number;   // 取件时间戳
  expiresAt?: number;    // 过期时间戳（取件后3天）
  createdAt: number;     // 创建时间戳
}
```

### 信息提取策略（三层本地提取）

1. **模板匹配（主路径）**: `templateEngine.ts` 使用 `courierTemplates.ts` 中 10 家快递公司的短信模板进行结构化提取
2. **规则提取（兜底路径）**: `pickupTextRules.ts` 中的正则表达式和启发式算法进行通用匹配
3. **图片 OCR**: `ocrService.ts` 使用 Tesseract.js 识别图片文字，再经过模板+规则提取

### 去重逻辑

- 取件码经过 `normalizePickupCode`（去空格、转大写）后比对
- 重复取件码不新增，仅在既有记录字段为"未知"时升级补全

## 编码规范

### 命名约定

- **文件名**: PascalCase 用于组件（`PackageCard.tsx`），camelCase 用于服务（`extractionService.ts`）
- **组件**: 使用 `React.FC<Props>` 函数组件，PascalCase 命名
- **接口**: PascalCase，以功能描述命名（`PackageData`、`ExtractedInfo`）
- **枚举**: PascalCase 类型名，UPPER_SNAKE_CASE 枚举值
- **常量**: UPPER_SNAKE_CASE（`STORAGE_KEY`、`PICKED_UP_EXPIRES_IN_MS`）
- **函数**: camelCase，动词开头（`handleAddPackage`、`extractInfoFromText`）
- **CSS 类**: Tailwind 实用类为主，自定义类使用 kebab-case（`glass-panel`、`active-scale`）

### 代码风格

- **缩进**: 2 空格
- **引号**: 单引号（JSX 属性使用双引号）
- **分号**: 有
- **尾逗号**: 无强制（混合使用）
- **导入顺序**: React → 类型 → 服务 → 组件 → 第三方库
- **组件结构**: 状态声明 → 副作用 → 事件处理 → 渲染

### UI 设计规范

- **设计语言**: iOS 风格毛玻璃效果（Glassmorphism）
- **暗色模式**: 通过 `dark:` Tailwind 前缀实现，class 策略切换
- **圆角**: 大圆角为主（`rounded-[20px]`、`rounded-[16px]`）
- **动画**: 使用 framer-motion 的 `motion` 组件和 `AnimatePresence`
- **弹窗**: iOS 底部弹出式（Bottom Sheet），带毛玻璃背景
- **交互反馈**: `whileTap={{ scale: 0.9 }}` 或 `active-scale` 类

### 自定义 CSS 类

| 类名 | 用途 |
|------|------|
| `glass-panel` | 毛玻璃面板（导航栏/弹窗背景） |
| `glass-card` | 毛玻璃卡片 |
| `active-scale` | 点击缩放反馈 |
| `no-scrollbar` | 隐藏滚动条 |

## 环境变量

当前项目无需外部 API Key，所有信息提取均在本地完成。

## 开发命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器（端口 3000）
npm run build      # 构建生产版本（输出到 dist/）
npm run preview    # 预览生产构建
```

## Capacitor / Android

- **Web 目录**: `dist`
- **Android Scheme**: `https`
- **启动屏**: 显示 2 秒后自动隐藏，背景色 `#4F46E5`
- **自定义插件**: `SmsReader`（短信读取和自动导入）

## 关键业务规则

1. **已取件包裹过期**: 标记为已取件后 3 天自动从列表中清除
2. **取件码规范化**: 去除空格、统一大写、保留连字符格式
3. **取件码有效性**: 4-12 位字母数字（含连字符），排除运营商号码
4. **短信自动导入**: 原生环境下应用启动时自动读取最近 7 天的快递短信
5. **排序**: 支持按时间/地点排序，排序偏好持久化到 localStorage

## 测试

当前项目未配置测试框架。新增功能时应考虑：
- `pickupTextRules.ts` 中的正则规则适合单元测试
- `templateEngine.ts` 中的模板匹配逻辑适合单元测试
- `extractionService.ts` 中的提取流程适合集成测试
- 组件交互适合使用 React Testing Library

## 注意事项

- Tailwind CSS 通过 CDN 引入（`index.html` 中的 `<script>`），非 PostCSS 构建
- `index.css` 中的 `@tailwind` 指令由 Vite 插件处理，与 CDN 配置共存
- TypeScript 配置使用 `bundler` 模块解析，路径别名 `@/` 映射到项目根目录
- 所有信息提取完全在本地完成，无外部 API 依赖
- 图片识别使用 Tesseract.js WASM 引擎，支持中文简体和英文
