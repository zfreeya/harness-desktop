import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 真实 Agent 工具流（对齐 deepseek-harness 关键能力）：
 * 模型自主调用 bash/写文件等真实工具（经 tools-server :8450），再汇报真实结果。
 * 依赖：MemoryProxy :8096 / MemoryCore :8420 / tools-server :8450（playwright webServer 自动拉起）。
 */
const WS = path.resolve("workspace");

test.describe("真实 Agent 工具流", () => {
  test.describe.configure({ retries: 1 });

  test("简单问题直接回答，不追问不弹选项", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("2+2 等于几？直接回答我");
    await page.locator(".send-btn").click();

    const reply = page.locator(".msg.agent .text").last();
    await expect(reply).toContainText(/4/, { timeout: 90_000 });
    // 不出现选项 chips / 计划卡
    await expect(page.locator(".chip")).toHaveCount(0);
    await expect(page.locator(".plan-card")).toHaveCount(0);
  });

  test("Agent 真实调用 bash 工具并汇报输出", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 bash 工具执行 echo agent-tool-ok，并把真实输出告诉我");
    await page.locator(".send-btn").click();

    // 工具执行行出现（运行中 → 完成）
    await expect(page.locator(".tool-line")).toBeVisible({ timeout: 90_000 });
    // 真实工具事件：bash + 输出含 agent-tool-ok
    await expect
      .poll(async () => page.evaluate(() => (window as any).__toolEvents?.length ?? 0), { timeout: 90_000 })
      .toBeGreaterThan(0);
    const ev = await page.evaluate(() => (window as any).__toolEvents[0]);
    expect(ev.name).toBe("bash");
    expect(ev.result).toContain("agent-tool-ok");
    // 最终回复引用真实输出（软断言：模型措辞允许差异）
    await expect(page.locator(".msg.agent .text").last()).toContainText(/agent-tool-ok|echo/, { timeout: 90_000 });
  });

  test("Agent 真实写文件，文件内容外部可验证", async ({ page }) => {
    const p = path.join(WS, "agent-hello.txt");
    try { fs.unlinkSync(p); } catch { /* 首次运行不存在 */ }

    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 write 工具创建文件 agent-hello.txt，内容为：harness-e2e-写入成功");
    await page.locator(".send-btn").click();

    // 外部（测试进程）验证文件真实落盘
    await expect.poll(() => fs.existsSync(p), { timeout: 120_000 }).toBe(true);
    const txt = fs.readFileSync(p, "utf8");
    expect(txt).toContain("harness-e2e");
    // UI 上有 write 工具行
    await expect(page.locator(".tool-line").first()).toBeVisible({ timeout: 60_000 });
  });

  test("会话持久化：刷新页面后对话不丢", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("记住这句话：持久化测试消息七彩虹");
    await page.locator(".send-btn").click();
    await expect(page.locator(".msg.agent .text").last()).toBeVisible({ timeout: 90_000 });

    await page.reload();
    await expect(page.locator(".msg.user .bubble").last()).toContainText("持久化测试消息七彩虹");
  });
});
