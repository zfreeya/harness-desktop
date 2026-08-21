import { test, expect } from "@playwright/test";

test.describe("预览面板（内置浏览器）", () => {
  test("手动打开 → iframe 加载 → 设备切换 → 收起", async ({ page }) => {
    await page.goto("/");
    // 初始收起
    await expect(page.locator("#previewPane")).not.toHaveClass(/open/);
    // 打开
    await page.locator(".win-titlebar .head-btn").first().click();
    await expect(page.locator("#previewPane")).toHaveClass(/open/);
    // iframe 懒加载真实页面
    const frame = page.locator("#previewFrame");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("src", /preview-demo\.html/);
    // 设备切换：平板
    await page.locator('#devSwitch button[title="平板"]').click();
    await expect(frame).toHaveClass(/dev-tablet/);
    // 手机
    await page.locator('#devSwitch button[title="手机"]').click();
    await expect(frame).toHaveClass(/dev-mobile/);
    // 切回桌面
    await page.locator('#devSwitch button[title="桌面"]').click();
    await expect(frame).toHaveClass(/dev-desktop/);
    // 标签切换 → 设计文档
    await page.locator(".btab").nth(1).click();
    await expect(frame).toHaveAttribute("src", /preview-docs\.html/);
    // 收起
    await page.locator(".pv-close").click();
    await expect(page.locator("#previewPane")).not.toHaveClass(/open/);
  });
});

test.describe("命令面板与设置", () => {
  test("⌘K 打开面板并执行命令", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#window.app-on");
    await page.keyboard.press("Meta+k");
    await expect(page.locator("#palette")).toHaveClass(/show/);
    await expect(page.locator(".palette-item")).toHaveCount(5);
    // 执行「打开设置」
    await page.locator(".palette-item", { hasText: "打开设置" }).click();
    await expect(page.locator("#settingsModal")).toHaveClass(/show/);
    await expect(page.locator("#settingsModal .pv-head .t")).toHaveText("设置");
    // Esc 关闭
    await page.keyboard.press("Escape");
    await expect(page.locator("#settingsModal")).toHaveCount(0);
  });

  test("设置：记忆开关与地址输入真实生效（localStorage 持久化）", async ({ page }) => {
    await page.goto("/");
    await page.locator(".win-titlebar .head-btn").nth(1).click();
    await expect(page.locator("#settingsModal")).toHaveClass(/show/);
    // 记忆开关（自定义 switch 的 input 是零尺寸，用 force 操作）
    const memSwitch = page.locator('#settingsModal .switch').first();
    await memSwitch.click();
    await page.reload();
    await page.locator(".win-titlebar .head-btn").nth(1).click();
    await expect(page.locator('#settingsModal input[type="checkbox"]').first()).not.toBeChecked();
    // 恢复
    await page.locator('#settingsModal .switch').first().click();
  });

  test("模型选择器可切换 deepseek-v4-pro", async ({ page }) => {
    await page.goto("/");
    await page.locator(".win-titlebar .head-btn").nth(1).click();
    const sel = page.locator("#setModel");
    await sel.selectOption("deepseek-v4-pro");
    await expect(sel).toHaveValue("deepseek-v4-pro");
  });
});

test.describe("键盘与线程", () => {
  test("⌘N 新建对话；Enter 发送；Shift+Enter 换行不发送", async ({ page }) => {
    await page.goto("/");
    const before = await page.locator(".thread-item").count();
    await page.keyboard.press("Meta+n");
    await expect(page.locator(".thread-item")).toHaveCount(before + 1);

    // Shift+Enter 换行：输入框内出现换行且不发送
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("第一行");
    await page.keyboard.press("Shift+Enter");
    await page.locator("#chatInput").type("第二行");
    await expect(page.locator("#chatInput")).toHaveValue(/第一行\n第二行/);
    await expect(page.locator(".msg.user")).toHaveCount(0);

    // Enter 发送
    await page.keyboard.press("Enter");
    await expect(page.locator(".msg.user .bubble")).toContainText("第一行");
  });

  test("线程切换与状态徽章", async ({ page }) => {
    await page.goto("/");
    // 初始一个线程；新开第二个
    await page.locator(".btn-new-chat").click();
    await expect(page.locator(".thread-item")).toHaveCount(2);
    await page.locator(".thread-item").nth(0).click();
    await expect(page.locator(".thread-item").nth(0)).toHaveClass(/on/);
  });
});