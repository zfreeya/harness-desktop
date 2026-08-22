import { test, expect } from "@playwright/test";

/**
 * Godot 能力（真实实现，不伪造）：
 * 1. 新建 Godot 任务 → 工作区诚实显示「引擎未安装/未检测到」
 * 2. godot-server 真实创建项目（project.godot/场景/GDScript）→ 工作区场景 tab 展示真实节点树
 * 3. 运行项目 → 真实返回「运行时缺失」错误码与下一步提示
 */
test.describe("Godot 游戏能力", () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" })); } catch { /* ignore */ }
    });
  });

  test("新建 Godot 任务 → 工作区诚实显示引擎未安装", async ({ page }) => {
    await page.goto("/");
    await page.locator(".btn-new-chat").click();
    await expect(page.locator(".newtask-pop")).toBeVisible();
    await page.locator(".newtask-item", { hasText: "Godot 游戏" }).click();
    await page.locator(".win-titlebar .head-btn").first().click();
    await expect(page.locator(".game-workspace")).toBeVisible();
    await expect(page.locator(".gw-head .badge")).toHaveText("引擎未安装");
    await expect(page.locator(".gw-engine")).toContainText("未检测到");
    await expect(page.locator(".gw-engine .gw-hint")).toContainText("未安装 Godot");
  });

  test("godot-server 真实创建项目，工作区场景树真实解析展示", async ({ page, request }) => {
    // 新建 Godot 任务（首线程 id 为 C-1）
    await page.goto("/");
    await page.locator(".btn-new-chat").click();
    await page.locator(".newtask-item", { hasText: "Godot 游戏" }).click();
    // 读取当前任务 id（与工作区 projectId 一致）
    const tid = await page.evaluate(() => localStorage.getItem("harness.current.v1"));
    // 用 godot-server 真实创建项目（projectId 与当前任务一致）
    const c = await request.post("http://127.0.0.1:8455/create", { data: { projectId: tid, name: "platformer" } });
    expect(c.ok()).toBeTruthy();
    const cj = await c.json();
    expect(cj.ok).toBe(true);
    // 真实文件落盘
    const sc = await request.post("http://127.0.0.1:8455/scenes", { data: { projectId: tid } });
    const scj = await sc.json();
    expect(scj.scenes).toContain("scenes/main.tscn");
    expect(scj.tree.map((n: { type: string }) => n.type)).toContain("CharacterBody2D");
    // 工作区场景 tab 渲染真实节点树
    await page.locator(".win-titlebar .head-btn").first().click();
    await expect(page.locator(".game-workspace")).toBeVisible();
    await page.locator(".gw-tab", { hasText: "场景" }).click();
    await expect(page.locator(".gw-tree")).toContainText("Node2D");
    await expect(page.locator(".gw-tree")).toContainText("CharacterBody2D");
    await expect(page.locator(".gw-scene")).toContainText("scenes/main.tscn");
  });

  test("运行项目真实报告运行时缺失并给出下一步", async ({ request }) => {
    const c = await request.post("http://127.0.0.1:8455/create", { data: { projectId: "runner-1", name: "runner" } });
    await c.json();
    const r = await request.post("http://127.0.0.1:8455/run", { data: { projectId: "runner-1", taskId: "runner-1" } });
    const rj = await r.json();
    expect(rj.ok).toBe(false);
    expect(rj.code).toBe("runtime_missing");
    expect(rj.hint).toContain("Godot 运行时");
  });
});