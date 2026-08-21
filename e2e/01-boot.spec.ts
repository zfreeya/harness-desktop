import { test, expect } from "@playwright/test";

test.describe("启动与外壳", () => {
  test("窗口主界面完整渲染，无控制台错误", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/");
    // 直进主界面（无欢迎页）
    await expect(page.locator("#window")).toHaveClass(/app-on/);
    // 侧栏品牌行
    await expect(page.locator(".side-brand .sb-name")).toHaveText("Harness");
    // 新对话按钮
    await expect(page.locator(".btn-new-chat")).toBeVisible();
    // 初始线程（greeting 消息）
    await expect(page.locator(".thread-item")).toHaveCount(1);
    await expect(page.locator(".msg.agent .text").first()).toContainText("想做什么");
    // 输入框与发送键
    await expect(page.locator("#chatInput")).toBeVisible();
    await expect(page.locator(".send-btn")).toBeVisible();
    // 连接状态（唯一位置：侧栏底部）
    await expect(page.locator(".side-conn")).toContainText("在线");
    expect(errors).toEqual([]);
  });
});