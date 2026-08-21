# 游戏 Agent 桌面模式 — 设计方案

> 版本 v1（设计提案，待评审）· 定位：Harness Desktop 新增「游戏模式」，
> 一个对话驱动的游戏开发工作台，可扩展为完整游戏开发工具链。

## 0. 一句话摘要

在桌面上对 Agent 说「做一个像素风平台跳跃原型」→ Agent 澄清需求、生成工程与资产 →
右侧画布立刻可玩 → 说「把主角改成猫、跳跃加高 20%」→ 改动实时生效 →
AI 试玩 bot 自动跑局回归 → 风格与决策沉淀进长期记忆，下一款游戏直接复用。

## 1. 市场调研：向市面上最优秀的产品学习

### 1.1 通用 AI 编码 Agent（交互范式与工程底座）

| 产品 | 值得学的东西 |
|---|---|
| Cursor (Composer/Agent) | 代码库语义索引、多文件并行编辑、diff 可视化审查、计划模式、checkpoint 可回滚 |
| OpenAI Codex | 云端沙箱执行、plan → todo → 并行工具调用、自我验证（改完跑测试） |
| Claude Code / Gemini CLI | 终端形态 agent loop、技能系统、上下文紧凑管理 |
| Windsurf | Flow 模式：AI 与人共享同一编辑器状态 |

### 1.2 游戏垂直 AI（引擎内助手）

| 产品 | 值得学的东西 |
|---|---|
| Unity Muse (Chat/Sprite/Texture/Animate/Behavior) | 自然语言驱动引擎：改场景、生成 2D/贴图/动画/行为树，资产直入引擎；Sentis 本地推理 |
| Roblox Assistant | 场景与脚本生成 + 平台资产库调用（平台绑定式一体体验） |
| UEFN / Unreal 生态 | 专业管线里 AI 辅助关卡与蓝图 |

### 1.3 端到端「文生游戏」平台

| 产品 | 值得学的东西 |
|---|---|
| Rosebud AI | 文本→2D/3D Web 游戏、持续对话迭代、官方方向「prompt-to-world」 |
| Bolt.new / Lovable / gptengineer | 提示词→完整工程→即时预览→迭代闭环的 UX（游戏界的类比） |
| Decart Oasis / Google GameNGen / DeepMind Genie | 神经渲染与世界模型：未来的实时生成游戏方向 |

### 1.4 资产生成管线

| 产品 | 值得学的东西 |
|---|---|
| Scenario | 风格一致性（自训 Kontext LoRA）、批量资产生成、Composition Control 布局控制 |
| Leonardo / Midjourney | 美术灵感与素材工作流 |
| Meshy / Tripo / Rodin / Kaedim | 文生 3D / 图生 3D / 重拓扑 |
| ElevenLabs / Suno / AIVA / NVIDIA Audio2Face / Plask / Cascadeur | 配音、音乐、口型、动作捕捉与动画 |

### 1.5 NPC / 叙事 AI

| 产品 | 值得学的东西 |
|---|---|
| Inworld / Convai | 常驻推理的角色大脑、目标驱动、长期记忆（与自家 MemoryCore L0-L3 同构） |
| Charisma.ai | 叙事分支引擎 |
| 斯坦福 Smallville (Generative Agents) | 记忆流 + 反思 + 计划的 NPC 架构 |

### 1.6 AI 测试 / 运营

| 产品 | 值得学的东西 |
|---|---|
| modl.ai | AI 试玩 bot 自动化测试（与 Riot 合作射击 bot）、性能与兼容性回归、玩家行为模拟 |
| Unity ML-Agents / GameDriver / PlaytestCloud | 训练型智能体、UI 自动化、众测 |

### 1.7 研究前沿（会玩游戏的 Agent）

| 项目 | 值得学的东西 |
|---|---|
| NVIDIA Voyager (Minecraft) | 技能库沉淀（把会做的事存成可复用技能）、课程式自我迭代、自我验证 |
| Odyssey / Cradle | 开放世界技能、通用电脑 Agent |

### 1.8 市场空白 → 我们的切入点

现有产品要么绑死单一引擎/平台（Unity/UE/Roblox），要么只做 Web 小游戏（Rosebud），
要么只是通用编码器不懂游戏（Cursor 系）。缺少一个：
**桌面端 · 引擎无关 · 对话驱动 + 真实工具 + 实时试玩 + AI 试玩回归 + 风格化资产管线** 的一体化工作台。

## 2. 产品定位与核心循环

核心循环（每条都能被 Agent 真实执行与验证）：

```text
说需求 → 澄清/记忆召回 → 计划(todo) → 生成工程+资产 → 即时试玩
   ↑                                                        ↓
记忆沉淀(L0-L3) ← AI 试玩回归(截图/日志/断言) ← 用户反馈改需求
```

目标用户：独立开发者、原型团队、玩法探索者。
形态：Harness Desktop 新增「模式切换」（助手模式 ⇄ 游戏模式，GSAP 揭幕过渡）。
游戏模式界面 = 对话区 + 游戏画布 + 资产画廊 + 场景检查器 + 动效时间轴。

## 3. 总体架构

```text
┌────────────────────────── Tauri 桌面壳 ──────────────────────────┐
│  UI 层：React 18 + GSAP 全量动效（useGSAP 规范）                  │
│   对话区 │ 游戏画布(预览) │ 资产画廊 │ 检查器 │ 动效时间轴        │
├────────────────────────── Agent 内核（复用现有） ────────────────┤
│  LLM 工具循环（MemoryProxy→DeepSeek）· 会话持久化 · MemoryCore    │
│  tools-server 扩展「游戏工具组」                                  │
├───────────── 游戏运行时层（新增 sidecar 服务） ──────────────────┤
│  内置：Phaser(2D) / Three.js(3D) / Bevy-WASM(性能向)             │
│  外接：Godot / Unity / Unreal —— 引擎桥（MCP / 插件）             │
│  Engine Adapter：scene 查询/修改 · 热重载 · 截图 · playtest 控制  │
├───────────── 资产管线（新增 asset-gateway） ─────────────────────┤
│  图像/3D/音频生成 API 网关 · 风格 LoRA · 图集/切片 · 命名规范     │
├───────────── 验证层 ────────────────────────────────────────────┤
│  AI 试玩 bot（跑局/日志/截图回归/数值断言）· e2e                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 游戏专用工具集（在现有 8 个工具之上扩展）

| 工具 | 能力 | 对标 |
|---|---|---|
| engine_scene_get / engine_scene_edit | 读取/修改场景图（节点、组件、参数） | Unity Muse / Roblox |
| engine_run / stop / reload / screenshot | 运行、热重载、截图（模型可见的验证手段） | Cursor 跑测试 |
| engine_playtest | AI 试玩一局：输入回放 + 日志 + 截图 + 状态断言 | modl.ai |
| asset_gen_image | 文生图/图生图（风格参数、批量、图集） | Scenario / Muse Sprite |
| asset_gen_3d / asset_gen_audio | 3D 资产、音效音乐（P2） | Meshy / Suno |
| tween_timeline | 生成/编辑动效时间轴（与 GSAP 双向联动） | Muse Animate |
| project_create_from_template / export_build | 模板工程、导出打包 | Rosebud |
| game_state_eval | 游戏状态断言（数值/规则校验） | modl.ai 断言 |

### 3.2 引擎策略（可扩展的关键）

- **P0 内置**：Phaser 3 + TypeScript（AI 生成友好、社区最大、Web 即时预览）+ Three.js（3D）。
- **P1 桥接**：Godot / Unity 通过 MCP server（社区已有 unity-mcp / godot-mcp 先例，
  或自研 engine adapter：场景 RPC + 截图 + 热重载），引擎跑游戏、桌面端做宿主。
- **P2 性能向**：Bevy + WASM 或原生 sidecar（大项目）。

## 4. GSAP 交互体系（前端完全采用 GSAP）

### 4.1 选型与学习清单（开工前必须完成的规范学习）

- 官方 gsap-skills：gsap-core / gsap-timeline / gsap-scrolltrigger / gsap-react（useGSAP 规范已研读）
- gsap.com/resources/React（官方 React 指南）
- Codrops / MotionTricks 的标杆动效案例（克制、有质感的参考）
- 库：gsap + @gsap/react；插件按需注册（ScrollTrigger / Flip / Draggable / InertiaPlugin / TextPlugin）

### 4.2 硬性规范（对齐官方 useGSAP 最佳实践）

1. 一律 useGSAP（或 gsap.context + ctx.revert），绝不裸写 useEffect 动画；
2. 目标用 ref，必须传 scope，禁止无 scope 的 selector 全局选择；
3. 事件回调里创建的动画用 contextSafe 包裹，监听器在 cleanup 里移除；
4. 只跑客户端；尊重 prefers-reduced-motion（reduce-motion 全局降级）；
5. 只用 transform/opacity 动画保 60fps；ticker lagSmoothing 默认开启；
6. 响应式用 gsap.matchMedia；退出动画结束(onComplete)再卸载节点。

### 4.3 动效模块设计（设计语言延续暖白极简：克制、有质感）

| 模块 | GSAP 方案 |
|---|---|
| 模式切换 | 全屏揭幕 timeline：遮罩 yPercent 上滑 + 新界面从 0.96 scale/淡入 stagger |
| 消息入场 | 文本消息 y+12/opacity/scale 0.985，power3.out，0.35s；工具行紧随 0.08s stagger |
| 发送反馈 | 气泡弹性回弹（elastic.out(1, 0.5)，参数化 token）；输入框聚焦微缩放 |
| 思考指示 | 三点呼吸用 GSAP timeline 替换 CSS keyframes（y 跳动 + opacity，随机微相位） |
| 工具执行行 | 运行：图标自旋 + 进度脉冲；完成：对勾 drawSVG 描边 + scale 弹出；折叠结果 Flip |
| 游戏画布 | 面板展开 xPercent/width 弹性；设备切换 CSS 3D 旋转 + Flip；运行中 HUD 脉冲；全屏过渡 |
| 资产画廊 | 卡片翻转 rotationY + transformPerspective；网格重排 Flip 布局动画；Draggable+Inertia 拖拽；放大 inspect |
| 命令面板/设置 | scale 0.96→1 + y 弹入；选项 stagger；Esc 反向时间轴退出 |
| 动效时间轴面板 | GSAP 核心卖点：关键帧可视化 + 拖拽 + 与游戏内补间双向联动（GSAP 同时驱动 UI 与 Web 游戏动画） |
| 庆祝/成就 | 生成完成粒子 burst（transform-only）+ 状态徽章翻转 |

### 4.4 动效 token 与可测试性

- 动效 token：时长/缓动命名化（--dur-1 200ms、--ease-out power3.out），与 CSS 设计令牌并列；
- 可测试：动画终态用 data-motion-end 钩子或类名断言；e2e 注入 gsap.ticker 快进（测试模式）避免 sleep 等待；
- 性能预算：并发 tween ≤ 64，长列表懒动画（只动画视口内），低端设备自动降级时长 0。

## 5. 分期路线图

### P0 — MVP（约 2 周）：跑通「说需求 → 可玩的游戏」

1. 模式切换 UI（GSAP 揭幕）+ 游戏画布面板（复用右侧预览架构）
2. 内置 Phaser+TS 模板（横版跳跃 / 打砖块 / 贪吃蛇 三个起步模板）
3. 游戏工具组第一批：engine_run/reload/screenshot、scene 读写、project_create
4. 图像资产生成接入 asset-gateway（风格参数、批量、图集切片）
5. 对话闭环 + 记忆沉淀（风格/决策进 MemoryCore）
6. 验收 e2e（真实链路）：生成工程可玩、改需求生效、截图对比变化、动效终态断言

### P1 — 扩展（约 1 个月）：向「开发工具」进化

1. 资产画廊 + 风格 LoRA 训练入口（Scenario 模式）
2. Godot/Unity 引擎桥（MCP），场景检查器
3. NPC 角色系统（记忆/目标，接 MemoryCore）
4. AI 试玩 bot：跑局回放 + 截图回归 + 数值断言（modl.ai 模式）
5. 动效时间轴面板（GSAP 联动）

### P2 — 持续：平台化

3D 资产与音频生成、导出打包（网页/桌面/移动）、模板市场、技能库沉淀与分享（Voyager 模式）。

## 6. 技术选型与风险

| 项 | 选型 | 说明 |
|---|---|---|
| 2D 引擎 | Phaser 3 + TS | AI 生成友好、社区最大、Web 即时预览 |
| 3D 引擎 | Three.js（P0）/ Bevy-WASM（P2） | 渐进 |
| 引擎桥 | MCP server 或自研 adapter | 插件化、低耦合 |
| 资产网关 | asset-gateway 统一抽象 | 可插多家 API / 本地模型；成本护栏 |
| 模型分工 | deepseek-v4-pro 主脑 + v4-flash 试玩 bot 高频调用 | 成本与速度平衡 |
| 动效 | gsap + @gsap/react（全量） | 见第 4 节规范 |

风险与对策：

1. 生成游戏代码正确率 → 模板化 + 分步生成 + 试玩回归兜底（改坏了测试立刻红）
2. 上下文爆炸 → 场景图摘要 + 分层读文件 + compaction（harness 已有能力）
3. 资产风格漂移 → LoRA + 参考图 + 命名规范 + 批量重生成
4. 实时预览性能 → WebGL 帧预算 + 画质降级 + Bevy 逃逸舱
5. 生成代码安全 → 沙箱运行 + 文件系统工作目录隔离（复用 tools-server 边界）

## 7. 与现有 Harness Desktop 的关系（复用清单）

- 复用：Agent 工具循环、tools-server（新增游戏工具组，工作目录隔离不变）、MemoryCore L0-L3、
  会话持久化、launchd 常驻服务模式、e2e 体系（现有 21 用例继续全量回归）
- 新增：game-runtime sidecar（引擎宿主）、asset-gateway、模式切换 UI、GSAP 动效层、游戏工具组
- 兼容：助手模式功能与既有用例不受影响

## 8. 验收标准（真实链路 e2e 示例）

1. 「做一个吃豆人原型」→ 生成工程 → 画布可玩（键盘操作）→ 截图含角色
2. 「把角色改成猫」→ 资产/代码 diff 生效 → 截图对比变化
3. 「跳跃加高 20%」→ scene 参数修改 → 数值断言通过
4. AI 试玩 bot 跑一局 → 日志/截图回归断言通过
5. 风格切换（暖白极简 → 像素风）→ 资产批量重生成且风格一致
6. 动效 e2e：模式揭幕 / 消息入场 / 卡片翻转 / 面板展开的终态断言全通过

## 9. 下一步（评审通过后）

1. 按第 4.1 节清单完成 GSAP 规范学习并产出动效 demo 页（在桌面端可预览）
2. 建 game-runtime + asset-gateway 两个 sidecar 骨架并接通 tools-server
3. P0 第 1-6 项逐项实现，每项配真实 e2e 用例
4. 每期交付后回归全套桌面 e2e 并更新文档
