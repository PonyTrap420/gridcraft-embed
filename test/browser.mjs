import {chromium} from "playwright";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {mkdirSync} from "node:fs";
import path from "node:path";
const screenshots = path.resolve(process.env.ARTIFACT_DIR ?? "screenshots");
mkdirSync(screenshots, {recursive: true});
const executablePath = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
const browser = await chromium.launch({executablePath, headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {if (message.type() === "error") console.error(message.text());});
  await page.goto(process.env.DEMO_URL ?? "http://127.0.0.1:5173");
  await page.waitForFunction(() => Boolean(window.gridcraft), {timeout: 120000});
  const result = await page.evaluate(async () => {
    const api = window.gridcraft;
    api.setCell("A1", 123);
    const showFull = api.setCellsOnly(false).on === false;
    const showCells = api.setCellsOnly(true).on === true;
    const modePreservesData = api.getCell("A1").value === 123;
    api.setValues("A1", [[10, 20, "=SUM(A1:B1)"]]);
    const computed = api.getCell("C1").value;
    api.setCell("A1", 15);
    const recalculated = api.getCell("C1").value;
    api.undo(); const undone = api.getCell("A1").value;
    api.redo(); const redone = api.getCell("A1").value;
    api.execute("home.bold", {range: "A1:C1"});
    const xlsx = api.exportWorkbook();
    await api.importWorkbook(xlsx, "Roundtrip.xlsx");
    const imported = api.getCell("C1").value;
    const boldRetained = api.getCell("A1").style.font.bold;
    api.setCell("Z1", "=NOW()");
    const liveClock = Math.abs(api.getCell("Z1").value - (25569 + Date.now() / 86400000)) < 0.001;
    let commandError = false;
    try {api.execute("not.a.command");} catch {commandError = true;}
    const container = document.createElement("div");
    container.style.cssText = "width:800px;height:500px;position:fixed;top:0;left:0";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%";
    container.appendChild(canvas); document.body.appendChild(container);
    const second = await window.createSpreadsheet(canvas, {webgl: true});
    second.setCell("A1", 999);
    const isolated = api.getCell("A1").value === 15;
    second.destroy(); container.remove();
    let destroyedError = false;
    try {second.getCell("A1");} catch {destroyedError = true;}
    api.execute("selection.set", {cell: "A3"});
    return {computed, recalculated, undone, redone, imported, boldRetained, liveClock, isolated, commandError, destroyedError, showFull, showCells, modePreservesData, bytes: xlsx.size};
  });
  assert.equal(result.computed, 30);
  assert.equal(result.recalculated, 35);
  assert.equal(result.undone, 10);
  assert.equal(result.redone, 15);
  assert.equal(result.imported, 35);
  assert.ok(result.isolated && result.commandError && result.destroyedError);
  assert.ok(result.boldRetained && result.liveClock);
  assert.ok(result.showFull && result.showCells && result.modePreservesData);
  assert.ok(result.bytes > 1000);
  console.log("Engine checks", JSON.stringify(result));
  await page.locator("canvas").click({position: {x: 500, y: 420}});
  await page.evaluate(() => window.gridcraft.execute("selection.set", {cell: "A3"}));
  await page.keyboard.type("55", {delay: 100}); await page.keyboard.press("Enter");
  try {await page.waitForFunction(() => window.gridcraft.getCell("A3").value === 55, null, {timeout: 5000});}
  catch (error) {
    console.log(await page.evaluate(() => ({cell: window.gridcraft.getCell("A3"), document: window.gridcraft.inspect(), active: document.activeElement?.outerHTML})));
    await page.screenshot({path: path.join(screenshots, "browser-debug.png")});
    throw error;
  }
  await page.getByRole("button", {name: "Unmount", exact: true}).click();
  await page.waitForFunction(() => !window.gridcraft);
  await page.getByRole("button", {name: "Mount", exact: true}).click();
  await page.waitForFunction(() => Boolean(window.gridcraft));
  await page.getByRole("button", {name: "Write formulas"}).click();
  await page.waitForFunction(() => window.gridcraft.getCell("C2").value === 600);
  const nextPaint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await nextPaint();
  await page.screenshot({path: path.join(screenshots, "browser-preview.png")});
  await page.getByRole("checkbox", {name: "Cells only"}).uncheck();
  await nextPaint();
  await page.screenshot({path: path.join(screenshots, "full-ui-preview.png")});
  assert.equal(await page.evaluate(() => window.gridcraft.getCell("C2").value), 600);
  await page.getByRole("checkbox", {name: "Cells only"}).check();
  await page.setViewportSize({width: 375, height: 812});
  await page.waitForFunction(() => document.querySelector("canvas").width === 375);
  await nextPaint();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path: path.join(screenshots, "cells-only-mobile.png")});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed: true, ...result, uiEditing: true, reactStrictMode: true, remount: true}, null, 2));
} finally {await browser.close();}
