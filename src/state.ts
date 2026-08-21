/* ================= Harness 状态类型与辅助（真实 LLM 引擎 + 真实工具流，无 mock 数据） ================= */

/* 任务状态：由真实任务数据驱动，而非单一「已完成」 */
export type ThreadStatus =
  | "preparing"          // 准备中
  | "working"            // 执行中
  | "awaiting-approval"  // 等待用户授权（计划已出，等确认执行）
  | "awaiting-input"     // 等待用户输入（对话继续或选择）
  | "failed"             // 执行失败
  | "ready"              // 成果已就绪
  | "awaiting-review"    // 等待验收（有交付物，等用户检查）
  | "confirmed";         // 用户已确认

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

/* 交付物：一等产品对象（成果卡） */
export type DeliverableState = "running" | "stopped" | "failed";
export interface Deliverable {
  path: string;
  name: string;
  t: number;              // 最近更新（epoch ms）
  state: DeliverableState; // 预览服务状态（真实 ping 驱动）
  type: string;           // 网页应用 / 文档 / 图片 ...
}

export interface Thread {
  id: string;
  title: string;
  status: ThreadStatus;
  msgs: Msg[];
  thinking: boolean;
  todos: Todo[];
  deliverables: Deliverable[];
  updatedAt: number;      // 最近活动（epoch ms，侧栏相对时间）
}

export const now = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

let tid = 1;
export function newThread(): Thread {
  return {
    id: "C-" + tid++,
    title: "新任务",
    status: "awaiting-input",
    msgs: [],
    thinking: false,
    todos: [],
    deliverables: [],
    updatedAt: Date.now(),
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

/* 状态 → 视觉类 / 标签 / 悬停解释 */
export function statusBadge(s: ThreadStatus): { cls: string; label: string; tip: string } {
  switch (s) {
    case "working": return { cls: "active", label: "执行中", tip: "Agent 正在执行任务" };
    case "awaiting-approval": return { cls: "active", label: "等待用户授权", tip: "计划已就绪，确认后才执行" };
    case "awaiting-input": return { cls: "neutral", label: "等待用户输入", tip: "等待你继续输入或选择" };
    case "failed": return { cls: "error", label: "执行失败", tip: "执行出现错误，可查看详情后重试" };
    case "ready": return { cls: "done", label: "成果已就绪", tip: "成果已生成，可查看并验收" };
    case "awaiting-review": return { cls: "done", label: "等待验收", tip: "Agent 已完成执行，请检查预览结果并决定是否继续修改" };
    case "confirmed": return { cls: "done", label: "用户已确认", tip: "你已确认本次成果" };
    default: return { cls: "neutral", label: "准备中", tip: "任务准备中" };
  }
}

/* 任务标题：单一数据源（侧栏/顶栏共用）。
 * 有交付物时派生自交付物，否则用用户标题；绝不显示与内容无关的历史标题。 */
export function taskTitle(t: Thread): string {
  if (t.deliverables.length > 0) {
    const d = t.deliverables[t.deliverables.length - 1];
    return d.name.replace(/\.html?$/i, "") + " 预览";
  }
  return t.title && t.title !== "新任务" ? t.title : "新任务";
}

/* 相对时间（侧栏/摘要） */
export function formatRelative(epoch: number): string {
  const diff = Date.now() - epoch;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + " 分钟前";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + " 小时前";
  const d = new Date(epoch);
  return d.getMonth() + 1 + "月" + d.getDate() + "日 " + formatClock(epoch);
}

/* 具体时间（消息 / 成果卡） */
export function formatClock(epoch: number): string {
  return `${String(new Date(epoch).getHours()).padStart(2, "0")}:${String(new Date(epoch).getMinutes()).padStart(2, "0")}`;
}

/* 执行模式 */
export type ExecMode = "auto" | "confirm" | "plan-only";
export const EXEC_MODES: { id: ExecMode; label: string; desc: string }[] = [
  { id: "auto", label: "自动执行", desc: "Agent 自主调用工具执行，可能修改文件、运行命令" },
  { id: "confirm", label: "执行前确认", desc: "Agent 每次调用工具前先征求你的授权" },
  { id: "plan-only", label: "仅制定计划", desc: "Agent 只输出计划与方案，不执行任何工具" },
];
