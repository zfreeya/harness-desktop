# Agent Memory 技术设计（TencentDB-Agent-Memory 集成）

## 目标

让 Harness Desktop 的 Agent 具备记忆能力：会话之间不再从零开始，模糊需求不再反复问同样的问题。

参考实现：[TencentCloud/TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)
（v2.0.0，MIT，Node ≥ 22.16；npm 包 `@tencentdb-agent-memory/memory-tencentdb`）

## 记忆模型（L0-L3 逐层沉淀）

| 层级 | 保存什么 | 在我们的应用里 |
| :--- | :--- | :--- |
| L0 Conversation | 原始对话与完整上下文 | 每轮澄清 + 计划 + 执行后的完整会话 |
| L1 Atom | 事实、偏好、约束、事件 | 「偏好：暖白极简」「约束：别动鉴权模块」 |
| L2 Scenario | 围绕项目/场景组织的知识块 | 「DeepSeek Harness 桌面端迭代」场景恢复 |
| L3 Core / Persona | 长期画像与高层认知 | 「技术型用户，先小步验证再扩大范围」 |

## 架构

```
Harness Desktop (Tauri/React)
   │  fetch /chat/completions（OpenAI 兼容）
   ▼
MemoryProxy :8096（/dsh/default）        ← 配置在 设置 → 记忆
   │  会话首帧：Team → Agent → Task 初始化，注入 Loadout
   │  会话中：L0 记录 + 知识工具 /v3/tools/list、/v3/tools/call
   ▼
MemoryCore ──(异步蒸馏)──> L1 Atom / L2 Scenario / L3 Persona
   │
MemoryHub :8125（Team / Agent / ACL / 资产面板 / 签发 user_key）
```

- **接入方式**：零代码协议接入。桌面端把 LLM 请求的 base URL 指向
  `http://127.0.0.1:8096/<spaceId>/<teamId>`，携带 `Authorization: Bearer sk-mem-…`。
- **回退策略**：Proxy 不可达或未配置 user_key 时，用 localStorage 保存 L0 会话
  并做简化版偏好蒸馏（本仓库 `src/memory.ts` 已实现），配置服务后自动升级为
  云端沉淀。
- **权限**：资产按 `private / team / restricted / agent` 可见性 + Owner/ACL
  管理；新资产默认私有。

## 与澄清循环的结合（核心价值）

我们的对话优先设计里，Agent 会一次一问澄清模糊需求。记忆让这个过程变短：

1. **召回（recall）**：用户开口后，先按任务召回 L2 场景 + L1 原子。
2. **确认代替重问**：若记忆中已有「风格 = 暖白极简」「范围 = 最小版本」，
   Agent 不重问这三个问题，直接给出一条确认（chips：按这个来 / 改一改）。
   三轮追问压缩为一轮确认。
3. **沉淀（commit）**：执行完成后把整段会话写入 L0，Proxy 异步蒸馏出新的
   L1 原子与 L2 场景；下次会话自动可用。
4. **知识工具**：Wiki / CodeGraph 通过 `/v3/tools/list` 与 `/v3/tools/call`
   按需进入上下文，不整库注入。

## 代码位置

| 文件 | 职责 |
| :--- | :--- |
| `src/memory.ts` | `MemoryConfig`、`recallMemory()`、`commitMemory()`、localStorage 回退 |
| `src/harness.tsx` | 首条消息时召回注入；记忆确认 chips 分流（直接计划 / 重新澄清）；完成时沉淀 + toast |
| `src/App.tsx` | 设置 → 记忆分组（开关 / Proxy 地址 / 空间团队 / user_key）；recall 消息渲染 |

## 部署（已在本机实际搭建，常驻运行）

**当前状态：MemoryCore + MemoryProxy 随 App 自启并以 launchd 常驻**（无需 Docker）：

| 服务 | 端口 | 常驻方式 | 状态 |
| :--- | :--- | :--- | :--- |
| MemoryCore（网关 + L0-L3 蒸馏） | 8420 | `~/Library/LaunchAgents/dev.harness.memory-core.plist` | ✅ 运行中（RunAtLoad + KeepAlive） |
| MemoryProxy（LLM 代理注入层） | 8096 | `~/Library/LaunchAgents/dev.harness.memory-proxy.plist` | ✅ 运行中（真实 DeepSeek 转发已验证） |

- **App 是服务的所有者**：每次启动把 plist 重写为指向 `Harness.app/Contents/Resources/resources/...`
  内嵌资源（含 Node 运行时与两份服务源码），然后 `ensure_launchd_service` 校验：
  已健康则不动（秒开、不打断运行中的服务）；不健康才 bootout → 等旧实例卸载 →
  bootstrap 重试，仍失败才回退到孤儿进程自举。App 退出后服务继续常驻，重启机器后
  launchd 自动拉起。
- 服务代码持久位置：`~/.harness-memory/services/{MemoryCore,MemoryProxy}`（源码 + node_modules），
  打包时由 `scripts/prepare-resources.sh` 同步进 `src-tauri/resources/`
- 配置：App 启动时从模板生成到 `~/Library/Application Support/dev.harness.desktop/`
  （tdai-gateway.yaml：standalone / SQLite / BM25 中文 / DeepSeek LLM / `corsOrigins:["*"]`；
  proxy-config.yaml：上游 api.deepseek.com，密钥 600 权限）
- 数据：`~/.harness-memory/memory-data/`（SQLite + FTS5 + persona；跨版本延续，
  不可换目录，否则历史画像丢失）
- 日志：`/tmp/harness-{core,proxy}.err.log`（launchd 兜底）+
  `~/Library/Application Support/dev.harness.desktop/logs/`（应用日志）
- **CORS（关键）**：WebView/浏览器跨源直连 127.0.0.1 必须过预检。MemoryProxy 已内置
  CORS 中间件（`src/server.ts`，OPTIONS→204 + 回显 Origin + 覆盖上游透传头）；
  MemoryCore 由 `server.corsOrigins:["*"]` 处理。两处缺失都会导致聊天/召回
  「服务在跑但前端全失败」的假死。
- 已实测：喂入偏好 → DeepSeek 提取 L1 原子「用户喜欢暖白极简风格、先做最小版本」
  → 生成 L3 画像「务实极简主义者」→ `/recall` 返回真实画像上下文 → 桌面端
  「来自记忆」召回块展示真实原子；L2 场景蒸馏任务完成（processed=8，2 个场景更新）。
- **E2E 验证**：`npx playwright test`（16 用例全绿）真实链路验证——真实键盘输入 →
  MemoryProxy → DeepSeek 回复渲染、`[OPTIONS]`/`[PLAN]` 协议解析、
  `/recall` 真实召回块、`/capture` L0 沉淀（`__lastCommit` 轮询）、UI/键盘/渲染确定性注入。

**常用运维命令**：

```bash
launchctl list | grep memory                    # 查看状态（ppid=1 才是 launchd 所有）
launchctl kickstart -k gui/$(id -u)/dev.harness.memory-core    # 重启内核
curl http://127.0.0.1:8420/health               # 内核健康
curl -X POST http://127.0.0.1:8420/recall -H 'Content-Type: application/json' \
  -d '{"query":"...","session_key":"s1","user_id":"u1"}'   # 手动召回
```

源码级改动记录：MemoryProxy 的 Node 版本门放宽至 v22+（原硬编码 v22.x）；better-sqlite3 升至 13.x 以兼容 Node 26；MemoryProxy 增加 CORS 中间件（上游仓库无此能力，预检会 404）。

**官方 Docker 方式**（可选，三件套含 Panel）：克隆仓库 → `deploy/global-images` → 填 `.env`
两组 LLM 参数 → `./start-all.sh`（Panel :8125 / Knowledge :8424 / Proxy :8096）。

## 注意事项

- Wiki 与 CodeGraph 异步构建，需要等待处理完成才 `ready`。
- CodeGraph 当前首先支持公开 HTTPS 仓库。
- 本仓库的召回/沉淀为协议级实现；L0-L3 蒸馏由 MemoryCore 侧完成。
