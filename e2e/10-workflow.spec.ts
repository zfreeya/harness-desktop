import { test, expect } from "@playwright/test";

/**
 * 任务管理—执行过程—成果交付—用户验收 闭环验证：
 * 1. 执行中（长任务运行期间状态为执行中）
 * 2. 等待验收 + 任务标题由交付物派生（侧栏/顶栏同一数据源）
 * 3. 预览失败：文件被删除后不再显示「运行中」，给出重新启动
 * 4. 用户已确认：确认完成后状态流转，chip 消失
 * 5. 验收动作：继续修改聚焦输入框并提供上下文占位
 * 6. 工具执行耗时：摘要包含「耗时 N 秒」
 */
test.describe("任务闭环", () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

  test("执行中：长任务运行期间显示执行中", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 bash 工具执行 sleep 10，然后回复完成");
    await page.locator(".send-btn").click();
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".win-titlebar .badge")).toHaveText("执行中");
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "working");
    // 等自然结束，状态回到等待用户输入
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待用户输入", { timeout: 90_000 });
  });

  test("等待验收 + 标题由交付物派生（侧栏/顶栏一致）", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 workflow-title.html，内容为 <h1>标题验证</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    // 状态：等待验收
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待验收");
    // 标题：由交付物派生，侧栏与顶栏完全一致
    const tb = await page.locator(".task-title").innerText();
    const sb = await page.locator(".thread-item .tt").first().innerText();
    expect(tb).toBe("workflow-title 预览");
    expect(sb).toBe(tb);
    // 摘要区展示成果与预览状态
    await expect(page.locator(".task-summary")).toContainText("workflow-title.html");
    await expect(page.locator(".task-summary")).toContainText("运行中");
  });

  test("预览失败：文件被删除后不再显示运行中，提供重新启动", async ({ page, request }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 fail-demo.html，内容为 <h1>失效验证</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".dc-status")).toContainText("运行中");
    // 真实删除文件（模拟服务失效）
    const rm = await request.post("http://127.0.0.1:8451/bash", { data: { command: "rm -f fail-demo.html" } });
    expect(rm.ok()).toBeTruthy();
    // 打开预览 → 真实探测失败
    await page.locator(".dc-actions .btn-primary").click();
    await expect(page.locator(".deliverable-card")).toHaveClass(/dl-failed/, { timeout: 30_000 });
    await expect(page.locator(".dc-status")).toContainText("预览已停止");
    // 主按钮变为「重新启动」
    await expect(page.locator(".dc-actions .btn-primary")).toContainText("重新启动");
  });

  test("用户已确认：确认完成后状态流转，chip 消失", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 confirm-demo.html，内容为 <h1>确认验证</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".accept-chip.primary")).toContainText("确认完成");
    await page.locator(".accept-chip.primary").click();
    await expect(page.locator(".win-titlebar .badge")).toHaveText("用户已确认");
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "confirmed");
    await expect(page.locator(".accept-chip.primary")).toHaveCount(0);
  });

  test("验收动作：继续修改聚焦输入框并提供上下文占位", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 action-demo.html，内容为 <h1>动作验证</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    // 上下文动作（网页应用类）：优化视觉 / 最高分 / 音效 / 移动端
    await expect(page.locator(".accept-chip", { hasText: "优化游戏视觉" })).toBeVisible();
    await expect(page.locator(".accept-chip", { hasText: "添加最高分记录" })).toBeVisible();
    await page.locator(".accept-chip", { hasText: "继续修改" }).click();
    await expect(page.locator("#chatInput")).toBeFocused();
    await expect(page.locator("#chatInput")).toHaveAttribute("placeholder", /继续修改/);
  });

  test("工具执行摘要包含耗时", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 bash 工具执行 echo timing-ok，并告诉我结果");
    await page.locator(".send-btn").click();
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".tool-summary")).toContainText(/耗时 \d+ 秒/);
  });
});
