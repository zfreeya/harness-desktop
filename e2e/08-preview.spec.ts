import { test, expect } from "@playwright/test";

/**
 * 工作目录预览（harness.local）：
 * 1. tools-server /preview 端点真实服务工作目录文件（含越界拒绝）
 * 2. Agent 用 write 工具写出 .html 后：预览面板自动打开、出现工作目录标签、
 *    iframe 指向 /preview/ 并真实渲染文件内容
 */

test.describe("工作目录预览（harness.local）", () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

  test("/preview 端点真实服务工作目录文件，越界拒绝", async ({ request }) => {
    const w = await request.post("http://127.0.0.1:8451/write", {
      data: { path: "preview-test.html", content: "<!DOCTYPE html><html><body><h1 id=\"pv\">预览端点OK</h1></body></html>" },
    });
    expect(w.ok()).toBeTruthy();
    const res = await request.get("http://127.0.0.1:8451/preview/preview-test.html");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(await res.text()).toContain("预览端点OK");
    // 越界路径拒绝
    const esc = await request.get("http://127.0.0.1:8451/preview/../../etc/passwd");
    expect(esc.status()).toBe(404);
  });

  test("Agent 写 HTML 后自动打开预览面板并渲染文件", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "请用 write 工具创建文件 preview-game.html，内容是一个最小网页：<!DOCTYPE html><html><body><h1 id=\"pv\">预览成功</h1></body></html>");
    await page.locator(".send-btn").click();

    // 面板自动打开 + 工作目录标签出现
    await expect(page.locator("#previewPane")).toHaveClass(/open/, { timeout: 90_000 });
    await expect(page.locator(".btab", { hasText: "preview-game.html" })).toBeVisible({ timeout: 90_000 });
    // 地址栏显示 harness.local/preview/...
    await expect(page.locator(".address-bar .addr")).toContainText("/preview/preview-game.html");
    // iframe 真实渲染工作目录文件
    const frame = page.frameLocator("#previewFrame");
    await expect(frame.locator("#pv")).toHaveText("预览成功", { timeout: 60_000 });
    expect(errors).toEqual([]);
  });
});

