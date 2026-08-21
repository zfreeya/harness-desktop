import { useEffect, useRef, useState } from "react";
import { useHarness, Harness } from "./harness";
import { Msg, statusBadge } from "./state";
import Markdown from "./Markdown";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function winAction(action: "close" | "minimize" | "maximize") {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (action === "close") await w.close();
  if (action === "minimize") await w.minimize();
  if (action === "maximize") await w.toggleMaximize();
}

/* ================= 图标 ================= */
const Ic = {
  mark: (<img src="/icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />),
  spark: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.3-.5.5 3.3L21 9.6l-1.8 2.8 1.8 2.8-2.8 1.8-.5 3.3-3.3-.5L12 22l-2.4-2.4-3.3.5-.5-3.3L3 15.2l1.8-2.8L3 9.6l2.8-1.8.5-3.3 3.3.5z" /><circle cx="12" cy="11" r="3.2" fill="#fff" /></svg>),
  plus: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>),
  search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>),
  monitor: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>),
  tablet: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>),
  phone: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M12 18h.01" /></svg>),
  gear: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
  x: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>),
  chevR: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>),
  chevD: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>),
  check: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>),
  send: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>),
  clip: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>),
  reload: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>),
  lock: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  doc: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>),
  panel: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>),
};

/* ================= 顶栏：任务标题 + 语义状态 + 必要操作 ================= */
function TitleBar({ h, sideOpen, onToggleSide }: { h: Harness; sideOpen: boolean; onToggleSide: () => void }) {
  const b = statusBadge(h.cur.status);
  return (
    <div className="win-titlebar" data-tauri-drag-region>
      <div className="traffic">
        <span className="t" onClick={() => winAction("close")} title="关闭"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" /></svg></span>
        <span className="t" onClick={() => winAction("minimize")} title="最小化"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 5h5" /></svg></span>
        <span className="t" onClick={() => winAction("maximize")} title="全屏"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 3h4v4H3z" /></svg></span>
      </div>
      <button className="side-toggle" onClick={onToggleSide} title={sideOpen ? "收起侧栏" : "展开侧栏"} aria-label="切换侧栏">{Ic.panel}</button>
      <div className="win-title">
        <span className="task-title" title={h.cur.title}>{h.cur.title}</span>
        <span className={"badge " + b.cls}>{b.label}</span>
      </div>
      <div className="win-right">
        <button className="head-btn" onClick={h.togglePreview} title="预览面板（打开/收起）" aria-label="预览">{Ic.monitor}</button>
        <button className="head-btn" onClick={() => h.setSettingsOpen(true)} title="设置" aria-label="设置">{Ic.gear}</button>
      </div>
    </div>
  );
}

/* ================= 侧栏 ================= */
function Sidebar({ h }: { h: Harness }) {
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <span className="sb-mark">{Ic.mark}</span>
        <span className="sb-name">Harness</span>
      </div>
      <button className="btn btn-accent btn-new-chat" onClick={h.newChat}>{Ic.plus}新建任务</button>
      <div className="side-search">
        <div className="search-input" onClick={() => h.setPaletteOpen(true)}>
          {Ic.search}
          <input placeholder="搜索任务" readOnly />
          <span className="kbd">⌘K</span>
        </div>
      </div>
      <div className="side-label">任务</div>
      <div className="thread-list">
        {h.threads.map((t) => {
          const last = t.msgs[t.msgs.length - 1];
          const b = statusBadge(t.status);
          return (
            <div key={t.id} className={"thread-item" + (t.id === h.current ? " on" : "")} onClick={() => h.setCurrent(t.id)} title={t.title}>
              <span className={"tstatus " + t.status} data-status={t.status} aria-label={b.label} />
              <div className="t-main">
                <div className="tt">{t.title}</div>
                <div className="tm"><span className="tst">{last?.time ?? "刚刚"}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="side-agent">
        <div className={"agent-orb" + (h.cur.thinking ? " busy" : "")}>{Ic.spark}</div>
        <div className="meta">
          <div className="who">harness-agent</div>
          <div className="state side-conn"><span className="pdot idle" />在线</div>
        </div>
      </div>
    </aside>
  );
}

/* ================= 消息头（弱化元信息） ================= */
function AgentHead({ time }: { time?: string }) {
  return (
    <div className="a-head">
      <span className="a-mark">{Ic.spark}</span>
      <span className="a-name">harness-agent</span>
      {time && <span className="a-time">{time}</span>}
    </div>
  );
}

/* ================= 工具调用组：默认折叠 ================= */
function ToolGroup({ group, open, onToggle }: { group: Msg[]; open: boolean; onToggle: () => void }) {
  const running = group.some((g) => g.toolStatus === "running");
  const hasErr = group.some((g) => g.toolStatus === "error");
  const names = Array.from(new Set(group.map((g) => g.toolName))).join("、");
  const step = group.length + " 个步骤";
  const copyText = async (txt: string) => { try { await navigator.clipboard.writeText(txt); } catch { /* ignore */ } };
  return (
    <div className={"tool-group" + (hasErr ? " err" : "") + (open ? " open" : "")}>
      <button className="tool-summary" onClick={onToggle} aria-expanded={open}>
        <span className="tg-status">{running ? <span className="tg-run"><i /><i /><i /></span> : hasErr ? <span className="tg-x">!</span> : Ic.check}</span>
        <span className="tg-text">{running ? "正在执行 " + names + "…" : hasErr ? "部分工具执行失败 · " + names + " · " + step : "已完成 " + names + " · " + step}</span>
        <span className={"tg-chev" + (open ? " up" : "")}>{Ic.chevD}</span>
      </button>
      {open && (
        <div className="tool-items">
          {group.map((g) => (
            <div key={g.id} className={"tool-line mono" + (g.toolStatus === "done" ? " ok" : g.toolStatus === "error" ? " err" : "")}>
              <div className="tl-head">
                <span className="tl-name">{g.toolName}</span>
                <span className="tl-args">{g.toolArgs}</span>
                {g.toolStatus === "running" && <span className="tool-wait"><i /><i /><i /></span>}
              </div>
              {g.toolResult && (
                <div className="tl-out">
                  <pre>{g.toolResult}</pre>
                  <button className="tl-copy" onClick={() => copyText(g.toolResult!)} title="复制输出">复制</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= 成果卡：交付物 ================= */
function DeliverableCard({ h, d }: { h: Harness; d: { path: string; name: string; t: number } }) {
  const displayName = d.name.replace(/\.html?$/i, "") + " 预览";
  const url = h.toolsCfg.url + "/preview/" + d.path;
  const openPreview = () => {
    const idx = h.wsPreviews.findIndex((x) => x.path === d.path);
    h.setPreviewTab(h.PREVIEW_PAGES.length + (idx >= 0 ? idx : 0));
    h.openPreview();
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); h.push("success", "已复制链接", url); }
    catch { h.push("warn", "复制失败", "请手动复制地址栏链接"); }
  };
  return (
    <div className="deliverable-card">
      <div className="dc-head">
        <span className="dc-title">{displayName}</span>
        <span className="dc-status"><span className="dc-dot" />已就绪</span>
      </div>
      <div className="dc-desc">网页已生成并写入工作目录，可立即在预览面板打开试玩。</div>
      <div className="dc-url mono">{url}</div>
      <div className="dc-actions">
        <button className="btn btn-primary" onClick={openPreview}>{Ic.monitor}打开预览</button>
        <button className="btn btn-secondary" onClick={copyLink}>{Ic.clip}复制链接</button>
      </div>
      <details className="dc-help">
        <summary>操作说明</summary>
        <p>点击「打开预览」在右侧面板试玩；刷新按钮可重载最新改动。也可复制链接在系统浏览器中打开。</p>
      </details>
    </div>
  );
}

/* ================= 消息行 ================= */
function MsgRow({ m, h, mi }: { m: Msg; h: Harness; mi: number }) {
  if (m.role === "user") {
    return <div className="msg user"><div className="bubble">{m.chip ?? m.text}</div></div>;
  }
  if (m.kind === "ask") {
    const opts = m.opts ?? [];
    return (
      <div className="msg agent">
        <AgentHead time={m.time} />
        <div className="text"><Markdown text={m.text ?? ""} /></div>
        {opts.length > 0 && (
          <div className="chips">
            {opts.map((o, i) => (
              <button key={i} className={"chip" + (m.picked === i ? " picked" : "") + (m.picked !== undefined && m.picked !== i ? " gone" : "")} disabled={m.picked !== undefined} onClick={() => h.pickChip(mi, i)}>{o}</button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (m.kind === "recall") {
    return (
      <div className="msg agent">
        <AgentHead time={m.time} />
        <div className="text">{m.text}</div>
        <div className="mem-block">
          <div className="mem-label">来自记忆 · L1/L2 召回</div>
          {(m.atoms ?? []).map((a, i) => <div className="mem-atom" key={i}>{a}</div>)}
        </div>
      </div>
    );
  }
  if (m.kind === "plan") {
    const items = m.items ?? [];
    return (
      <div className="msg agent">
        <AgentHead time={m.time} />
        <div className="text"><Markdown text={m.text ?? ""} /></div>
        {items.length > 0 && (
          <div className="plan-card">
            <div className="pt">计划</div>
            {items.map((it, i) => <div className="pi" key={i}><b>{i + 1}</b><span>{it}</span></div>)}
            <div className="pa">
              <button className="btn btn-primary btn-sm" onClick={h.confirmPlan}>开始执行</button>
              <button className="btn btn-ghost btn-sm" onClick={h.reconsiderPlan}>改一改</button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return <div className="msg agent"><AgentHead time={m.time} /><div className="text"><Markdown text={m.text ?? ""} /></div></div>;
}

/* ================= 底部 Agent 操作台 ================= */
function Console({ h, text, setText, send }: { h: Harness; text: string; setText: (v: string) => void; send: () => void }) {
  return (
    <div className="console-bar">
      <div className="console">
        <div className="console-row">
          <button className="tool-btn" title="附件" aria-label="附件" onClick={() => h.push("info", "附件", "将打开文件选择器")}>{Ic.clip}</button>
          <textarea id="chatInput" rows={1} placeholder="描述你希望 Agent 完成的任务……" value={text}
            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <span className="mode-chip" title="当前执行模式">{Ic.spark}Agent · 自动执行</span>
          <button className={h.cur.thinking ? "send-btn stop" : "send-btn"} onClick={h.cur.thinking ? h.stop : send} title={h.cur.thinking ? "停止" : "发送"} aria-label={h.cur.thinking ? "停止" : "发送"}>{h.cur.thinking ? <span className="stop-ico" /> : Ic.send}</button>
        </div>
        <div className="console-hint">
          <span className="mono">Enter</span> 发送 · <span className="mono">Shift+Enter</span> 换行 · <span className="mono">⌘K</span> 命令
          <span className="hint-right mono">{h.toolsCfg.workspace ?? "工具服务未连接"}</span>
        </div>
      </div>
    </div>
  );
}

/* ================= 对话区：连续 Agent 任务时间线 ================= */
function ChatView({ h }: { h: Harness }) {
  const [text, setText] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [h.cur.msgs.length, h.cur.thinking, h.cur.deliverables.length]);
  const send = () => { h.sendMessage(text); setText(""); };
  const rows: ({ msg: Msg } | { group: Msg[] })[] = [];
  {
    const msgs = h.cur.msgs;
    let i = 0;
    while (i < msgs.length) {
      if (msgs[i].kind === "tool") {
        const g = [msgs[i]];
        let j = i + 1;
        while (j < msgs.length && msgs[j].kind === "tool") { g.push(msgs[j]); j++; }
        rows.push({ group: g });
        i = j;
      } else {
        rows.push({ msg: msgs[i] });
        i++;
      }
    }
  }
  return (
    <main className="chat">
      <div className="msg-scroll" ref={scrollRef}>
        <div className="msg-col">
          {h.cur.todos.length > 0 && (
            <div className="todo-card">
              <div className="todo-title">任务清单</div>
              {h.cur.todos.map((td, i) => (
                <div key={i} className={"todo-item " + td.status}>
                  <span className="todo-check">{td.status === "completed" ? Ic.check : td.status === "in_progress" ? "·" : ""}</span>
                  <span className="todo-text">{td.content}</span>
                </div>
              ))}
            </div>
          )}
          {rows.map((r, idx) =>
            "group" in r ? (
              <ToolGroup key={"g" + idx} group={r.group} open={!!openGroups[idx]} onToggle={() => setOpenGroups((s) => ({ ...s, [idx]: !s[idx] }))} />
            ) : (
              <MsgRow key={r.msg.id} m={r.msg} h={h} mi={idx} />
            )
          )}
          {h.cur.thinking && (
            <div className="msg agent">
              <div className="a-head"><span className="a-mark">{Ic.spark}</span><span className="a-name">harness-agent</span></div>
              <div className="thinking"><span className="tt">正在执行</span><i /><i /><i /></div>
            </div>
          )}
          {h.cur.deliverables.length > 0 && <DeliverableCard h={h} d={h.cur.deliverables[h.cur.deliverables.length - 1]} />}
        </div>
      </div>
      <Console h={h} text={text} setText={setText} send={send} />
    </main>
  );
}

/* ================= 右侧预览面板 ================= */
function PreviewPane({ h }: { h: Harness }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (h.previewOpen && !loaded) setLoaded(true); }, [h.previewOpen, loaded]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const spin = () => { const btn = document.getElementById("reloadBtn"); if (!btn) return; btn.classList.remove("reload-spin"); void (btn as HTMLElement).offsetWidth; btn.classList.add("reload-spin"); };
  const tabs = [
    ...h.PREVIEW_PAGES.map((p) => ({ kind: "demo" as const, ...p })),
    ...h.wsPreviews.map((p) => ({ kind: "ws" as const, name: p.name, path: p.path, t: p.t, host: "harness.local" })),
  ];
  const cur = tabs[Math.min(h.previewTab, tabs.length - 1)] ?? tabs[0];
  const src = cur.kind === "demo" ? cur.url : h.toolsCfg.url + "/preview/" + cur.path + "?t=" + cur.t;
  const addr = cur.kind === "demo" ? cur.host : cur.host + "/preview/" + cur.path;
  return (
    <aside id="previewPane" className={"preview-pane" + (h.previewOpen ? " open" : "")}>
      <div className="pv-inner">
        <div className="pv-head">
          <span className="t">预览</span>
          <span className="pill mono">{cur.host}</span>
          <button className="pv-close" onClick={h.closePreview} title="收起">{Ic.chevR}</button>
        </div>
        <div className="browser-bar">
          <div className="tabs-row">
            {tabs.map((p, i) => (
              <div key={p.kind === "demo" ? p.name : p.path} className={"btab" + (h.previewTab === i ? " on" : "")} onClick={() => h.setPreviewTab(i)}>
                <span className="bdot" />{p.name}
                {p.kind === "ws" && <button className="btab-x" title="关闭标签" onClick={(e) => { e.stopPropagation(); h.closeWsPreview(p.path); }}>×</button>}
              </div>
            ))}
          </div>
          <div className="addr-row">
            <div className="nav-btns">
              <button className="abtn" disabled title="后退">←</button>
              <button className="abtn" disabled title="前进">→</button>
              <button className="abtn" id="reloadBtn" onClick={() => { spin(); h.reloadPreview(); }} title="刷新">{Ic.reload}</button>
            </div>
            <div className="address-bar">{Ic.lock}<span className="addr">{addr}</span></div>
            <div className="dev-switch" id="devSwitch">
              <button className={h.device === "desktop" ? "on" : ""} onClick={() => h.setDevice("desktop")} title="桌面">{Ic.monitor}</button>
              <button className={h.device === "tablet" ? "on" : ""} onClick={() => h.setDevice("tablet")} title="平板">{Ic.tablet}</button>
              <button className={h.device === "mobile" ? "on" : ""} onClick={() => h.setDevice("mobile")} title="手机">{Ic.phone}</button>
            </div>
          </div>
        </div>
        <div className="preview-stage">
          {loaded && <iframe ref={frameRef} id="previewFrame" className={"dev-" + h.device} title="预览" src={src} />}
        </div>
      </div>
    </aside>
  );
}

/* ================= 命令面板 ================= */
const PALETTE = [
  { name: "新建任务", hint: "⌘N", icon: Ic.plus, run: (h: Harness) => { h.setPaletteOpen(false); h.newChat(); } },
  { name: "打开预览", hint: "", icon: Ic.monitor, run: (h: Harness) => { h.setPaletteOpen(false); h.openPreview(); } },
  { name: "打开设置", hint: "", icon: Ic.gear, run: (h: Harness) => { h.setPaletteOpen(false); h.setSettingsOpen(true); } },
  { name: "清空已完成任务", hint: "", icon: Ic.x, run: (h: Harness) => { h.setPaletteOpen(false); h.clearDone(); } },
  { name: "打开设计文档", hint: "", icon: Ic.doc, run: (h: Harness) => { h.setPaletteOpen(false); h.setPreviewTab(1); h.openPreview(); } },
];

function CommandPalette({ h }: { h: Harness }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const cmds = PALETTE.filter((c) => !q || c.name.includes(q));
  const cur = Math.min(sel, cmds.length - 1);
  useEffect(() => { if (h.paletteOpen) { setQ(""); setSel(0); } }, [h.paletteOpen]);
  if (!h.paletteOpen) return null;
  return (
    <div id="palette" className="show" onClick={(e) => { if (e.target === e.currentTarget) h.setPaletteOpen(false); }}>
      <div className="palette">
        <div className="palette-input">
          {Ic.search}
          <input autoFocus placeholder="搜索命令…" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list">
          {cmds.length === 0 && <div className="palette-empty">没有匹配的命令</div>}
          {cmds.map((c, i) => (
            <div key={c.name} className={"palette-item" + (i === cur ? " sel" : "")} onMouseMove={() => setSel(i)} onClick={() => c.run(h)}>
              <span className="pi-icon">{c.icon}</span>
              <span className="pi-name">{c.name}</span>
              {c.hint && <span className="pi-hint">{c.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= 设置弹窗 ================= */
function SettingsModal({ h }: { h: Harness }) {
  if (!h.settingsOpen) return null;
  return (
    <div id="settingsModal" className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) h.setSettingsOpen(false); }}>
      <div className="sheet">
        <div className="pv-head">
          <span className="t">设置</span>
          <button className="pv-close" onClick={() => h.setSettingsOpen(false)} title="关闭">{Ic.x}</button>
        </div>
        <div className="set-group">
          <div className="g-title">Agent</div>
          <div className="set-row">
            <div><div className="lbl">默认模型</div><div className="desc">对话与执行使用的真实模型</div></div>
            <select className="inp" id="setModel" value={h.model} onChange={(e) => h.setModel(e.target.value)}>
              <option value="deepseek-chat">deepseek-chat（快）</option>
              <option value="deepseek-v4-pro">deepseek-v4-pro（强）</option>
              <option value="deepseek-v4-flash">deepseek-v4-flash（极速）</option>
            </select>
          </div>
        </div>
        <div className="set-group">
          <div className="g-title">工具执行（Agent Tools）</div>
          <div className="set-row">
            <div><div className="lbl">工具服务地址</div><div className="desc">bash / 文件 / 网页工具后端，默认 http://127.0.0.1:8450</div></div>
            <input className="inp-txt" style={{ width: 180 }} value={h.toolsCfg.url} onChange={(e) => h.setToolsCfg({ ...h.toolsCfg, url: e.target.value })} />
          </div>
          <div className="set-row">
            <div><div className="lbl">工作目录</div><div className="desc">Agent 读写文件的根目录（由工具服务指定）</div></div>
            <span style={{ fontSize: 11, color: "var(--color-ink-muted)", fontFamily: "var(--font-mono)" }}>{h.toolsCfg.workspace ?? "（服务未连接）"}</span>
          </div>
        </div>
        <div className="set-group">
          <div className="g-title">记忆（TencentDB Agent Memory）</div>
          <div className="set-row">
            <div><div className="lbl">启用记忆</div><div className="desc">会话前后自动召回 / 沉淀（L0-L3）</div></div>
            <label className="switch"><input type="checkbox" checked={h.memCfg.enabled} onChange={(e) => h.setMemCfg({ ...h.memCfg, enabled: e.target.checked })} /><span className="track" /><span className="knob" /></label>
          </div>
          <div className="set-row">
            <div><div className="lbl">MemoryCore 地址</div><div className="desc">记忆内核网关，默认 http://127.0.0.1:8420</div></div>
            <input className="inp-txt" style={{ width: 180 }} value={h.memCfg.coreUrl} onChange={(e) => h.setMemCfg({ ...h.memCfg, coreUrl: e.target.value })} />
          </div>
          <div className="set-row">
            <div><div className="lbl">MemoryProxy 地址</div><div className="desc">可选，LLM 代理注入层</div></div>
            <input className="inp-txt" style={{ width: 180 }} value={h.memCfg.serverUrl} onChange={(e) => h.setMemCfg({ ...h.memCfg, serverUrl: e.target.value })} />
          </div>
          <div className="set-row">
            <div><div className="lbl">空间 / 团队</div><div className="desc">对应 Proxy 路径 /{'{space}'}/{'{team}'}</div></div>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="inp-txt" style={{ width: 70 }} value={h.memCfg.spaceId} onChange={(e) => h.setMemCfg({ ...h.memCfg, spaceId: e.target.value })} />
              <input className="inp-txt" style={{ width: 90 }} value={h.memCfg.teamId} onChange={(e) => h.setMemCfg({ ...h.memCfg, teamId: e.target.value })} />
            </div>
          </div>
          <div className="set-row">
            <div><div className="lbl">User Key</div><div className="desc">MemoryHub 签发的 sk-mem-...，留空走本地直连</div></div>
            <input className="inp-txt" style={{ width: 180 }} type="password" placeholder="sk-mem-…" value={h.memCfg.userKey} onChange={(e) => h.setMemCfg({ ...h.memCfg, userKey: e.target.value })} />
          </div>
        </div>
        <div className="set-group">
          <div className="g-title">外观</div>
          <div className="set-row">
            <div><div className="lbl">减弱动态效果</div><div className="desc">关闭过渡与呼吸动画</div></div>
            <label className="switch"><input type="checkbox" checked={h.reduceMotion} onChange={(e) => h.setReduceMotion(e.target.checked)} /><span className="track" /><span className="knob" /></label>
          </div>
        </div>
        <div className="set-group">
          <div className="g-title">快捷键</div>
          <div className="set-row"><div className="lbl">Enter / Shift+Enter</div><div className="desc">发送 / 换行</div></div>
          <div className="set-row"><div className="lbl">⌘K / ⌘N / Esc</div><div className="desc">命令面板 / 新建任务 / 关闭浮层</div></div>
          <div className="set-row"><div className="lbl">⌘W</div><div className="desc">关闭窗口</div></div>
        </div>
        <div className="sheet-foot"><button className="btn btn-primary" onClick={() => h.setSettingsOpen(false)}>完成</button></div>
      </div>
    </div>
  );
}

/* ================= Toast ================= */
function Toasts({ h }: { h: Harness }) {
  return (
    <div id="toasts">
      {h.toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind}>
          <div className="t-txt"><b>{t.title}</b>{t.msg && <div style={{ opacity: 0.75 }}>{t.msg}</div>}</div>
        </div>
      ))}
    </div>
  );
}

/* ================= App ================= */
export default function App() {
  const h = useHarness();
  /* 窄窗口默认收起侧栏（宽屏默认展开） */
  const [sideOpen, setSideOpen] = useState(() => typeof window !== "undefined" && window.innerWidth > 920);

  useEffect(() => {
    if (isTauri) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        const w = getCurrentWindow();
        w.show();
        w.unminimize();
        w.setFocus();
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); h.setPaletteOpen(!h.paletteOpen); return; }
      if (h.paletteOpen) {
        if (e.key === "Escape") { h.setPaletteOpen(false); return; }
        return;
      }
      if (e.key === "Escape") { h.setSettingsOpen(false); h.closePreview(); return; }
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); h.newChat(); return; }
      if (e.isComposing) return;
      if (mod && e.key.toLowerCase() === "w") { e.preventDefault(); winAction("close"); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);

  return (
    <>
      <div id="window" className={sideOpen ? "app-on side-open" : "app-on"}>
        <TitleBar h={h} sideOpen={sideOpen} onToggleSide={() => setSideOpen((v) => !v)} />
        <div className="shell">
          <Sidebar h={h} />
          <ChatView h={h} />
          <PreviewPane h={h} />
        </div>
      </div>
      <CommandPalette h={h} />
      <SettingsModal h={h} />
      <Toasts h={h} />
    </>
  );
}