import { useEffect, useRef, useState, useCallback } from "react";
import { Thread, Msg, newThread, greetingMsg, now } from "./state";
import {
  MemoryConfig, loadMemoryConfig, saveMemoryConfig,
  recallMemory, commitMemory, chatCompletion,
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

/* ================= 系统提示（澄清协议） ================= */
const SYSTEM_PROMPT = `你是 DeepSeek Harness 桌面助手，一个需求驱动的执行助手。必须严格遵守以下输出协议：
1. 用户需求模糊时，一次只问一个问题，绝不连问。
2. 问题需要用户选择时，回复的最后一行必须输出选项行，格式严格为：
[OPTIONS: 选项A | 选项B | 选项C]
（2 到 4 个选项，竖线分隔，选项短小具体。例如：[OPTIONS: 暖白极简 | 深色终端 | 跟随现有品牌]）
3. 意图清楚后，必须先给计划再动手：回复单独一行 [PLAN]，随后每行一条计划（以 - 开头，2 到 4 条），结尾一行问「确认开始执行吗？」。
4. 用户明确确认后才开始执行；执行中简短汇报；完成后用一句话总结。
5. 中文回复，简洁具体，不要寒暄。`;

/* ================= 真实 LLM 引擎 hook ================= */
function firstThread(): Thread {
  const t = newThread();
  t.msgs.push(greetingMsg());
  return t;
}

/* 模块级初始化一次：避免 StrictMode 双调用造成 id 不一致（白屏根因） */
const INITIAL_THREADS = [firstThread()];

export function useHarness() {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [current, setCurrent] = useState<string>(INITIAL_THREADS[0].id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [model, setModel] = useState("deepseek-v4-pro");
  const [memCfg, setMemCfgState] = useState<MemoryConfig>(loadMemoryConfig);
  const setMemCfg = (cfg: MemoryConfig) => { saveMemoryConfig(cfg); setMemCfgState(cfg); };
  const { toasts, push } = useToasts();

  const cur = threads.find((t) => t.id === current)!;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const currentRef = useRef(current);
  currentRef.current = current;

  const patchThread = (id: string, fn: (t: Thread) => void) => {
    setThreads((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const copy: Thread = { ...t, msgs: [...t.msgs] };
        fn(copy);
        return copy;
      })
    );
  };

  const pushMsg = (id: string, m: Msg) => patchThread(id, (t) => t.msgs.push(m));

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
      if (m.kind === "recall") continue;
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

  /* ---- 核心：发送消息（真实 LLM + 真实记忆） ---- */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const t = threadsRef.current.find((x) => x.id === currentRef.current);
    if (!t) return;
    if (t.thinking) { push("warn", "正在思考", "稍等它回复再发下一条"); return; }
    const isFirstUser = !t.msgs.some((m) => m.role === "user");
    const title = isFirstUser ? text.slice(0, 18) : t.title;
    pushMsg(t.id, { id: Date.now(), role: "user", text, time: now() });
    patchThread(t.id, (tt) => { tt.title = title; tt.thinking = true; });

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

    const latest = threadsRef.current.find((x) => x.id === t.id)!;
    const res = await chatCompletion(memCfg, model, toLlmMessages(latest, recallCtx));
    patchThread(t.id, (tt) => {
      tt.thinking = false;
      if (res.error) {
        tt.msgs.push({ id: Date.now(), role: "agent", kind: "text", text: "连接模型失败：" + res.error + "（检查设置里的 MemoryProxy 地址与密钥）", time: now() });
        return;
      }
      const p = parseReply(res.content);
      tt.msgs.push({ id: Date.now(), role: "agent", kind: p.kind, text: p.text, opts: p.opts, items: p.items, time: now() });
    });
    /* 每轮对话写入真实记忆（L0） */
    if (res.content) {
      commitMemory(title, [{ role: "user", text }, { role: "agent", text: res.content }], memCfg).then((ok) => {
        (window as unknown as Record<string, unknown>).__lastCommit = ok;
        if (ok) push("info", "已沉淀到记忆", "本轮对话已写入 MemoryCore（异步蒸馏 L1/L2/L3）");
      });
    }
  }, [memCfg, model, push]);

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

  const switchThread = (id: string) => {
    setCurrent(id);
    const t = threadsRef.current.find((x) => x.id === id);
    if (t && !t.msgs.some((m) => m.kind === "recall") && t.msgs.length <= 1) setPreviewOpen(false);
  };

  const newChat = () => {
    const t = firstThread();
    setThreads((ts) => [t, ...ts]);
    setCurrent(t.id);
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
    sendMessage, pickChip, confirmPlan, reconsiderPlan, newChat, clearDone,
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
    toasts, push,
    PREVIEW_PAGES: [
      { name: "Harness 官网", url: "preview-demo.html", host: "harness.local" },
      { name: "设计文档", url: "preview-docs.html", host: "docs.harness.local" },
    ],
  };
}

export type Harness = ReturnType<typeof useHarness>;
