import { useEffect, useRef, useState, useCallback } from "react";
import { Thread, Msg, Todo, newThread, greetingMsg, now } from "./state";
import {
  MemoryConfig, loadMemoryConfig, saveMemoryConfig,
  recallMemory, commitMemory, chatCompletion, LlmToolCall,
} from "./memory";

/* ================= Toast ================= */
export interface ToastItem { id: number; kind: string; title: string; msg?: string }
let toastId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((kind: string, title: string, msg?: string) => {
    const id = toastId++;
    setToasts((t) => [...t, { id, kind, title, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return { toasts, push };
}

/* ================= 工具服务配置 ================= */
export interface ToolsConfig { url: string; workspace?: string }
const LS_TOOLS = "harness.tools.config";
export function defaultToolsConfig(): ToolsConfig { return { url: "http://127.0.0.1:8450" }; }
export function loadToolsConfig(): ToolsConfig {
  try {
    const raw = localStorage.getItem(LS_TOOLS);
    if (raw) return { ...defaultToolsConfig(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultToolsConfig();
}
export function saveToolsConfig(cfg: ToolsConfig) { localStorage.setItem(LS_TOOLS, JSON.stringify(cfg)); }

/* ================= 系统提示（直接回答 + 真实工具） ================= */
const SYSTEM_PROMPT = [
  "你是 DeepSeek Harness 桌面助手，一个能真实动手的编程与任务执行 Agent。你有一整套真实工具：",
  "bash（在工作目录运行 shell 命令）、read/write/edit（读写修改文件）、glob/grep（查找文件与代码）、fetch（抓取网页）、todo_write（维护任务清单）。",
  "行为准则：",
  "1. 严谨第一：先核实再下结论，不猜测、不编造；回答必须引用真实输出与证据。直接回答用户的问题，不绕弯子、不重复问候；凡是能用工具验证的（跑命令、看代码、读仓库、抓网页），先动手拿到真实结果再回答，不要空谈。改动文件前先读现状、说明要改什么，改完给出真实结果。",
  "2. 只有信息确实不足以动手时才问澄清问题，一次只问一个；需要用户在几个选项里选时，最后一行输出 [OPTIONS: 选项A | 选项B | 选项C]。",
  "3. 复杂任务（三步以上）先调用 todo_write 列出计划，再逐步执行；执行中简短汇报，完成后一句话总结真实结果。",
  "4. 用户明确要求输出 [PLAN] 计划或 [OPTIONS] 选项格式时必须严格遵守。",
  "5. 中文回复，简洁具体，引用真实输出，不要寒暄客套。",
  "6. 回复使用 Markdown 排版：要点用列表、重点加粗、代码与命令输出用代码块，让回答清晰易读。",
  "7. 你创建的 .html 网页/游戏会自动出现在右侧预览面板（harness.local）并自动打开，完成后提示「已在右侧预览打开」；不要建议用户双击文件或手动起服务器。",
].join("\n");

/* ================= 工具定义（对齐 deepseek-harness 关键工具） ================= */
function buildTools() {
  const str = (description: string) => ({ type: "string", description });
  return [
    { type: "function", function: { name: "bash", description: "在工作目录运行 shell 命令并返回 stdout/stderr。用于运行代码、测试、构建、浏览代码仓库（ls/cat/find/git）等。", parameters: { type: "object", properties: { command: str("要执行的 bash 命令，如 ls -la 或 node test.js") }, required: ["command"] } } },
    { type: "function", function: { name: "read", description: "读取工作目录内的文本文件，返回带行号的内容。", parameters: { type: "object", properties: { path: str("相对工作目录的文件路径"), offset: { type: "integer", description: "起始行号，默认 1" }, limit: { type: "integer", description: "最多返回行数，默认 2000" } }, required: ["path"] } } },
    { type: "function", function: { name: "write", description: "创建或整体覆盖工作目录内的文件。", parameters: { type: "object", properties: { path: str("相对工作目录的文件路径"), content: str("完整文件内容") }, required: ["path", "content"] } } },
    { type: "function", function: { name: "edit", description: "对现有文件做精准文本替换。old_string 必须与文件内容完全一致且唯一（除非 replace_all=true）。", parameters: { type: "object", properties: { path: str("相对工作目录的文件路径"), old_string: str("要被替换的原文"), new_string: str("替换后的新文本"), replace_all: { type: "boolean", description: "是否替换全部匹配，默认 false" } }, required: ["path", "old_string", "new_string"] } } },
    { type: "function", function: { name: "glob", description: "按 glob 模式查找文件（支持 * 与 **）。", parameters: { type: "object", properties: { pattern: str("glob 模式，如 **/*.ts"), path: str("查找起点目录，默认工作目录根") }, required: ["pattern"] } } },
    { type: "function", function: { name: "grep", description: "在文件内容中按正则搜索，返回匹配行（含文件与行号）。", parameters: { type: "object", properties: { pattern: str("正则表达式"), path: str("搜索目录，默认工作目录根"), include: str("文件名过滤 glob，如 *.ts") }, required: ["pattern"] } } },
    { type: "function", function: { name: "fetch", description: "抓取一个 http/https 网页并返回文本内容（截断到 300KB）。", parameters: { type: "object", properties: { url: str("完整 URL，如 https://example.com") }, required: ["url"] } } },
    { type: "function", function: { name: "todo_write", description: "维护当前任务的待办清单。每次调用传完整清单整体替换。", parameters: { type: "object", properties: { todos: { type: "array", description: "完整待办列表", items: { type: "object", properties: { content: str("事项描述"), status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "状态" } }, required: ["content", "status"] } } }, required: ["todos"] } } },
  ];
}

/* ================= 真实 LLM + 真实工具引擎 hook ================= */
const LS_THREADS = "harness.threads.v1";
const LS_CURRENT = "harness.current.v1";
const LS_MODEL = "harness.model.v1";
const LS_REDUCE_MOTION = "harness.reduceMotion.v1";
const LS_MAX_THREADS = 50;
const LS_MAX_MSGS_PER_THREAD = 300;

function firstThread(): Thread {
  const t = newThread();
  t.msgs.push(greetingMsg());
  return t;
}

function normalizeThread(t: Partial<Thread>): Thread {
  const base = newThread();
  return {
    ...base, ...t,
    id: typeof t.id === "string" ? t.id : base.id,
    title: typeof t.title === "string" && t.title ? t.title : "新对话",
    status: t.status === "working" || t.status === "done" || t.status === "error" || t.status === "waiting" ? t.status : "waiting",
    thinking: false,
    msgs: Array.isArray(t.msgs) ? t.msgs.map((m) => ({ ...m, toolStatus: m.toolStatus === "running" ? "error" : m.toolStatus })) : [],
    todos: Array.isArray(t.todos) ? t.todos : [],
    deliverables: Array.isArray(t.deliverables) ? t.deliverables : [],
  };
}

function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(LS_THREADS);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list.map(normalizeThread);
    }
  } catch { /* ignore */ }
  return [firstThread()];
}

/* 模块级初始化一次：避免 StrictMode 双调用造成 id 不一致（白屏根因） */
const INITIAL_THREADS = loadThreads();

/* 内置预览页（工作目录预览标签动态追加其后） */
export const PREVIEW_PAGES = [
  { name: "Harness 官网", url: "preview-demo.html", host: "harness.local" },
  { name: "设计文档", url: "preview-docs.html", host: "docs.harness.local" },
];

export function useHarness() {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [current, setCurrentState] = useState<string>(() => {
    try { return localStorage.getItem(LS_CURRENT) || INITIAL_THREADS[0].id; } catch { return INITIAL_THREADS[0].id; }
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);
  /* 工作目录预览标签：agent 写出 .html 后自动加入并打开（harness.local） */
  const [wsPreviews, setWsPreviews] = useState<{ path: string; name: string; t: number }[]>([]);
  const wsPreviewsRef = useRef(wsPreviews);
  wsPreviewsRef.current = wsPreviews;
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [model, setModelState] = useState<string>(() => {
    try { return localStorage.getItem(LS_MODEL) || "deepseek-v4-pro"; } catch { return "deepseek-v4-pro"; }
  });
  const setModel = (m: string) => { try { localStorage.setItem(LS_MODEL, m); } catch { /* ignore */ } setModelState(m); };
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_REDUCE_MOTION) === "1"; } catch { return false; }
  });
  const setReduceMotionPersist = (v: boolean) => {
    try { localStorage.setItem(LS_REDUCE_MOTION, v ? "1" : "0"); } catch { /* ignore */ }
    setReduceMotion(v);
  };
  const [memCfg, setMemCfgState] = useState<MemoryConfig>(loadMemoryConfig);
  const [toolsCfg, setToolsCfgState] = useState<ToolsConfig>(loadToolsConfig);
  const setMemCfg = (cfg: MemoryConfig) => { saveMemoryConfig(cfg); setMemCfgState(cfg); };
  const setToolsCfg = (cfg: ToolsConfig) => { saveToolsConfig(cfg); setToolsCfgState(cfg); };
  const { toasts, push } = useToasts();

  /* 减弱动态效果：持久化 + 应用到文档根类 */
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  /* 工具服务工作目录展示 */
  useEffect(() => {
    fetch(toolsCfg.url + "/info").then((r) => r.json()).then((d) => {
      if (d && d.workspace) setToolsCfgState((c) => (c.workspace === d.workspace ? c : { ...c, workspace: d.workspace }));
    }).catch(() => undefined);
  }, [toolsCfg.url]);

  /* 会话持久化：每次变化落 localStorage（重开 App 不丢对话），带容量上限防止配额打满 */
  useEffect(() => {
    try {
      const capped = threads.slice(0, LS_MAX_THREADS).map((t) => ({
        ...t,
        msgs: t.msgs.slice(-LS_MAX_MSGS_PER_THREAD),
      }));
      localStorage.setItem(LS_THREADS, JSON.stringify(capped));
    } catch { /* ignore */ }
  }, [threads]);
  useEffect(() => {
    try { localStorage.setItem(LS_CURRENT, current); } catch { /* ignore */ }
  }, [current]);

  const cur = threads.find((t) => t.id === current) ?? threads[0];
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const currentRef = useRef(current);
  currentRef.current = current;
  /* 同步竞态防护：同一时刻只允许一轮 agent 循环（React 状态更新是异步的，靠 ref 兜底） */
  const busyRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const stopCtrlRef = useRef<AbortController | null>(null);

  const patchThread = (id: string, fn: (t: Thread) => void) => {
    setThreads((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const copy: Thread = { ...t, msgs: [...t.msgs], todos: [...t.todos], deliverables: [...t.deliverables] };
        fn(copy);
        return copy;
      })
    );
  };

  const pushMsg = (id: string, m: Msg) => patchThread(id, (t) => t.msgs.push(m));

  const patchMsg = (id: string, msgId: number, fn: (m: Msg) => Msg) =>
    patchThread(id, (t) => { t.msgs = t.msgs.map((m) => (m.id === msgId ? fn(m) : m)); });

  /* E2E 测试钩子：?e2e=1 时暴露消息注入（仅用于确定性 UI 渲染测试） */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("e2e")) {
      (window as unknown as Record<string, unknown>).__e2eInject = (m: Partial<Msg> & { role: "user" | "agent" }) => {
        pushMsg(currentRef.current, { id: Date.now(), time: now(), ...m } as Msg);
      };
    }
  }, []);

  /* ---- 消息 → LLM 历史 ---- */
  const toLlmMessages = (t: Thread, recallCtx: string) => {
    const out: { role: string; content: string }[] = [];
    if (recallCtx) {
      out.push({ role: "system", content: SYSTEM_PROMPT + "\n\n以下是记忆系统召回的用户画像与长期偏好，请在澄清与计划中主动遵守：\n" + recallCtx });
    } else {
      out.push({ role: "system", content: SYSTEM_PROMPT });
    }
    for (const m of t.msgs) {
      if (m.kind === "recall" || m.kind === "tool") continue;
      if (m.role === "user") {
        out.push({ role: "user", content: m.chip ?? m.text ?? "" });
      } else if (m.kind === "plan") {
        out.push({ role: "assistant", content: "[PLAN]\n" + (m.items ?? []).map((i) => "- " + i).join("\n") });
      } else {
        out.push({ role: "assistant", content: m.text ?? "" });
      }
    }
    return out;
  };

  /* ---- 解析回复：选项 / 计划 / 纯文本 ---- */
  const parseReply = (content: string): { kind: "ask" | "plan" | "text"; text: string; opts?: string[]; items?: string[] } => {
    const optsMatch = content.match(/\[OPTIONS:\s*([^\]]+)\]/i);
    if (optsMatch) {
      const opts = optsMatch[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
      const text = content.replace(optsMatch[0], "").trim();
      return { kind: "ask", text: text || "请选择：", opts };
    }
    const planIdx = content.search(/\[PLAN\]/i);
    if (planIdx >= 0) {
      const items = content
        .slice(planIdx)
        .split("\n")
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter((l) => l && !/\[PLAN\]/i.test(l))
        .slice(0, 6);
      const text = content.slice(0, planIdx).trim();
      return { kind: "plan", text: text || "我的计划：", items };
    }
    return { kind: "text", text: content };
  };

  /* ---- 工具执行（tools-server + 本地 todo_write） ---- */
  const toolEvents = useRef<{ name: string; args: unknown; result: string; status: string }[]>([]);
  const lastToolErrorToastAt = useRef(0);
  /** 组合超时与用户停止信号的 AbortSignal */
  const anySignal = (timeoutMs: number): AbortSignal => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(new DOMException("超时", "TimeoutError")), timeoutMs);
    const onStop = () => ac.abort(stopCtrlRef.current?.signal.reason ?? new DOMException("已停止", "AbortError"));
    stopCtrlRef.current?.signal.addEventListener("abort", onStop, { once: true });
    ac.signal.addEventListener("abort", () => {
      clearTimeout(t);
      stopCtrlRef.current?.signal.removeEventListener("abort", onStop);
    }, { once: true });
    return ac.signal;
  };
  /** 执行一个工具调用；返回文本与是否失败（网络失败或服务返回业务错误） */
  const execTool = async (name: string, args: Record<string, unknown>, threadId: string): Promise<{ text: string; failed: boolean }> => {
    if (name === "todo_write") {
      const todos = Array.isArray(args.todos) ? (args.todos as Todo[]) : [];
      patchThread(threadId, (t) => { t.todos = todos.slice(0, 12); });
      const text = JSON.stringify({ ok: true, todos: todos.slice(0, 12) });
      toolEvents.current.push({ name, args, result: text, status: "done" });
      (window as unknown as Record<string, unknown>).__toolEvents = toolEvents.current.slice();
      return { text, failed: false };
    }
    try {
      const res = await fetch(toolsCfg.url + "/" + name, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: anySignal(180000),
      });
      const data = await res.json();
      const text = JSON.stringify(data);
      const failed = Boolean(data && typeof data === "object" && "error" in data);
      toolEvents.current.push({ name, args, result: text, status: failed ? "error" : "done" });
      (window as unknown as Record<string, unknown>).__toolEvents = toolEvents.current.slice();
      /* HTML 产物 → 工作目录预览 + 任务交付物：新建自动打开面板，改动自动刷新并重命名任务 */
      if (!failed && (name === "write" || name === "edit") && typeof args.path === "string" && /\.html?$/i.test(args.path)) {
        const p = String(args.path);
        const base = p.split("/").pop() ?? p;
        const existed = wsPreviewsRef.current.some((x) => x.path === p);
        setWsPreviews((list) => {
          const t = Date.now();
          return list.some((x) => x.path === p)
            ? list.map((x) => (x.path === p ? { ...x, t } : x))
            : [...list, { path: p, name: base, t }];
        });
        patchThread(threadId, (tt) => {
          const has = tt.deliverables.some((d) => d.path === p);
          tt.deliverables = has
            ? tt.deliverables.map((d) => (d.path === p ? { ...d, t: Date.now() } : d))
            : [...tt.deliverables, { path: p, name: base, t: Date.now() }];
          tt.title = base + " · 网页预览";
        });
        if (!existed) {
          setPreviewTab(PREVIEW_PAGES.length + wsPreviewsRef.current.length);
          setPreviewOpen(true);
          push("success", "已在右侧预览打开", p);
        }
      }
      return { text, failed };
    } catch (e) {
      const stopped = stopRequestedRef.current;
      const text = JSON.stringify({ error: stopped ? "已停止" : "工具服务不可达：" + String(e) });
      toolEvents.current.push({ name, args, result: text, status: "error" });
      (window as unknown as Record<string, unknown>).__toolEvents = toolEvents.current.slice();
      if (!stopped) {
        const n = Date.now();
        if (n - lastToolErrorToastAt.current > 5000) {
          lastToolErrorToastAt.current = n;
          push("error", "工具服务不可达", "检查设置里的工具服务地址，或确认服务已启动");
        }
      }
      return { text, failed: true };
    }
  };

  /* ---- 核心：发送消息（真实 LLM + 真实工具循环 + 真实记忆） ---- */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    // 同步竞态防护：React 状态更新是异步的，连续快速发送会同时进入两轮循环
    if (busyRef.current) { push("warn", "正在工作", "稍等它完成再发下一条"); return; }
    busyRef.current = true;
    stopRequestedRef.current = false;
    stopCtrlRef.current = new AbortController();
    const t = threadsRef.current.find((x) => x.id === currentRef.current);
    if (!t) { busyRef.current = false; return; }
    const isFirstUser = !t.msgs.some((m) => m.role === "user");
    const title = isFirstUser ? text.slice(0, 18) : t.title;
    const userMsg: Msg = { id: Date.now(), role: "user", text, time: now() };
    // 关键：LLM 历史必须包含「刚发出的这条消息」。
    // threadsRef 要等 React 重渲染后才更新，同步读它会漏掉刚 push 的消息
    // （症状：第二轮起的回复都在回答上一轮）。因此用本地快照构建历史。
    const snapshot: Thread = { ...t, title, msgs: [...t.msgs, userMsg], thinking: true, todos: [...t.todos] };
    pushMsg(t.id, userMsg);
    patchThread(t.id, (tt) => { tt.title = title; tt.thinking = true; tt.status = "working"; });

    let recallCtx = "";
    if (isFirstUser && memCfg.enabled) {
      const rec = await recallMemory(text, memCfg);
      // E2E 钩子：记录本次召回的真实来源（core/proxy/local/none）
      (window as unknown as Record<string, unknown>).__lastRecallSource = rec.source;
      if (rec.source !== "none" && (rec.atoms.length || rec.persona)) {
        pushMsg(t.id, {
          id: Date.now(), role: "agent", kind: "recall",
          text: "我先从记忆里恢复了你的偏好，这次会主动遵守：",
          atoms: rec.atoms.slice(0, 4), time: now(),
        });
        recallCtx = [rec.persona, ...rec.atoms].filter(Boolean).join("\n");
      }
    }

    const messages: { role: string; content: string; tool_calls?: LlmToolCall[]; tool_call_id?: string }[] =
      toLlmMessages(snapshot, recallCtx);
    let finalContent = "";
    let finalError = "";
    let stopped = false;
    const MAX_STEPS = 12;

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        if (stopRequestedRef.current) { stopped = true; break; }
        const res = await chatCompletion(memCfg, model, messages, buildTools());
        if (stopRequestedRef.current) { stopped = true; break; }
        if (res.error) { finalError = res.error; break; }
        const calls = res.tool_calls ?? [];
        if (calls.length === 0) { finalContent = res.content; break; }
        messages.push({ role: "assistant", content: res.content, tool_calls: calls });
        for (const call of calls) {
          if (stopRequestedRef.current) { stopped = true; break; }
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* 保持空对象 */ }
          const msgId = Date.now() + Math.floor(Math.random() * 1000);
          pushMsg(t.id, {
            id: msgId, role: "agent", kind: "tool", time: now(),
            toolName: call.function.name,
            toolArgs: JSON.stringify(args).slice(0, 400),
            toolStatus: "running",
          });
          const { text: result, failed } = await execTool(call.function.name, args, t.id);
          // 停止时工具可能被中断：行状态仍按失败标记
          patchMsg(t.id, msgId, (m) => ({ ...m, toolStatus: failed ? "error" : "done", toolResult: result.slice(0, 4000) }));
          messages.push({ role: "tool", tool_call_id: call.id, content: result.slice(0, 8000) });
        }
        if (stopped) break;
      }
      if (!finalContent && !finalError && !stopped) finalContent = "已经完成了工具调用。";
    } finally {
      busyRef.current = false;
      stopCtrlRef.current = null;
      patchThread(t.id, (tt) => { tt.thinking = false; });
    }

    if (stopped) {
      patchThread(t.id, (tt) => {
        tt.status = "waiting";
        tt.msgs.push({ id: Date.now(), role: "agent", kind: "text", text: "已停止。", time: now() });
      });
      return;
    }
    if (finalError) {
      patchThread(t.id, (tt) => {
        tt.status = "error";
        tt.msgs.push({ id: Date.now(), role: "agent", kind: "text", text: "连接模型失败：" + finalError + "（检查设置里的 MemoryProxy 地址与密钥）", time: now() });
      });
      return;
    }
    const p = parseReply(finalContent);
    patchThread(t.id, (tt) => {
      tt.status = "done";
      tt.msgs.push({ id: Date.now(), role: "agent", kind: p.kind, text: p.text, opts: p.opts, items: p.items, time: now() });
    });
    /* 每轮对话写入真实记忆（L0） */
    commitMemory(title, [{ role: "user", text }, { role: "agent", text: finalContent }], memCfg).then((ok) => {
      (window as unknown as Record<string, unknown>).__lastCommit = ok;
      if (ok) push("info", "已沉淀到记忆", "本轮对话已写入 MemoryCore（异步蒸馏 L1/L2/L3）");
    });
  }, [memCfg, model, push, toolsCfg]);

  const pickChip = (mi: number, oi: number) => {
    const t = threadsRef.current.find((x) => x.id === currentRef.current);
    if (!t) return;
    const m = t.msgs[mi];
    if (m.picked !== undefined || t.thinking) return;
    patchThread(t.id, (tt) => { tt.msgs[mi] = { ...m, picked: oi }; });
    sendMessage(m.opts![oi]);
  };

  const confirmPlan = () => sendMessage("开始执行");
  const reconsiderPlan = () => sendMessage("我想修改计划");

  /** 停止当前进行中的 agent 循环（中断 LLM 等待与工具执行） */
  const stop = useCallback(() => {
    if (!busyRef.current) return;
    stopRequestedRef.current = true;
    stopCtrlRef.current?.abort();
  }, []);

  /** 关闭一个工作目录预览标签；若关闭的是当前标签则切回首个内置页 */
  const closeWsPreview = (p: string) => {
    const idx = wsPreviewsRef.current.findIndex((x) => x.path === p);
    setWsPreviews((list) => list.filter((x) => x.path !== p));
    if (idx >= 0 && previewTab === PREVIEW_PAGES.length + idx) setPreviewTab(0);
  };

  const switchThread = (id: string) => {
    setCurrentState(id);
    const t = threadsRef.current.find((x) => x.id === id);
    if (t && !t.msgs.some((m) => m.kind === "recall") && t.msgs.length <= 1) setPreviewOpen(false);
  };

  const newChat = () => {
    const t = firstThread();
    setThreads((ts) => [t, ...ts]);
    setCurrentState(t.id);
    setPreviewOpen(false);
  };

  const clearDone = () => {
    setThreads((ts) => {
      const rest = ts.filter((t) => t.status !== "done");
      return rest.length ? rest : [firstThread()];
    });
    push("success", "已清理");
  };

  return {
    threads, current, cur, setCurrent: switchThread,
    sendMessage, stop, pickChip, confirmPlan, reconsiderPlan, newChat, clearDone,
    reduceMotion, setReduceMotion: setReduceMotionPersist,
    previewOpen, previewTab, setPreviewTab, device, setDevice,
    setPreviewOpen: (v: boolean) => setPreviewOpen(v),
    openPreview: () => setPreviewOpen(true),
    closePreview: () => setPreviewOpen(false),
    togglePreview: () => setPreviewOpen((v) => !v),
    reloadPreview: () => {
      const frame = document.getElementById("previewFrame") as HTMLIFrameElement | null;
      if (frame) frame.src = frame.src.split("?")[0] + "?t=" + Date.now();
      push("info", "预览已刷新");
    },
    settingsOpen, setSettingsOpen, paletteOpen, setPaletteOpen,
    model, setModel,
    memCfg, setMemCfg,
    toolsCfg, setToolsCfg,
    wsPreviews, closeWsPreview,
    toasts, push,
    PREVIEW_PAGES,
  };
}

export type Harness = ReturnType<typeof useHarness>;