# 取件助手 (PickMeUp)

智能快递取件码管理应用，自动识别短信和截图中的取件信息，帮助用户集中管理快递包裹。

## 功能特性

- **AI 智能提取** — 粘贴短信文本或拍照截图，自动识别取件码、快递公司、取件地点等信息
- **短信批量导入** — Android 原生环境下自动读取最近 7 天的快递短信并批量导入
- **取件状态管理** — 一键标记已取件，已取件包裹 3 天后自动清理
- **智能去重** — 相同取件码自动合并，仅补全缺失字段
- **排序与筛选** — 按时间或地点排序，区分待取件与历史记录
- **暗色模式** — 支持亮色/暗色主题切换
- **离线可用** — 数据存储在本地 localStorage，无需网络即可查看

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式方案 | Tailwind CSS (CDN) |
| 动画 | Framer Motion |
| 原生桥接 | Capacitor 8 (Android) |
| AI 推理 | GitHub Models API (GPT-4o) |

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/ArronHC/pickmeup.git
cd pickmeup

# 安装依赖
npm install

# 配置环境变量（填入 API Key）
cp .env.local.example .env.local

# 启动开发服务器
npm run dev
```

### 环境变量

在 `.env.local` 中配置（三选一）：

```
VITE_GH_AI_KEY=你的_GitHub_Models_API_Key
VITE_API_KEY=备用_API_Key
VITE_OPENAI_API_KEY=备用_OpenAI_API_Key
```

### 构建

```bash
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
```

## 项目结构

```
pickmeup/
├── components/             # React 组件
│   ├── AddPackageModal.tsx  # 新增取件弹窗（文本/图片导入）
│   ├── Onboarding.tsx      # 首次使用引导页
│   ├── PackageCard.tsx     # 包裹卡片组件
│   └── SmsImportModal.tsx  # 短信批量导入弹窗
├── services/               # 服务层
│   ├── geminiService.ts    # AI 信息提取服务
│   ├── pickupTextRules.ts  # 取件码正则匹配规则
│   ├── smsService.ts       # 短信读取服务
│   └── storageService.ts   # 本地存储服务
├── android/                # Capacitor Android 原生项目
├── App.tsx                 # 主应用组件
├── types.ts                # TypeScript 类型定义
├── index.html              # HTML 入口
└── index.css               # 全局样式
```

## 信息提取策略

采用双重保障机制：

1. **AI 提取（主路径）** — 调用 GitHub Models API，通过提示词工程提取结构化取件信息
2. **规则提取（后备路径）** — 使用正则表达式进行本地匹配，在 AI 不可用时保证基本功能

## 许可证

MIT
