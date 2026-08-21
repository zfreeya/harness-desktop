# Agent 工具执行服务（tools-server）

桌面端 Agent 的工具后端，能力对齐 deepseek-harness 关键工具集。
模型发出 tool_calls → 前端转发到本服务真实执行 → 结果回传模型继续推理。

## 架构

\`\`\`text
Harness Desktop (Tauri WebView)
  │  模型返回 tool_calls（bash/read/write/...）
  ├── MemoryProxy :8096 ──→ DeepSeek 真实模型（tools 透传）
  └── tools-server :8450 ──→ 真实执行：
        bash     /bin/bash -lc（cwd=工作目录，超时上限 300s，输出截断 30KB）
        read     带行号读取文本文件（上限 2000 行）
        write    创建/整体覆盖文件
        edit     old_string → new_string 精准替换（默认唯一匹配）
        glob     文件查找（* 与 **，跳过 .git/node_modules）
        grep     正则内容搜索（返回文件+行号，上限 250 条）
        fetch    http/https 抓取（15s 超时，300KB 截断）
        todo_write  本地维护任务清单（渲染为「任务清单」卡）
\`\`\`

## 工作目录沙箱

fs 类工具（read/write/edit/glob/grep）只能访问工作目录树，越界路径直接拒绝。
bash 以工作目录为 cwd，可 cd 到任何本机路径（与 dsh 本地 bash 行为一致）。

- 打包版（Harness.app）：工作目录固定为 \`~/Harness\`，由 launchd 服务
  \`dev.harness.tools\` 常驻（App 是所有者：健康则不动，不健康才修复）。
- 开发/测试版：\`npm run tools\`（工作目录 = 仓库内 \`workspace/\`，已 gitignore）。

## HTTP API（全部 POST JSON，127.0.0.1:8450）

| 端点 | 参数 | 返回 |
|---|---|---|
| \`/bash\` | command, timeoutMs? | exitCode / stdout / stderr |
| \`/read\` | path, offset?, limit? | 带行号内容 |
| \`/write\` | path, content | 落盘结果 |
| \`/edit\` | path, old_string, new_string, replace_all? | before/after |
| \`/glob\` | pattern, path? | 文件路径列表 |
| \`/grep\` | pattern, path?, include? | 匹配行列表 |
| \`/fetch\` | url | status / contentType / text |
| \`/preview/<相对路径>\` (GET) | — | 服务工作目录内静态文件（html/css/js/图片等，no-store） |
| \`/health\` (GET) | — | 状态与工作目录 |

错误统一返回 \`{ "error": "..." }\`（HTTP 200），模型看到错误文本后可自行纠正重试。