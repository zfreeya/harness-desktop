import { test, expect } from "@playwright/test";

/**
 * 重设计后的工作台状态验证：
 * 1. 新建任务空白状态：任务标题 / 语义状态 / 可操作输入三要素齐全
 * 2. 工具调用默认折叠：一行摘要可见，原始命令需展开
 * 3. 任务完成 → 成果卡（打开预览主按钮直达预览面板）
 * 4. 窄窗口侧栏自动折叠，可手动展开
 * 5. 底部操作台结构：附件在容器内 / 模式 chip / 占位文案 / 快捷键提示单一位置
 * 6. 长命令截断（等宽省略，不撑破布局）
 */
test.describe("Agent 工作台重设计", () => {
  test.describe.configure({ retries: 1 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

  test("新建任务空白状态：标题/状态/输入三要素", async ({ page }) => {
    await page.goto("/");
    // 顶栏：任务标题 + 语义状态
    await expect(page.locator(".task-title")).toHaveText("新任务");
    await expect(page.locator(".win-titlebar .badge")).toHaveText("等待回复");
    // 主区：问候语（可读、可操作提示）
    await expect(page.locator(".msg.agent .text").first()).toBeVisible();
    // 输入台：占位文案 + 发送按钮
    await expect(page.locator("#chatInput")).toHaveAttribute("placeholder", "描述你希望 Agent 完成的任务……");
    await expect(page.locator(".send-btn")).toBeVisible();
    // 无成果卡、无工具组
    await expect(page.locator(".deliverable-card")).toHaveCount(0);
    await expect(page.locator(".tool-group")).toHaveCount(0);
  });

  test("工具调用默认折叠，展开可见原始命令", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请用 bash 工具执行 echo collapse-ok，并把输出告诉我");
    await page.locator(".send-btn").click();
    // 摘要行可见（一行人类可读摘要），原始行默认不可见
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".tool-summary")).toContainText(/已完成|正在执行/);
    await expect(page.locator(".tool-line")).toHaveCount(0);
    // 点击展开
    await page.locator(".tool-summary").first().click();
    await expect(page.locator(".tool-line").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".tool-line").first()).toContainText(/bash|echo/);
  });

  test("任务完成产生成果卡，主按钮直达预览", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "请用 write 工具创建文件 deliver-demo.html，内容为：<!DOCTYPE html><html><body><h1 id=\"dv\">成果卡验证</h1></body></html>"
    );
    await page.locator(".send-btn").click();
    // 成果卡出现：标题/状态/主按钮/次按钮/操作说明
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(".dc-title")).toContainText("预览");
    await expect(page.locator(".dc-status")).toContainText("已就绪");
    await expect(page.locator(".dc-actions .btn-primary")).toContainText("打开预览");
    await expect(page.locator(".dc-actions .btn-secondary")).toContainText("复制链接");
    await expect(page.locator(".dc-help summary")).toContainText("操作说明");
    // 主按钮 → 预览面板打开并指向该文件
    await page.locator(".dc-actions .btn-primary").click();
    await expect(page.locator("#previewPane")).toHaveClass(/open/);
    await expect(page.locator(".btab", { hasText: "deliver-demo.html" })).toBeVisible();
    const frame = page.frameLocator("#previewFrame");
    await expect(frame.locator("#dv")).toHaveText("成果卡验证", { timeout: 60_000 });
  });

  test("重启后成果卡打开预览直达游戏（不落到 mock 页）", async ({ page }) => {
    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "请用 write 工具创建文件 persist-preview.html，内容为：<!DOCTYPE html><html><body><h1 id=\"pp\">持久化预览</h1></body></html>"
    );
    await page.locator(".send-btn").click();
    await expect(page.locator(".deliverable-card")).toBeVisible({ timeout: 90_000 });
    // 模拟重启：刷新后线程与预览标签都保留
    await page.reload();
    await expect(page.locator(".deliverable-card")).toBeVisible();
    // 点成果卡「打开预览」→ 必须直达 persist-preview.html，而不是 mock 内置页
    await page.locator(".dc-actions .btn-primary").click();
    await expect(page.locator("#previewPane")).toHaveClass(/open/);
    const src = await page.locator("#previewFrame").getAttribute("src");
    expect(src).toContain("/preview/persist-preview.html");
    expect(src).not.toContain("preview-demo.html");
    const frame = page.frameLocator("#previewFrame");
    await expect(frame.locator("#pp")).toHaveText("持久化预览", { timeout: 60_000 });
  });

  test("窄窗口侧栏自动折叠，可手动展开", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 });
    await page.goto("/");
    // 侧栏默认隐藏
    await expect(page.locator(".sidebar")).not.toBeVisible();
    // 点击切换按钮 → 展开
    await page.locator(".side-toggle").click();
    await expect(page.locator("#window")).toHaveClass(/side-open/);
    await expect(page.locator(".sidebar")).toBeVisible();
    // 再点收起
    await page.locator(".side-toggle").click();
    await expect(page.locator(".sidebar")).not.toBeVisible();
  });

  test("底部操作台：附件在容器内/模式/快捷键提示唯一", async ({ page }) => {
    await page.goto("/");
    // 附件按钮在输入容器内部（.console .tool-btn）
    await expect(page.locator(".console .tool-btn[aria-label='附件']")).toBeVisible();
    // 模式 chip
    await expect(page.locator(".mode-chip")).toContainText("自动执行");
    // 快捷键提示集中一处
    await expect(page.locator(".console-hint")).toContainText("Enter");
    await expect(page.locator(".console-hint")).toContainText("Shift+Enter");
    // 工作目录入口
    await expect(page.locator(".hint-right")).toBeVisible();
  });

  test("长命令截断：等宽省略不撑破布局", async ({ page }) => {
    await page.goto("/?e2e=1");
    const longArgs = JSON.stringify({ command: "echo " + "a".repeat(200) + " && echo 结尾" });
    await page.evaluate((args) => (window as any).__e2eInject({
      role: "agent", kind: "tool", toolName: "bash", toolArgs: args, toolStatus: "done", toolResult: "{\"exitCode\":0}",
    }), longArgs);
    await page.locator(".tool-summary").first().click();
    const style = await page.locator(".tl-args").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { nowrap: cs.whiteSpace, overflow: cs.overflow, textOverflow: cs.textOverflow };
    });
    expect(style.nowrap).toBe("nowrap");
    expect(style.overflow).toBe("hidden");
    expect(style.textOverflow).toBe("ellipsis");
    // 布局未撑破：工具行高度在合理范围
    const height = await page.locator(".tool-line").first().evaluate((el) => el.clientHeight);
    expect(height).toBeLessThan(200);
  });
});