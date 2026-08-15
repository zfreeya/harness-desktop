import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

/* 全局错误可视化：任何渲染崩溃/未捕获异常都显示在屏幕上，而不是无声白屏 */
function showFatal(msg: string) {
  let el = document.getElementById("fatal-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal-overlay";
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div style="position:fixed;inset:0;background:#FDEBEC;display:flex;align-items:center;justify-content:center;z-index:99999;padding:40px;font-family:-apple-system,sans-serif">' +
    '<div style="max-width:560px;background:#fff;border:1px solid #F0C0C0;border-radius:12px;padding:24px 28px">' +
    '<div style="font-size:14px;font-weight:700;color:#9F2F2D;margin-bottom:10px">应用遇到错误</div>' +
    '<div id="fatal-msg" style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#9F2F2D;line-height:1.7;white-space:pre-wrap;word-break:break-all"></div>' +
    '<button onclick="location.reload()" style="margin-top:16px;background:#111;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer">重新加载</button>' +
    "</div></div>";
  document.getElementById("fatal-msg")!.textContent = msg;
}

window.addEventListener("error", (e) => {
  showFatal(`${e.message}\n@ ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showFatal("未处理的 Promise 拒绝: " + String(e.reason));
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) };
  }
  componentDidCatch(e: unknown) {
    showFatal(e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e));
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
