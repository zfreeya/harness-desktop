import { test, expect } from "@playwright/test";

/**
 * 真实对话链路：真实键盘输入 → 真实 DeepSeek 模型（经 MemoryProxy）→ 真实回复渲染。
 * 依赖本机常驻服务：MemoryProxy :8096 / MemoryCore :8420。
 * 协议探针（[OPTIONS]/[PLAN]）依赖模型遵守格式，偶发不遵守 → 重试一次。
 */
test.describe("真实对话（LLM）", () => {
  test.describe.configure({ retries: 1 });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });
  test("输入需求后收到真实模型回复", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await expect(page.locator("#window")).toHaveClass(/app-on/);

    // 真实键盘输入（含中文）
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("帮我做一个官网首页", { delay: 30 });
    // 断言输入值确实进入（受控组件）
    await expect(page.locator("#chatInput")).toHaveValue("帮我做一个官网首页");

    // 点击发送
    await page.locator(".send-btn").click();

    // 用户气泡出现
    await expect(page.locator(".msg.user .bubble")).toContainText("帮我做一个官网首页");

    // 等待真实回复（模型 5~30 秒）：agent 文本消息数量必须增加（排除问候语/工具行误判）
    const before = await page.locator(".msg.agent .text").count();
    await expect
      .poll(async () => page.locator(".msg.agent .text").count(), { timeout: 90_000 })
      .toBeGreaterThan(before);

    const reply = page.locator(".msg.agent .text, .msg.agent .chips, .msg.agent .plan-card").last();
    await expect(reply).toBeVisible();

    const bodyText = await page.locator(".msg-col").innerText();
    expect(bodyText.length).toBeGreaterThan(10);
    // 不是错误提示
    expect(bodyText).not.toContain("连接模型失败");
    expect(errors).toEqual([]);
  });

  test("协议解析：要求模型输出选项时渲染出 chips", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "请严格遵守你的协议：现在立刻给我出三个风格选项，格式必须是 [OPTIONS: 暖白极简 | 深色终端 | 跟随现有品牌]"
    );
    await page.locator(".send-btn").click();

    const chips = page.locator(".chip");
    try {
      await expect(chips.first()).toBeVisible({ timeout: 60_000 });
    } catch {
      // 模型偶发未遵守格式：追加一轮强制提示
      await page.locator("#chatInput").click();
      await page.locator("#chatInput").type("请务必严格按格式输出：最后一行必须是 [OPTIONS: A | B | C]");
      await page.locator(".send-btn").click();
      await expect(chips.first()).toBeVisible({ timeout: 90_000 });
    }
    expect(await chips.count()).toBeGreaterThanOrEqual(2);

    // 点击第一个 chip → 作为用户消息发出
    const firstChip = await chips.first().innerText();
    await chips.first().click();
    await expect(page.locator(".msg.user .bubble").last()).toContainText(firstChip.trim());
  });

  test("协议解析：要求模型输出计划时渲染计划卡并可开始执行", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "我的需求已经清楚：做一个暖白极简风格的官网首页，只做最小版本。请严格按协议直接输出计划：[PLAN] 开头，逐条列出，结尾问确认。"
    );
    await page.locator(".send-btn").click();

    const planCard = page.locator(".plan-card");
    try {
      await expect(planCard).toBeVisible({ timeout: 60_000 });
    } catch {
      // 模型偶发未遵守格式：追加一轮强制提示（与 OPTIONS 用例同机制）
      await page.locator("#chatInput").click();
      await page.locator("#chatInput").type("请务必严格按格式输出：回复必须以 [PLAN] 开头，然后每行一条计划项");
      await page.locator(".send-btn").click();
      await expect(planCard).toBeVisible({ timeout: 90_000 });
    }
    await expect(planCard.locator(".pt")).toHaveText("计划");
    await expect(planCard.locator(".pi").first()).toBeVisible();

    // 点「开始执行」→ 真实发出下一轮
    await page.locator(".plan-card .btn-primary").click();
    await expect(page.locator(".msg.user .bubble").last()).toContainText("开始执行");
    // 等待模型继续回复
    await expect(page.locator(".msg.agent").last()).toBeVisible({ timeout: 90_000 });
  });
});