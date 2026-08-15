/* ================= Harness 状态类型（真实 LLM 引擎，无 mock 数据） ================= */

export type ThreadStatus = "thinking" | "idle" | "done";

export interface Msg {
  id: number;
  role: "user" | "agent";
  kind?: "ask" | "recall" | "plan" | "text";
  text?: string;
  chip?: string;
  opts?: string[];
  picked?: number;
  items?: string[];
  atoms?: string[];
  time?: string;
}

export interface Thread {
  id: string;
  title: string;
  status: ThreadStatus;
  msgs: Msg[];
  thinking: boolean;
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
  };
}

export function greetingMsg(): Msg {
  return {
    id: Date.now(),
    role: "agent",
    kind: "text",
    text: "想做什么？描述模糊也没关系，我会一直问到清楚，再给计划，确认后才动手。",
    time: now(),
  };
}

export function statusBadge(s: ThreadStatus): { cls: string; label: string } {
  return s === "thinking"
    ? { cls: "active", label: "思考中" }
    : s === "done"
      ? { cls: "done", label: "已完成" }
      : { cls: "neutral", label: "进行中" };
}
