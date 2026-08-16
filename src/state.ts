/* ================= Harness 状态类型（真实 LLM 引擎 + 真实工具流，无 mock 数据） ================= */

export type ThreadStatus = "thinking" | "idle" | "done";

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
}

export const now = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

let tid = 1;
export function newThread(): Thread {
  return {
    id: "C-" + tid++,
    title: "新对话",
    status: "idle",
    msgs: [],
    thinking: false,
    todos: [],
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
  return s === "thinking"
    ? { cls: "active", label: "执行中" }
    : s === "done"
      ? { cls: "done", label: "已完成" }
      : { cls: "neutral", label: "进行中" };
}
