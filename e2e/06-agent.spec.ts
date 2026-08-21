import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 真实 Agent 工具流（对齐 deepseek-harness 关键能力）：
 * 模型自主调用 bash/写文件等真实工具（经 tools-server :8450），再汇报真实结果。
 * 依赖：MemoryProxy :8096 / MemoryCore :8420 / tools-server :8450（playwright webServer 自动拉起）。
 */
const WS = path.resolve("workspace");

function scanWorkspace(dir = WS): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...scanWorkspace(p));
    else out.push(p);
  }
  return out;
}

test.describe("真实 Agent 工具流", () => {
  test.describe.configure({ retries: 1 });

  // e2e 隔离：工具服务指向 playwright 自管的 8451 实例（工作目录=仓库 workspace/），
  // 避免复用本机 launchd 生产实例（8450，工作目录 ~/Harness）造成文件写入错位。
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("harness.tools.config", JSON.stringify({ url: "http://127.0.0.1:8451" }));
      } catch { /* ignore */ }
    });
  });

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

    // 工具调用组出现（默认折叠）；展开后可见原始命令与输出
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 90_000 });
    await page.locator(".tool-summary").first().click();
    await expect(page.locator(".tool-line")).toBeVisible({ timeout: 10_000 });
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
    test.setTimeout(300_000);
    // 清理旧产物：任意含标记的文件（模型文件名/路径允许有差异）
    for (const f of scanWorkspace()) { try { if (fs.readFileSync(f, "utf8").includes("harness-e2e")) fs.unlinkSync(f); } catch { /* ignore */ } }

    await page.goto("/");
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type(
      "请只调用一次 write 工具：path 用 agent-hello.txt，content 用 harness-e2e-写入成功。不要做任何其他操作，完成后直接说完成。"
    );
    await page.locator(".send-btn").click();

    // 外部（测试进程）验证文件真实落盘：扫描整个工作目录，容忍文件名差异
    await expect
      .poll(() => scanWorkspace().some((f) => { try { return fs.readFileSync(f, "utf8").includes("harness-e2e"); } catch { return false; } }), {
        timeout: 240_000,
        message: "工作目录未出现内容含 harness-e2e 标记的文件",
      })
      .toBe(true);
    // UI 上有 write 工具组（默认折叠；展开确认）
    await expect(page.locator(".tool-group")).toBeVisible({ timeout: 60_000 });
    await page.locator(".tool-summary").first().click();
    await expect(page.locator(".tool-line").first()).toBeVisible({ timeout: 10_000 });
  });

  test("多轮对话：第二轮回复必须针对第二轮（回复不错位）", async ({ page }) => {
    await page.goto("/");
    // 第一轮（触发记忆召回，等回复完成）
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请只回复「第一轮完成」这五个字，不要任何其他内容");
    await page.locator(".send-btn").click();
    await expect(page.locator(".msg.agent .text").last()).toContainText("第一轮完成", { timeout: 90_000 });

    // 第二轮：回复必须针对第二轮内容（回归：曾因 LLM 历史漏掉刚发消息而错位回答上一轮）
    await page.locator("#chatInput").click();
    await page.locator("#chatInput").type("请只回复「第二轮完成」这五个字，不要任何其他内容");
    await page.locator(".send-btn").click();
    await expect(page.locator(".msg.agent .text").last()).toContainText("第二轮完成", { timeout: 90_000 });
    const lastText = await page.locator(".msg.agent .text").last().innerText();
    expect(lastText).not.toContain("第一轮完成");
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