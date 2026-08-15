# Harness Desktop

DeepSeek Harness 桌面端 - 对话式 Agent 工作台（Tauri 2 + React + TypeScript + Vite）。

**真实能力（无 mock）**：
- 对话引擎直连 **MemoryProxy(:8096) → DeepSeek 真实模型**（澄清协议：一次一问 / [OPTIONS] 选项 / [PLAN] 计划确认）
- **TencentDB Agent Memory** 真实记忆：MemoryCore(:8420) L0 对话沉淀 → L1 事实 → L2 场景 → L3 画像，新对话自动召回注入
- 内置浏览器预览面板（右侧滑出）、⌘K 命令面板、真实窗口控制

设计规范见仓库根目录 `DESIGN.md`；记忆技术设计见 `docs/MEMORY.md`。

## 打包产物

```bash
npm run tauri build
# → src-tauri/target/release/bundle/macos/Harness.app
```

**单 .app 自包含**：应用包内含 Node 运行时 + MemoryCore + MemoryProxy 全套源码与依赖，
启动时把记忆服务注册为 **launchd 常驻服务**（`~/Library/LaunchAgents/dev.harness.memory-{core,proxy}.plist`，
指向包内资源）：已健康则不动（秒开、不打断），不健康才修复，重启机器后自动拉起。
DeepSeek API Key 已内置于包内配置（仅本机分发，请勿外传）。

## 开发模式

```bash
npm install
npm run tauri dev
```

## E2E 验证（真实链路，无 mock）

```bash
npx playwright test   # 16 用例：真实 LLM 对话 / [OPTIONS]/[PLAN] 协议 /
                      # 真实记忆召回与 L0 沉淀 / UI / 键盘 / 渲染
```

前置：本机记忆服务在跑（App 启动一次即可，或 `launchctl bootstrap gui/$(id -u) <plist>`）。

## 结构

```
src/
  main.tsx       入口
  App.tsx        全部 UI
  harness.tsx    真实 LLM 对话引擎（澄清协议解析 + 记忆召回/沉淀）
  memory.ts      MemoryCore 直连 + MemoryProxy LLM 转发 + 本地回退
  state.ts       类型（无任何 mock 数据）
  styles.css     设计令牌 CSS 变量（与 DESIGN.md 一一对应）
src-tauri/
  tauri.conf.json
  resources/      打包资源：node 运行时 / memory-core / memory-proxy / 配置模板
  src/lib.rs      setup 钩子：生成配置 + 拉起常驻记忆服务
public/
  preview-demo.html / preview-docs.html   内置浏览器演示页
```

## 快捷键

Enter 发送 · Shift+Enter 换行 · ⌘K 命令面板 · ⌘N 新对话 · Esc 关闭浮层 · ⌘W 关窗
