import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * 链接：Tauri 内用系统浏览器打开（避免 webview 内导航），浏览器环境新标签打开。
 * react-markdown 默认转义原始 HTML（防 XSS），只有显式声明的组件才渲染。
 */
function A({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (!href) return <a>{children}</a>;
  if (isTauri) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(href).catch(() => undefined));
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** Agent 回复的 Markdown 渲染（GFM：表格/删除线/任务列表） */
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: A }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
