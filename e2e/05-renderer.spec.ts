import { test, expect } from "@playwright/test";

/**
 * 确定性 UI 渲染测试：通过 ?e2e=1 注入消息，验证 chips / plan / recall 三类
 * 渲染与交互（真实模型链路由 02-chat 覆盖，这里只测渲染器）。
 */
test.describe("消息渲染器（确定性注入）", () => {
  test("ask 消息渲染 chips 且点击发出", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.waitForSelector("#window.app-on");
    await page.evaluate(() => {
      (window as any).__e2eInject({ role: "agent", kind: "ask", text: "风格倾向哪种？", opts: ["暖白极简", "深色终端", "跟随现有品牌"] });
    });
    const chips = page.locator(".chip");
    await expect(chips).toHaveCount(3);
    await chips.nth(1).click();
    await expect(page.locator(".msg.user .bubble").last()).toContainText("深色终端");
    // 选中态
    await expect(chips.nth(1)).toHaveClass(/picked/);
  });

  test("plan 消息渲染计划卡并可开始执行", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.waitForSelector("#window.app-on");
    await page.evaluate(() => {
      (window as any).__e2eInject({ role: "agent", kind: "plan", text: "我的计划：", items: ["搭建页面骨架", "套用暖单色设计令牌", "本地预览并交付"] });
    });
    await expect(page.locator(".plan-card")).toBeVisible();
    await expect(page.locator(".plan-card .pi")).toHaveCount(3);
    await expect(page.locator(".plan-card .btn-primary")).toHaveText("开始执行");
    await expect(page.locator(".plan-card .btn-ghost")).toHaveText("改一改");
  });

  test("recall 消息渲染记忆块", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.waitForSelector("#window.app-on");
    await page.evaluate(() => {
      (window as any).__e2eInject({ role: "agent", kind: "recall", text: "我先从记忆里恢复了你的偏好：", atoms: ["视觉上偏好暖白极简风格", "坚持先做最小版本"] });
    });
    await expect(page.locator(".mem-block")).toBeVisible();
    await expect(page.locator(".mem-block .mem-atom")).toHaveCount(2);
    await expect(page.locator(".mem-block .mem-label")).toContainText("来自记忆");
  });

  test("Agent 回复按 Markdown 渲染（列表/加粗/代码/表格）且安全转义", async ({ page }) => {
    await page.goto("/?e2e=1");
    const md = [
      "# 标题一",
      "",
      "- 要点A",
      "- 要点B",
      "",
      "**加粗** 与 `行内代码`",
      "",
      "```js",
      "console.log(1);",
      "```",
      "",
      "| 列1 | 列2 |",
      "|---|---|",
      "| a | b |",
      "",
      "[链接](https://example.com)",
      "",
      "<img src=x onerror=window.__xss=1>",
    ].join("\n");
    await page.evaluate((text) => (window as any).__e2eInject({ role: "agent", kind: "text", text }), md);

    await expect(page.locator(".md h1")).toHaveText("标题一");
    await expect(page.locator(".md ul li")).toHaveCount(2);
    await expect(page.locator(".md strong")).toHaveText("加粗");
    await expect(page.locator(".md code").first()).toHaveText("行内代码");
    await expect(page.locator(".md pre code")).toContainText("console.log(1)");
    await expect(page.locator(".md table th").first()).toHaveText("列1");
    await expect(page.locator(".md a")).toHaveText("链接");
    // XSS 安全：原始 HTML 被转义为文本，不产生 img 元素、不执行脚本
    await expect(page.locator(".md img")).toHaveCount(0);
    const xss = await page.evaluate(() => (window as any).__xss);
    expect(xss).toBeUndefined();
  });

  test("模型回复错误时显示错误信息而非白屏", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.waitForSelector("#window.app-on");
    await page.evaluate(() => {
      (window as any).__e2eInject({ role: "agent", kind: "text", text: "连接模型失败：HTTP 500（测试注入）" });
    });
    await expect(page.locator(".msg.agent .text").last()).toContainText("连接模型失败");
  });
});