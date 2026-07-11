# 取件助手 v1.4 体验与识别改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉 OCR；删除与取件共用 3 天软状态防重；收紧识别并通过驿小哥样例；补齐搜索/筛选/批量/复制与界面打磨。

**Architecture:** 包裹用 `status: active|picked|deleted` 与共用 `expiresAt` 做墓碑防重；提取链路模板优先 + 加严门控与「可凭…提取」规则；UI 去图片入口，列表加工具栏与批量模式。分两层交付：基础正确性 → 体验。

**Tech Stack:** React 19、TypeScript、Vite 6、localStorage、既有本地规则/模板（无 Tesseract）。

**Spec:** `docs/superpowers/specs/2026-07-11-pickup-ux-and-recognition-design.md`

**Dev preview:** `http://localhost:3000/`（`npm run dev`，改代码后 HMR 刷新）

---

## File map

| File | Role |
|------|------|
| `types.ts` | `PackageStatus`、`PackageData.status`、去掉 `ImportMethod.IMAGE` |
| `services/storageService.ts` | 加载时迁移/规范化、purge 可抽公共 |
| `App.tsx` | 状态机、软删除、过滤、搜索筛选批量接线 |
| `services/pickupTextRules.ts` | 门控、取件码优先级（可凭优先）、地点「到店…提取」 |
| `services/courierTemplates.ts` | 驿小哥/到店提取模板 |
| `services/extractionService.ts` | 删除 OCR API |
| `services/ocrService.ts` | **删除** |
| `components/AddPackageModal.tsx` | 纯文本 |
| `components/PackageCard.tsx` | 复制、多选、视觉层级 |
| `components/Onboarding.tsx` | 文案 |
| `components/PackageListToolbar.tsx` | **新建** 搜索/筛选/批量入口 |
| `package.json` | 卸 tesseract |
| `README.md` | 同步能力描述 |
| `scripts/verify-extraction.mjs` | **新建** 本地跑 T1/T2（可选，无测试框架时用） |

---

## Layer 1 — 基础正确性

### Task 1: 类型与生命周期常量

**Files:**
- Modify: `types.ts`
- Modify: `App.tsx`（顶部常量，或抽 `services/packageLifecycle.ts`）

- [ ] **Step 1:** 在 `types.ts` 增加：

```ts
export type PackageStatus = 'active' | 'picked' | 'deleted';

export interface PackageData {
  id: string;
  pickupCode: string;
  location: string;
  address?: string;
  courier?: string;
  timestamp: string;
  originalText: string;
  status: PackageStatus;
  /** 兼容旧数据；写入时与 status 同步 */
  isPickedUp: boolean;
  pickedUpAt?: number;
  deletedAt?: number;
  expiresAt?: number;
  createdAt: number;
}
```

- [ ] **Step 2:** 删除或收缩 `ImportMethod`（若仅剩 TEXT，可删枚举，AddPackageModal 不再引用）。
- [ ] **Step 3:** 统一 `RETENTION_MS = 3 * 24 * 60 * 60 * 1000`。
- [ ] **Step 4:** 实现 `normalizePackageRecord(pkg): PackageData`（缺 status 从 isPickedUp 推断；写回 isPickedUp = status==='picked'）。
- [ ] **Step 5:** 实现 `isExpiredTerminal(pkg, now)`：`status` 为 picked/deleted 且 `expiresAt<=now`；`purgeExpiredPackages`。

### Task 2: 软删除与导入防重

**Files:**
- Modify: `App.tsx`（`handleAddPackage`、`handleToggleStatus`、`confirmDelete`、列表 filter）

- [ ] **Step 1:** 加载：`loadPackages().map(normalize).then(purge)`。
- [ ] **Step 2:** 新建包裹：`status: 'active', isPickedUp: false`。
- [ ] **Step 3:** `handleAddPackage`：同 `normalizePickupCode` 命中任意未过期记录：
  - `deleted` → return false（不升级、不复活）
  - `active`/`picked` → 仅字段升级（地点/地址/原文/courier），return false
  - 未命中 → 插入 active
- [ ] **Step 4:** 确认取件：`status='picked', isPickedUp=true, pickedUpAt, expiresAt=now+RETENTION_MS`。
- [ ] **Step 5:** 取消取件：`status='active', isPickedUp=false`，清 pickedUpAt/expiresAt。
- [ ] **Step 6:** 删除：`status='deleted', deletedAt=now, expiresAt=now+RETENTION_MS`，**不要**从数组硬删。
- [ ] **Step 7:** 列表：`active` / `picked` 过滤；`deleted` 永不展示。
- [ ] **Step 8:** 浏览器验证：添加 → 删除 → 再粘贴同短信 → 不出现；等不了 3 天可用临时把 `expiresAt` 设为过去再 purge 验证可再导入。

### Task 3: 去掉 OCR

**Files:**
- Delete: `services/ocrService.ts`
- Modify: `services/extractionService.ts`
- Modify: `components/AddPackageModal.tsx`
- Modify: `components/Onboarding.tsx`
- Modify: `package.json` / lockfile
- Modify: `README.md`（能力列表）

- [ ] **Step 1:** 删除 image 提取函数与 ocr import。
- [ ] **Step 2:** AddPackageModal 仅 textarea +「识别并添加」。
- [ ] **Step 3:** Onboarding「短信或粘贴」文案。
- [ ] **Step 4:** `npm uninstall tesseract.js`。
- [ ] **Step 5:** `npm run build` 通过；localhost:3000 无图片入口。

### Task 4: 识别门控 + 驿小哥 T1/T2

**Files:**
- Modify: `services/pickupTextRules.ts`
- Modify: `services/courierTemplates.ts`（可选通用「驿小哥」模板）
- Create: `scripts/verify-extraction.mjs`（用动态 import 或复制关键 regex 做 smoke；若 ESM 难直引 ts，可先 `npx tsx` 或把金样例测放在浏览器 console 手动步骤）

**金样例：**

```
T1: 【驿小哥】您好，您的顺丰快递0366已到大连理工大学(开发区校区)，可凭1-5-0366到店SF自营大连理工大学开发区店提取。
    → pickupCode 1-5-0366, courier 顺丰, location 非未知

T2: 【驿小哥】您好，您的极兔快递6154已到大连理工大学(开发区校区)，可凭5-1-1-6154到店SF自营大连理工大学开发区店提取。
    → pickupCode 5-1-1-6154, courier 极兔, location 非未知
```

- [ ] **Step 1:** 收紧 `isLikelyPickupMessage`：需取件正向信号；负向在途词且无「凭/取件码」则 false。
- [ ] **Step 2:** 取件码提取**优先**匹配：
  - `可凭\s*([段式码])`
  - `取件码|取货码|提货码|凭[：:\s]*...`
  - **禁止**把「快递0366」里的 0366 单独当成码（避免短数字尾号抢先）。
- [ ] **Step 3:** `extractLocationFromText` 增加「到店…提取」前门店、以及「已到…」后地点。
- [ ] **Step 4:** 模板增加驿小哥/通用 body：`可凭([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)到店` 等；courier 仍靠正文「顺丰/极兔」+ `detectCourierName`。
- [ ] **Step 5:** 负向：`运单号…即将送达/快到了` 应 throw/不导入。
- [ ] **Step 6:** 在 dev 页粘贴 T1/T2 验证；或脚本验证。

### Task 5: 基础层自检

- [ ] **Step 1:** `npm run build`
- [ ] **Step 2:** 手工：OCR 入口消失；删除防重；T1/T2；一条在途短信失败提示。

---

## Layer 2 — 体验

### Task 6: 搜索与筛选

**Files:**
- Create: `components/PackageListToolbar.tsx`
- Modify: `App.tsx`

- [ ] **Step 1:** state：`searchQuery`、`courierFilter`（`all` | 具体名）。
- [ ] **Step 2:** `useMemo` 在 sorted 前过滤：子串匹配码/地点/地址/courier/原文；courier 精确筛。
- [ ] **Step 3:** Toolbar UI：搜索框 + 快递下拉（选项来自当前 packages 非 deleted 的 courier 集合）。

### Task 7: 复制取件码

**Files:**
- Modify: `components/PackageCard.tsx`

- [ ] **Step 1:** 取件码可点复制 `navigator.clipboard.writeText`。
- [ ] **Step 2:** 短暂「已复制」反馈（本地 state 或 toast prop）。

### Task 8: 批量模式

**Files:**
- Modify: `App.tsx`, `PackageCard.tsx`, `PackageListToolbar.tsx`
- Reuse: `ConfirmDialog.tsx`

- [ ] **Step 1:** `selectionMode` + `Set<string> selectedIds`。
- [ ] **Step 2:** 卡片显示 checkbox（仅 selectionMode）。
- [ ] **Step 3:** 批量已取 / 批量删除（删除走软删除 + 二次确认）。
- [ ] **Step 4:** 操作后清空选择并退出或保持模式（推荐操作后清空选择）。

### Task 9: 卡片与空状态

**Files:**
- Modify: `PackageCard.tsx`, `App.tsx`

- [ ] **Step 1:** 层级：logo+名 → 大号取件码 → 地点 → 时间。
- [ ] **Step 2:** 三种空状态文案（待取/历史/无结果）。

### Task 10: 文档与版本

**Files:**
- Modify: `README.md`, `package.json` version → `1.4.0`（若同意）
- Optional: `docs/releases/v1.4.0.md`

- [ ] **Step 1:** README 去掉 OCR/截图；写清软删除与短信能力。
- [ ] **Step 2:** `npm run build` 最终通过。
- [ ] **Step 3:** 浏览器完整走查。

---

## 手工测试清单（实现者）

1. 打开 `http://localhost:3000/`
2. 粘贴 T1 → 码 `1-5-0366`、顺丰
3. 粘贴 T2 → 码 `5-1-1-6154`、极兔
4. 删除 T1 → 再粘贴 T1 → 不新增
5. 粘贴「快递单号 SF1234567890123 即将送达，快到了」→ 失败/不入库
6. 搜索「0366」命中；批量取件/删除
7. 复制码；暗色模式扫一眼

## 提交建议

- Commit 1: types + soft delete + add path
- Commit 2: remove OCR
- Commit 3: recognition T1/T2 + gate
- Commit 4: toolbar search/filter/batch/copy + UI
- Commit 5: README/version

（仅在用户要求时 commit。）
