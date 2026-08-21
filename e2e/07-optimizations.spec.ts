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
    // 回复正常到达
    await expect(page.locator(".msg.agent .text").last()).toContainText(/收到|好|是|OK/i, { timeout: 90_000 });
  });

  test("停止按钮真实中断长任务", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请直接调用 bash 工具执行 sleep 25，不要先回复文字。");
    const start = Date.now();
    await page.locator(".send-btn").click();
    // 工具行出现（running）后立即停止
    await expect(page.locator(".tool-line")).toBeVisible({ timeout: 60_000 });
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
    // 初始：空闲
    await expect(page.locator(".thread-item .badge").first()).toHaveText("空闲");
    // 发一条消息等完成
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("回复 OK 两个字即可");
    await page.locator(".send-btn").click();
    // 执行中（thinking 期间徽章为执行中，不阻塞等待，直接等最终态）
    await expect(page.locator(".msg.agent .text").last()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".thread-item .badge").first()).toHaveText("已完成");
    // ⌘K 清空已完成 → 只剩一个新的空闲线程
    await page.keyboard.press("Meta+k");
    await page.locator(".palette-item", { hasText: "清空已完成对话" }).click();
    await expect(page.locator(".thread-item")).toHaveCount(1);
    await expect(page.locator(".thread-item .badge").first()).toHaveText("空闲");
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
    // 工具行出现且为错误态
    await expect(page.locator(".tool-line.err")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".toast.error")).toBeVisible({ timeout: 30_000 });
    // 模型看到工具错误后给出最终回复（页面无白屏）
    await expect(page.locator(".msg.agent .text").last()).toBeVisible({ timeout: 90_000 });
    expect(errors).toEqual([]);
  });
});