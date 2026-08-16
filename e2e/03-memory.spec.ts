import { test, expect } from "@playwright/test";

/**
 * 真实记忆链路：MemoryCore 已存有真实画像（L3），新对话首条消息应触发
 * 「来自记忆」召回块；每轮完成后写入 L0（capture）。
 */
test.describe("真实记忆（TencentDB Agent Memory）", () => {

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });
  test("新对话首条消息触发真实记忆召回块", async ({ page }) => {
    await page.goto("/");
    await page.locator(".btn-new-chat").click();
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("帮我做一个登录页面");
    await page.locator(".send-btn").click();

    // 真实召回（core /recall），而非本地回退：轮询前端记录的召回来源
    await expect
      .poll(async () => page.evaluate(() => (window as any).__lastRecallSource), { timeout: 30_000 })
      .toBe("core");
    const memBlock = page.locator(".mem-block");
    await expect(memBlock).toBeVisible();
    await expect(memBlock.locator(".mem-label")).toContainText("来自记忆");
    // 至少一条真实原子（L1 画像：暖白极简 / 最小版本 / MVP / 鉴权模块）
    const atoms = await memBlock.locator(".mem-atom").allInnerTexts();
    expect(atoms.length).toBeGreaterThanOrEqual(1);
    expect(atoms.join("")).toMatch(/暖白|极简|最小|MVP|务实|画像|鉴权/i);
  });

  test("每轮对话沉淀 L0（MemoryCore capture 记录数增长）", async ({ page, request }) => {
    // 记录当前 L0 搜索基线
    const before = await request.post("http://127.0.0.1:8420/search/conversations", {
      data: { query: "测试沉淀", session_key: "desktop-harness-desktop", user_id: "harness-desktop" },
    }).then((r) => r.text()).catch(() => "");

    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("记录一条测试偏好：我喜欢简洁的按钮");
    await page.locator(".send-btn").click();
    // 等真实回复出现
    await expect(page.locator(".msg.agent").last()).toBeVisible({ timeout: 90_000 });
    // 轮询应用的真实提交结果（__lastCommit 由 commitMemory 写入，仅当 MemoryCore capture 返回 l0_recorded>0 时为 true）
    await expect
      .poll(async () => page.evaluate(() => (window as any).__lastCommit), { timeout: 60_000 })
      .toBe(true);
    const after = await request.post("http://127.0.0.1:8420/search/conversations", {
      data: { query: "简洁的按钮", session_key: "desktop-harness-desktop", user_id: "harness-desktop" },
    }).then((r) => r.text()).catch(() => "");
    expect(after.length).toBeGreaterThan(0);
    expect(after).not.toBe(before);
  });
});