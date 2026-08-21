/* ================= Harness 状态类型（真实 LLM 引擎 + 真实工具流，无 mock 数据） ================= */

export type ThreadStatus = "waiting" | "working" | "done" | "error";

export type MsgKind = "ask" | "recall" | "plan" | "text" | "tool";

export interface Msg {
  id: number;
  role: "user" | "agent";
  kind?: MsgKind;
  text?: string;
  chip?: string;
  opts?: string[];
  picked?: number;
  items?: string[];
  atoms?: string[];
  time?: string;
  /* kind === "tool"：真实工具执行活动 */
  toolName?: string;
  toolArgs?: string;
  toolStatus?: "running" | "done" | "error";
  toolResult?: string;
}

export interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface Thread {
  id: string;
  title: string;
  status: ThreadStatus;
  msgs: Msg[];
  thinking: boolean;
  todos: Todo[];
  /** 本任务的交付物（agent 生成的 .html 等，渲染为成果卡） */
  deliverables: { path: string; name: string; t: number }[];
}

export const now = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

let tid = 1;
export function newThread(): Thread {
  return {
    id: "C-" + tid++,
    title: "新任务",
    status: "waiting",
    msgs: [],
    thinking: false,
    todos: [],
    deliverables: [],
  };
}

export function greetingMsg(): Msg {
  return {
    id: Date.now(),
    role: "agent",
    kind: "text",
    text: "你好，我是 harness-agent。我可以直接动手：浏览代码仓库、读写文件、运行命令、查资料、写代码。想做什么？",
    time: now(),
  };
}

export function statusBadge(s: ThreadStatus): { cls: string; label: string } {
  return s === "working"
    ? { cls: "active", label: "执行中" }
    : s === "done"
      ? { cls: "done", label: "已完成" }
      : s === "error"
        ? { cls: "error", label: "发生错误" }
        : { cls: "neutral", label: "等待回复" };
}