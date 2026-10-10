import {chromium} from "playwright";
import {existsSync, mkdirSync} from "node:fs";
import path from "node:path";
const output = path.resolve("docs/images");
mkdirSync(output, {recursive: true});
const executablePath = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await chromium.launch({executablePath, headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
  await page.goto(process.env.DEMO_URL ?? "http://127.0.0.1:5174");
  await page.waitForFunction(() => Boolean(window.gridcraft), {timeout: 120000});
  await page.evaluate(() => {
    const api = window.gridcraft;
    api.execute("home.columnWidth", {cols: "A:A", width: 135});
    api.execute("home.columnWidth", {cols: "B:E", width: 110});
    api.execute("home.columnWidth", {cols: "F:F", width: 30});
    api.execute("home.columnWidth", {cols: "G:G", width: 160});
    api.execute("home.columnWidth", {cols: "H:J", width: 115});
    api.execute("home.rowHeight", {rows: "1:13", height: 26});
    api.execute("home.fontSize", {range: "A1:J13", size: 14});
    api.setValues("A1", [
      ["Q4 operating plan", "", "", "", "", "", "Monthly results", "", "", ""],
      ["Department", "Budget", "Actual", "Variance", "Status", "", "Month", "Revenue", "Cost", "Profit"],
      ["Product", 125000, 119400, "=B3-C3", "On track", "", "July", 185000, 124000, "=H3-I3"],
      ["Marketing", 85000, 79200, "=B4-C4", "On track", "", "August", 214000, 139000, "=H4-I4"],
      ["Operations", 62000, 64100, "=B5-C5", "Review", "", "September", 236000, 148000, "=H5-I5"],
      ["Support", 45000, 41300, "=B6-C6", "On track", "", "Total", "=SUM(H3:H5)", "=SUM(I3:I5)", "=SUM(J3:J5)"],
      ["Total", "=SUM(B3:B6)", "=SUM(C3:C6)", "=SUM(D3:D6)", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      ["Forecast", "", "", "", "", "", "Formula examples", "", "", ""],
      ["Metric", "Current", "Target", "Gap", "", "", "Function", "Result", "", ""],
      ["Revenue", "=SUM(H3:H5)", 700000, "=C11-B11", "", "", "SUM", "=SUM(H3:H5)", "", ""],
      ["Profit", "=SUM(J3:J5)", 240000, "=C12-B12", "", "", "AVERAGE", "=AVERAGE(J3:J5)", "", ""],
      ["Orders", 1840, 2000, "=C13-B13", "", "", "MAX", "=MAX(J3:J5)", "", ""],
    ]);
    for (const range of ["B3:D7", "H3:J6", "B11:D13", "H11:H13"]) api.execute("home.numberFormat", {range, code: "#,##0"});
    for (const range of ["A1:E1", "G1:J1", "A9:D9", "G9:H9"]) {
      api.execute("home.fillColor", {range, color: "#173C3D"});
      api.execute("home.fontColor", {range, color: "#FFFFFF"});
      api.execute("home.bold", {range});
    }
    for (const range of ["A2:E2", "G2:J2", "A10:D10", "G10:H10"]) {
      api.execute("home.fillColor", {range, color: "#DCEDEA"});
      api.execute("home.bold", {range});
    }
    for (const range of ["A7:E7", "G6:J6"]) {
      api.execute("home.fillColor", {range, color: "#E3EAF6"});
      api.execute("home.bold", {range});
    }
    api.execute("home.fillColor", {range: "D5:E5", color: "#F8E5C3"});
    api.execute("selection.set", {cell: "D7"});
  });
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole("checkbox", {name: "Cells only"}).uncheck();
  await paint();
  await page.screenshot({path: path.join(output, "demo-light.png")});
  await page.getByRole("checkbox", {name: "Cells only"}).check();
  await page.getByRole("checkbox", {name: "Dark mode"}).check();
  await page.setViewportSize({width: 1280, height: 540});
  await paint();
  await page.screenshot({path: path.join(output, "demo-dark.png")});
  console.log("Captured actual demo in full light UI and dark cells-only mode.");
} finally {await browser.close();}
