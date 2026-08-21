# Harness Desktop

DeepSeek Harness 桌面端 - 对话式 Agent 工作台（Tauri 2 + React + TypeScript + Vite）。

**真实能力（无 mock，能力对齐 deepseek-harness 关键工具集）**：
- **真实 Agent 工具流**：模型自主调用 **bash / read / write / edit / glob / grep / fetch / todo_write**
  等真实工具（tools-server :8450 侧车执行），能浏览代码仓库、跑命令、读写文件，拿到真实结果再回答
- 对话引擎直连 **MemoryProxy(:8096) → DeepSeek 真实模型**：直接回答问题；信息不足才一次一问
  （[OPTIONS] 选项）；复杂任务先 todo_write 列计划再逐步执行
- **TencentDB Agent Memory** 真实记忆：MemoryCore(:8420) L0 对话沉淀 → L1 事实 → L2 场景 → L3 画像，新对话自动召回注入
- **会话持久化**：对话与任务清单落 localStorage，重开 App 不丢（含容量上限）
- **停止按钮**：长任务可随时中断（abort 模型等待与工具执行）；连续快速发送有同步竞态防护
- **线程状态流转**：空闲 → 执行中 → 已完成，「清空已完成对话」真实生效；模型选择与减弱动态效果均持久化
- 工具执行失败有错误态行 + 错误 toast；内置浏览器预览面板（右侧滑出）、⌘K 命令面板、真实窗口控制、任务清单卡与工具执行行渲染
- **Agent 回复 Markdown 渲染**：标题/列表/加粗/代码块/表格（GFM），原始 HTML 安全转义（防 XSS），链接在 Tauri 内用系统浏览器打开
- **工作目录预览（harness.local）**：agent 写出的 .html 网页/游戏自动在右侧预览面板打开并实时渲染，改完即刷新；标签可关闭、地址栏显示 /preview/ 路径

设计规范见仓库根目录 `DESIGN.md`；记忆技术设计见 `docs/MEMORY.md`；工具执行服务设计见 `docs/TOOLS.md`。

## 打包产物

```bash
npm run tauri build
# → src-tauri/target/release/bundle/macos/Harness.app
```

**单 .app 自包含**：应用包内含 Node 运行时 + MemoryCore + MemoryProxy + tools-server 全套源码与依赖，
启动时把三个服务注册为 **launchd 常驻服务**（`~/Library/LaunchAgents/dev.harness.memory-{core,proxy}.plist`
与 `dev.harness.tools.plist`，指向包内资源）：已健康则不动（秒开、不打断），不健康才修复，重启机器后自动拉起。
tools-server 的工作目录为 `~/Harness`（Agent 读写文件的根目录）。
DeepSeek API Key 已内置于包内配置（仅本机分发，请勿外传）。

## 开发模式

```bash
npm install
npm run tauri dev
```

## E2E 验证（真实链路，无 mock）

```bash
npx playwright test   # 30 用例：真实 Agent 工具流（bash/写文件）/ 工作目录预览 / 真实 LLM 对话 /
                      # [OPTIONS]/[PLAN] 协议 / 真实记忆召回与 L0 沉淀 / Markdown 渲染与 XSS 安全 /
                      # 会话持久化 / 竞态防护 /
                      # 停止中断 / 持久化设置 / 错误可见性 / UI / 键盘 / 渲染
```

前置：本机记忆服务在跑（App 启动一次即可，或 `launchctl bootstrap gui/$(id -u) <plist>`）；
tools-server 由 playwright webServer 自动拉起（`npm run tools` 可手动启动）。

## 结构

```
src/
  main.tsx       入口
  App.tsx        全部 UI（含工具执行行 / 任务清单卡渲染）
  harness.tsx    真实 Agent 引擎：LLM 工具循环（tool_calls → tools-server 执行 → 回传）+ 会话持久化 + 记忆召回/沉淀
  memory.ts      MemoryCore 直连 + MemoryProxy LLM 转发（含 tools 透传）+ 本地回退
  state.ts       类型（无任何 mock 数据）
  styles.css     设计令牌 CSS 变量（与 DESIGN.md 一一对应）
tools-server/
  index.mjs      零依赖工具执行服务（bash/read/write/edit/glob/grep/fetch，工作目录沙箱）
src-tauri/
  tauri.conf.json
  resources/      打包资源：node 运行时 / memory-core / memory-proxy / tools-server / 配置模板
  src/lib.rs      setup 钩子：生成配置 + 拉起三个常驻服务
public/
  preview-demo.html / preview-docs.html   内置浏览器演示页
```

## 快捷键

Enter 发送 · Shift+Enter 换行 · ⌘K 命令面板 · ⌘N 新对话 · Esc 关闭浮层 · ⌘W 关窗