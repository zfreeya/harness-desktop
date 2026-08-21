const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  await page.goto("http://localhost:1420/");
  // 先手动打开预览面板（模拟用户先打开看到 mock 页）
  await page.locator(".win-titlebar .head-btn").first().click();
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => ({
    open: document.getElementById("previewPane")?.className,
    src: document.getElementById("previewFrame")?.getAttribute("src"),
    tabs: Array.from(document.querySelectorAll(".btab")).map((b) => b.textContent),
  }));
  // 发送真实任务
  await page.locator("#chatInput").click();
  await page.locator("#chatInput").type("请用 write 工具创建文件 tetris.html，内容为 <h1 id='tk'>debug-tetris</h1>");
  await page.locator(".send-btn").click();
  await page.waitForTimeout(20000);
  const after = await page.evaluate(() => ({
    open: document.getElementById("previewPane")?.className,
    src: document.getElementById("previewFrame")?.getAttribute("src"),
    tabs: Array.from(document.querySelectorAll(".btab")).map((b) => b.textContent),
    toolEvents: (window).__toolEvents?.map((e) => ({ n: e.name, ok: !/error/.test(e.result), r: (e.result||"").slice(0, 60) })),
    title: document.querySelector(".task-title")?.textContent,
    deliverable: !!document.querySelector(".deliverable-card"),
  }));
  console.log("BEFORE:", JSON.stringify(before));
  console.log("AFTER:", JSON.stringify(after, null, 1));
  console.log("ERRORS:", JSON.stringify(errors));
  await browser.close();
})();

