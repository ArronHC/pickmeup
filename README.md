# 取件助手 (PickMeUp)

一个面向中文快递场景的取件码管理应用，支持从短信文本中提取取件信息，并在本地集中管理待取件包裹。

## 项目定位

- 完全本地识别：当前版本不依赖 OpenAI、GitHub Models 或其他云端 AI 服务
- Android 优先：短信读取、短信自动导入等能力依赖 Capacitor 原生插件
- 隐私优先：包裹数据保存在本地存储，不上传到服务端

## 核心功能

- 文本导入：粘贴短信内容，自动提取取件码、地点和地址
- 模板加规则双通路：优先匹配快递短信模板，失败时回退到通用规则提取
- Android 短信导入：批量读取最近短信，并支持原生侧自动导入
- 去重合并：同一取件码自动合并，尽量补全地点、地址和原始文本
- 软删除防重：手动删除与确认取件共用 3 天保留期，期间不会重复导入相同取件码
- 状态管理：支持标记已取件，历史 / 已删除记录会在过期后自动清理
- 列表交互：搜索、按快递筛选、多选批量已取/删除、点击复制取件码
- 视图辅助：支持待取件/历史切换、排序，以及取件频次热力图

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 原生容器 | Capacitor 8 |
| 动画 | Framer Motion |
| 数据存储 | localStorage |

## 支持的识别方式

- 快递短信模板匹配：覆盖驿小哥到店提取、丰巢、菜鸟、顺丰、中通、圆通、韵达、申通、极兔、京东、邮政/EMS 等常见场景
- 通用规则提取：针对未命中模板的短信进行兜底识别，并抑制「在途 / 运单提醒」类误识别

## 本地开发

### 环境要求

- Node.js 18+
- npm 9+

### 启动项目

```bash
git clone https://github.com/ArronHC/pickmeup.git
cd pickmeup
npm install
npm run dev
```

### 构建 Web 版本

```bash
npm run build
npm run preview
```

## Android 开发

```bash
npx cap sync android
npx cap open android
```

说明：

- 短信读取和自动导入仅在 Android 原生环境可用
- `local.properties` 和 `keystore.properties` 属于本地机器配置，不应提交到仓库
- Android Studio 通常会自动生成 `local.properties`

### Release 签名配置

仓库不会保存签名文件和密码。若需要本地打包 release，请在仓库根目录创建 `keystore.properties`：

```properties
storeFile=/absolute/path/to/your-release.keystore
storePassword=your-store-password
keyAlias=your-key-alias
keyPassword=your-key-password
```

也可以改用环境变量：

```bash
export PICKMEUP_RELEASE_STORE_FILE=/absolute/path/to/your-release.keystore
export PICKMEUP_RELEASE_STORE_PASSWORD=your-store-password
export PICKMEUP_RELEASE_KEY_ALIAS=your-key-alias
export PICKMEUP_RELEASE_KEY_PASSWORD=your-key-password
```

## 项目结构

```text
pickmeup/
├── components/          # UI 组件与弹窗
├── services/            # 模板匹配、规则提取、短信与存储服务
├── android/             # Capacitor Android 工程
├── docs/                # 设计文档与发布说明
├── App.tsx              # 主应用入口
├── types.ts             # 类型定义
├── index.html           # HTML 入口
└── index.css            # 全局样式
```

## 发布版本

- 当前版本：`1.4.0`
- 最新 release notes：[`docs/releases/v1.4.0.md`](docs/releases/v1.4.0.md)
- 设计说明：[`docs/superpowers/specs/2026-07-11-pickup-ux-and-recognition-design.md`](docs/superpowers/specs/2026-07-11-pickup-ux-and-recognition-design.md)

## 许可证

[MIT](LICENSE)
