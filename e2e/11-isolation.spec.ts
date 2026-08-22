import { test, expect } from "@playwright/test";

/**
 * 跨任务上下文隔离：两个不同任务（游戏 vs Markdown 页面）反复切换，
 * 标题、推荐操作、预览标签、状态、成果互不污染。
 */
test.describe("任务隔离", () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

  test("游戏任务与 Markdown 任务反复切换，全部上下文隔离", async ({ page }) => {
    await page.goto("/");

    // ===== 任务 1：俄罗斯方块（游戏） =====
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 tetris.html，内容为 <h1>俄罗斯方块</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".task-title")).toHaveText("tetris 预览");
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待验收");
    await expect(page.locator(".accept-chip", { hasText: "优化游戏视觉" })).toBeVisible();
    await expect(page.locator(".btab", { hasText: "tetris.html" })).toBeVisible();

    // ===== 任务 2：Markdown 演示页（新建任务，上下文必须全新） =====
    await page.keyboard.press("Meta+n");
    await expect(page.locator(".task-title")).toHaveText("新任务");
    await expect(page.locator(".deliverable-card")).toHaveCount(0);
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 demo-preview.html，内容为 <h1>Markdown 演示</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".task-title")).toHaveText("demo-preview 预览");
    // 隔离：任务 2 不得出现游戏建议 / 任务 1 的标签
    await expect(page.locator(".accept-chip", { hasText: "优化游戏视觉" })).toHaveCount(0);
    await expect(page.locator(".accept-chip", { hasText: "美化页面" })).toBeVisible();
    await expect(page.locator(".btab", { hasText: "tetris.html" })).toHaveCount(0);
    await expect(page.locator(".btab", { hasText: "demo-preview.html" })).toBeVisible();

    // ===== 切回任务 1 =====
    await page.locator(".thread-item").nth(1).click();
    await expect(page.locator(".task-title")).toHaveText("tetris 预览");
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待验收");
    await expect(page.locator(".accept-chip", { hasText: "优化游戏视觉" })).toBeVisible();
    await expect(page.locator(".accept-chip", { hasText: "美化页面" })).toHaveCount(0);
    await expect(page.locator(".btab", { hasText: "tetris.html" })).toBeVisible();
    await expect(page.locator(".btab", { hasText: "demo-preview.html" })).toHaveCount(0);
    await expect(page.locator(".deliverable-card .dc-title")).toContainText("tetris");

    // ===== 切回任务 2 =====
    await page.locator(".thread-item").nth(0).click();
    await expect(page.locator(".task-title")).toHaveText("demo-preview 预览");
    await expect(page.locator(".accept-chip", { hasText: "优化游戏视觉" })).toHaveCount(0);
    await expect(page.locator(".btab", { hasText: "demo-preview.html" })).toBeVisible();
    await expect(page.locator(".btab", { hasText: "tetris.html" })).toHaveCount(0);
    await expect(page.locator(".deliverable-card .dc-title")).toContainText("demo-preview");
  });

  test("停止 Agent 不影响预览：预览保持在线", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 stop-preview.html，内容为 <h1>停止验证</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".dc-status")).toContainText("预览在线");
    // 发起长任务并停止
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 bash 工具执行 sleep 15，然后回复完成");
    await page.locator(".send-btn").click();
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 90_000 });
    await page.locator(".send-btn.stop").click();
    await expect(page.locator(".win-titlebar .badge")).toHaveText("已取消", { timeout: 20_000 });
    // 预览未被停止（停止 Agent 不触碰预览服务）
    await expect(page.locator(".dc-status")).toContainText("预览在线");
    await expect(page.locator(".dc-actions .btn-primary")).toContainText("确认完成");
  });
});