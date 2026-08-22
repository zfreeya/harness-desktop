import { test, expect } from "@playwright/test";

/**
 * 桌面端优化专项验证（真实链路）：
 * 1. 连续快速双击发送只产生一轮（同步竞态防护 busyRef）
 * 2. 停止按钮真实中断长任务（abort + 已停止消息 + 限时完成）
 * 3. 模型选择持久化（localStorage，刷新不丢）
 * 4. 线程状态徽章流转（空闲 → 执行中 → 已完成）+ 清空已完成真实生效
 * 5. 减弱动态效果持久化（document 类 + 开关状态）
 * 6. 工具服务不可达 → 工具行错误态 + 错误 toast + 无白屏
 */

test.describe("桌面端优化专项", () => {
  test.describe.configure({ retries: 1 });

  // 隔离：工具服务指向 playwright 自管 8451 实例
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

  test("连续快速双击发送只产生一轮对话（竞态防护）", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("只回复两个字：收到");
    // 同一 tick 内连点两次发送
    await page.locator(".send-btn").click();
    await page.locator(".send-btn").click({ force: true }).catch(() => undefined);
    // 用户气泡只有一条（第二条被同步拦截）
    await expect(page.locator(".msg.user")).toHaveCount(1);
    // 回复正常到达（不依赖模型措辞，只要求真实回复且非错误）
    await expect(page.locator(".msg.agent .text").last()).toBeVisible({ timeout: 90_000 });
    const body = await page.locator(".msg-col").innerText();
    expect(body).not.toContain("连接模型失败");
  });

  test("停止按钮真实中断长任务", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请直接调用 bash 工具执行 sleep 25，不要先回复文字。");
    const start = Date.now();
    await page.locator(".send-btn").click();
    // 工具组出现（running）后立即停止
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 60_000 });
    await page.locator(".send-btn.stop").click();
    // thinking 指示消失、出现「已停止」消息、且总耗时远小于 25s 的 sleep
    await expect(page.locator(".thinking")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator(".msg.agent .text").last()).toContainText("已停止", { timeout: 10_000 });
    expect(Date.now() - start).toBeLessThan(20_000);
  });

  test("模型选择持久化：刷新后仍生效", async ({ page }) => {
    await page.goto("/");
    await page.locator(".head-btn").last().click(); // 设置
    await page.locator("#setModel").selectOption("deepseek-v4-flash");
    await page.locator(".sheet-foot .btn-primary").click();
    await page.reload();
    await page.locator(".head-btn").last().click();
    await expect(page.locator("#setModel")).toHaveValue("deepseek-v4-flash");
  });

  test("线程状态徽章流转与清空已完成", async ({ page }) => {
    await page.goto("/");
    // 初始：等待用户输入（状态点）
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "waiting_for_input");
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待用户输入");
    // 生成网页 → 等待验收
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 status-demo.html，内容为 <h1>状态流转</h1>");
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "waiting_for_review");
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待验收");
    // 确认完成（主操作）→ 用户已确认
    await page.locator(".dc-actions .btn-primary").click();
    await expect(page.locator(".win-titlebar .badge")).toHaveText("用户已确认");
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "completed");
    // ⌘K 清空已确认 → 只剩一个新的等待用户输入线程
    await page.keyboard.press("Meta+k");
    await page.locator(".palette-item", { hasText: "清空已确认任务" }).click();
    await expect(page.locator(".thread-item")).toHaveCount(1);
    await expect(page.locator(".thread-item .tstatus").first()).toHaveAttribute("data-status", "waiting_for_input");
  });

  test("减弱动态效果持久化", async ({ page }) => {
    await page.goto("/");
    await page.locator(".head-btn").last().click();
    await page.locator(".set-group", { hasText: "外观" }).locator(".switch").click();
    await expect(page.evaluate(() => document.documentElement.classList.contains("reduce-motion"))).resolves.toBe(true);
    await page.reload();
    await expect(page.evaluate(() => document.documentElement.classList.contains("reduce-motion"))).resolves.toBe(true);
    await page.locator(".head-btn").last().click();
    await expect(page.locator(".set-group", { hasText: "外观" }).locator(".switch input")).toBeChecked();
  });

  test("工具服务不可达：工具行错误态 + 错误 toast + 无白屏", async ({ page }) => {
    // 覆盖隔离配置：指向不存在的端口
    await page.addInitScript(() => {
      try { localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8452" })); } catch { /* ignore */ }
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请先调用 bash 工具执行 echo hi，再把工具的真实输出告诉我，不要直接回答。");
    await page.locator(".send-btn").click();
    // 工具组出现且为错误强调态（无需展开即可见）
    await expect(page.locator(".tool-group.err")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".toast.error")).toBeVisible({ timeout: 30_000 });
    // 模型看到工具错误后给出最终回复（页面无白屏）
    await expect(page.locator(".msg.agent .text").last()).toBeVisible({ timeout: 90_000 });
    expect(errors).toEqual([]);
  });
});