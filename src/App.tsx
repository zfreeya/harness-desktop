import { useEffect, useRef, useState } from "react";
import { useHarness, Harness } from "./harness";
import { statusBadge } from "./state";

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
  mark: (
    <img src="/icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.3-.5.5 3.3L21 9.6l-1.8 2.8 1.8 2.8-2.8 1.8-.5 3.3-3.3-.5L12 22l-2.4-2.4-3.3.5-.5-3.3L3 15.2l1.8-2.8L3 9.6l2.8-1.8.5-3.3 3.3.5z" /><circle cx="12" cy="11" r="3.2" fill="#fff" /></svg>
  ),
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
  send: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>),
  clip: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>),
  reload: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>),
  lock: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  doc: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>),
};

/* ================= 开机 ================= */
function Boot({ done }: { done: boolean }) {
  return (
    <div id="boot" className={done ? "done" : ""}>
      <div className="mark">{Ic.mark}</div>
      <div className="name">DeepSeek Harness</div>
      <div className="bar"><i /></div>
    </div>
  );
}

/* ================= 欢迎 ================= */
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div id="welcome" className="show">
      <div className="wel-wrap">
        <div className="wel-mark">{Ic.mark}</div>
        <h1>描述模糊没关系，它会问到清楚</h1>
        <p className="sub">只需要一个对话框。说出你想要的，Agent 会一个一个地问清楚，确认计划后才动手，安静地做完，再把结果交给你。</p>
        <div className="bento">
          <div className="b-cell b-main">
            <div className="bt">一直询问，不猜你的意思</div>
            <div className="bd">一次只问一个问题，给选项让你点。问到意图清楚为止，最多三轮，然后给计划。</div>
          </div>
          <div className="b-cell b-tint"><div className="bt">计划先行</div><div className="bd">动手前先给计划，你点头才开始</div></div>
          <div className="b-cell b-mono"><span>$ clarify</span><span>$ plan</span><span>$ execute</span></div>
          <div className="b-cell"><div className="bt">执行静默</div><div className="bd">细节收在「查看详情」里</div></div>
          <div className="b-cell"><div className="bt">预览按需</div><div className="bd">完成后一键打开，看完即关</div></div>
        </div>
        <button className="btn btn-primary" onClick={onStart}>开始对话</button>
      </div>
    </div>
  );
}

/* ================= 标题栏 ================= */
function TitleBar({ h }: { h: Harness }) {
  const busy = h.cur.thinking;
  const label = h.cur.thinking ? "harness-agent 思考中" : "harness-agent 在线";
  const dot = h.cur.thinking ? "working" : "idle";
  return (
    <div className="win-titlebar" data-tauri-drag-region>
      <div className="traffic">
        <span className="t" onClick={() => winAction("close")} title="关闭"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" /></svg></span>
        <span className="t" onClick={() => winAction("minimize")} title="最小化"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 5h5" /></svg></span>
        <span className="t" onClick={() => winAction("maximize")} title="全屏"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 3h4v4H3z" /></svg></span>
      </div>
      <div className="win-title">DeepSeek Harness</div>
      <div className="win-right">
        <span className="pill"><span className={`pdot ${dot}`} /><span>{label}</span></span>
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
      <button className="btn btn-primary btn-new-chat" onClick={h.newChat}>{Ic.plus}新对话</button>
      <div className="side-search">
        <div className="search-input" onClick={() => h.setPaletteOpen(true)}>
          {Ic.search}
          <input placeholder="搜索对话" readOnly />
          <span className="kbd">⌘K</span>
        </div>
      </div>
      <div className="side-label">对话</div>
      <div className="thread-list">
        {h.threads.map((t) => {
          const b = statusBadge(t.status);
          return (
            <div key={t.id} className={`thread-item${t.id === h.current ? " on" : ""}`} onClick={() => h.setCurrent(t.id)}>
              <div className="tt">{t.title}</div>
              <div className="tm"><span className={`badge ${b.cls}`}>{b.label}</span><span className="tst">{t.id}</span></div>
            </div>
          );
        })}
      </div>
      <div className="side-agent">
        <div className="agent-row">
          <div className={`agent-orb${h.cur.thinking ? " busy" : ""}`}>{Ic.spark}</div>
          <div className="meta">
            <div className="who">harness-agent<span className="live-dot" title="在线" /></div>
            <div className="state">{h.cur.thinking ? "思考中" : "在线，等你开口"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ================= 消息行 ================= */
function AgentHead() {
  return (
    <div className="a-head">
      <span className="a-mark">{Ic.spark}</span>
      <span className="a-name">harness-agent</span>
      <span className="a-time">{new Date().toTimeString().slice(0, 5)}</span>
    </div>
  );
}

function MsgRow({ m, h, mi }: { m: import("./state").Msg; h: Harness; mi: number }) {
  if (m.role === "user") {
    return <div className="msg user"><div className="bubble">{m.chip ?? m.text}</div></div>;
  }
  if (m.kind === "ask") {
    const opts = m.opts ?? [];
    return (
      <div className="msg agent">
        <AgentHead />
        <div className="text">{m.text}</div>
        {opts.length > 0 && (
          <div className="chips">
            {opts.map((o, i) => (
              <button
                key={i}
                className={`chip${m.picked === i ? " picked" : ""}${m.picked !== undefined && m.picked !== i ? " gone" : ""}`}
                disabled={m.picked !== undefined}
                onClick={() => h.pickChip(mi, i)}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (m.kind === "recall") {
    return (
      <div className="msg agent">
        <AgentHead />
        <div className="text">{m.text}</div>
        <div className="mem-block">
          <div className="mem-label">来自记忆 · L1/L2 召回</div>
          {(m.atoms ?? []).map((a, i) => (
            <div className="mem-atom" key={i}>{a}</div>
          ))}
        </div>
      </div>
    );
  }
  if (m.kind === "plan") {
    const items = m.items ?? [];
    return (
      <div className="msg agent">
        <AgentHead />
        <div className="text">{m.text}</div>
        {items.length > 0 && (
          <div className="plan-card">
            <div className="pt">计划</div>
            {items.map((it, i) => (
              <div className="pi" key={i}><b>{i + 1}</b><span>{it}</span></div>
            ))}
            <div className="pa">
              <button className="btn btn-primary btn-sm" onClick={h.confirmPlan}>开始执行</button>
              <button className="btn btn-ghost btn-sm" onClick={h.reconsiderPlan}>改一改</button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return <div className="msg agent"><AgentHead /><div className="text">{m.text}</div></div>;
}

/* ================= 对话区 ================= */
function ChatView({ h }: { h: Harness }) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [h.cur.msgs.length, h.cur.thinking]);
  const send = () => { h.sendMessage(text); setText(""); };
  const b = statusBadge(h.cur.status);
  return (
    <main className="chat">
      <div className="chat-head">
        <span className="cht">{h.cur.title}</span>
        <span className={`badge ${b.cls}`}>{b.label}</span>
        <span style={{ flex: 1 }} />
        <button className="head-btn" onClick={h.togglePreview} title="预览">{Ic.monitor}</button>
        <button className="head-btn" onClick={() => h.setSettingsOpen(true)} title="设置">{Ic.gear}</button>
      </div>
      <div className="msg-scroll" ref={scrollRef}>
        <div className="msg-col">
          {h.cur.msgs.map((m, i) => <MsgRow key={m.id} m={m} h={h} mi={i} />)}
          {h.cur.thinking && (
            <div className="msg agent">
              <div className="a-head">
                <span className="a-mark">{Ic.spark}</span>
                <span className="a-name">harness-agent</span>
              </div>
              <div className="thinking"><span className="tt">正在思考</span><i /><i /><i /></div>
            </div>
          )}
        </div>
      </div>
      <div className="input-bar">
        <div className="input-row">
          <button className="tool-btn" title="附件" onClick={() => h.push("info", "附件", "将打开文件选择器")}>{Ic.clip}</button>
          <textarea
            id="chatInput"
            rows={1}
            placeholder="描述你想做的事，模糊也没关系…"
            value={text}
            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <button className="send-btn" onClick={send} title="发送">{Ic.send}</button>
        </div>
        <div className="input-hint">
          <span className="mono">Enter</span> 发送 <span className="mono">Shift+Enter</span> 换行
          <span className="mono" style={{ marginLeft: "auto" }}>⌘K 命令</span>
        </div>
      </div>
    </main>
  );
}

/* ================= 右侧预览面板 ================= */
function PreviewPane({ h }: { h: Harness }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (h.previewOpen && !loaded) setLoaded(true);
  }, [h.previewOpen, loaded]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const spin = () => {
    const btn = document.getElementById("reloadBtn");
    if (!btn) return;
    btn.classList.remove("reload-spin"); void (btn as HTMLElement).offsetWidth; btn.classList.add("reload-spin");
  };
  return (
    <aside id="previewPane" className={`preview-pane${h.previewOpen ? " open" : ""}`}>
      <div className="pv-inner">
        <div className="pv-head">
          <span className="t">预览</span>
          <span className="pill mono">{h.PREVIEW_PAGES[h.previewTab].host}</span>
          <button className="pv-close" onClick={h.closePreview} title="收起">{Ic.chevR}</button>
        </div>
        <div className="browser-bar">
          <div className="tabs-row">
            {h.PREVIEW_PAGES.map((p, i) => (
              <div key={i} className={`btab${h.previewTab === i ? " on" : ""}`} onClick={() => h.setPreviewTab(i)}>
                <span className="bdot" />{p.name}
              </div>
            ))}
          </div>
          <div className="addr-row">
            <div className="nav-btns">
              <button className="abtn" disabled title="后退">←</button>
              <button className="abtn" disabled title="前进">→</button>
              <button className="abtn" id="reloadBtn" onClick={() => { spin(); h.reloadPreview(); }} title="刷新">{Ic.reload}</button>
            </div>
            <div className="address-bar">{Ic.lock}<span className="addr">{h.PREVIEW_PAGES[h.previewTab].host}</span></div>
            <div className="dev-switch" id="devSwitch">
              <button className={h.device === "desktop" ? "on" : ""} onClick={() => h.setDevice("desktop")} title="桌面">{Ic.monitor}</button>
              <button className={h.device === "tablet" ? "on" : ""} onClick={() => h.setDevice("tablet")} title="平板">{Ic.tablet}</button>
              <button className={h.device === "mobile" ? "on" : ""} onClick={() => h.setDevice("mobile")} title="手机">{Ic.phone}</button>
            </div>
          </div>
        </div>
        <div className="preview-stage">
          {loaded && (
            <iframe ref={frameRef} id="previewFrame" className={`dev-${h.device}`} title="预览" src={h.PREVIEW_PAGES[h.previewTab].url} />
          )}
        </div>
      </div>
    </aside>
  );
}

/* ================= 命令面板 ================= */
const PALETTE = [
  { name: "新对话", hint: "⌘N", icon: Ic.plus, run: (h: Harness) => { h.setPaletteOpen(false); h.newChat(); } },
  { name: "打开预览", hint: "", icon: Ic.monitor, run: (h: Harness) => { h.setPaletteOpen(false); h.openPreview(); } },
  { name: "打开设置", hint: "", icon: Ic.gear, run: (h: Harness) => { h.setPaletteOpen(false); h.setSettingsOpen(true); } },
  { name: "清空已完成对话", hint: "", icon: Ic.x, run: (h: Harness) => { h.setPaletteOpen(false); h.clearDone(); } },
  { name: "查看视觉规范 DESIGN.md", hint: "", icon: Ic.doc, run: (h: Harness) => { h.setPaletteOpen(false); h.push("info", "DESIGN.md", "视觉规范已 lint 0 错误 0 警告"); } },
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
            <div
              key={c.name}
              className={`palette-item${i === cur ? " sel" : ""}`}
              onMouseMove={() => setSel(i)}
              onClick={() => c.run(h)}
            >
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
            <label className="switch"><input type="checkbox" onChange={(e) => document.documentElement.classList.toggle("reduce-motion", e.target.checked)} /><span className="track" /><span className="knob" /></label>
          </div>
        </div>
        <div className="set-group">
          <div className="g-title">快捷键</div>
          <div className="set-row"><div className="lbl">Enter / Shift+Enter</div><div className="desc">发送 / 换行</div></div>
          <div className="set-row"><div className="lbl">⌘K / ⌘N / Esc</div><div className="desc">命令面板 / 新对话 / 关闭浮层</div></div>
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
        <div key={t.id} className="toast">
          <div className="t-txt"><b>{t.title}</b>{t.msg && <div style={{ opacity: 0.75 }}>{t.msg}</div>}</div>
        </div>
      ))}
    </div>
  );
}

/* ================= App（修复 StrictMode 种子数据后重载） ================= */
export default function App() {
  const h = useHarness();
  const [phase, setPhase] = useState<"app">("app"); // 启动直进主界面，无欢迎页

  /* 启动直进主界面，无欢迎页 */
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

  /* 自动化冒烟测试：?autotest=1 发一条真实消息（走真实 LLM + 记忆） */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autotest")) return;
    const t = setTimeout(() => {
      const ta = document.querySelector("textarea") as HTMLTextAreaElement | null;
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(ta, "帮我做一个官网首页");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.querySelector<HTMLButtonElement>(".send-btn")?.click();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div id="window" className={phase === "app" ? "app-on" : ""}>
        <TitleBar h={h} />
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
