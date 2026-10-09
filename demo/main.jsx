import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {Gridcraft} from "../dist/react.js";
import {createSpreadsheet} from "../dist/index.js";
window.createSpreadsheet = createSpreadsheet;
function App() {
  const [api, setApi] = useState(null);
  const [changes, setChanges] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [error, setError] = useState("");
  const [cellsOnly, setCellsOnly] = useState(true);
  const [dark, setDark] = useState(false);
  return <div style={{height: "100dvh", display: "flex", flexDirection: "column", background: dark ? "#161b22" : "#ffffff", color: dark ? "#e6edf3" : "#17202a", colorScheme: dark ? "dark" : "light"}}>
    <div style={{display: "flex", flexWrap: "wrap", gap: 12, padding: 12, alignItems: "center", flexShrink: 0}}>
      <strong>Gridcraft npm demo</strong>
      <label style={{display: "flex", alignItems: "center", gap: 4}}><input type="checkbox" checked={cellsOnly} disabled={!api} onChange={e => {setCellsOnly(e.target.checked); api.setCellsOnly(e.target.checked);}} />Cells only</label>
      <label style={{display: "flex", alignItems: "center", gap: 4}}><input type="checkbox" checked={dark} disabled={!api} onChange={e => {setDark(e.target.checked); api.execute("view.darkMode", {on: e.target.checked});}} />Dark mode</label>
      <button disabled={!api} onClick={() => {
        api.setValues("A1", [["Revenue", "Cost", "Profit"], [1000, 400, "=A2-B2"], [1800, 700, "=A3-B3"]]);
        api.execute("home.bold", {range: "A1:C1"});
        api.execute("home.fillColor", {range: "A1:C1", color: "#173C3D"});
        api.execute("home.fillColor", {range: "A2:C3", color: "#182235"});
        api.execute("home.fontColor", {range: "A1:C3", color: "#FFFFFF"});
      }}>Apply custom colors</button>
      <button disabled={!api} onClick={() => {api.setValues("A1", [["Revenue", "Cost", "Profit"], [1000, 400, "=A2-B2"]]); api.execute("home.bold", {range: "A1:C1"});}}>Write formulas</button>
      <button disabled={!api} onClick={() => {
        const url = URL.createObjectURL(api.exportWorkbook());
        const a = document.createElement("a"); a.href = url; a.download = "Workbook.xlsx"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }}>Download XLSX</button>
      <input aria-label="Open workbook" type="file" accept=".xlsx,.csv" disabled={!api} onChange={async (e) => {try {if (e.target.files[0]) await api.importWorkbook(e.target.files[0]);} catch (err) {setError(String(err));}}} />
      <button onClick={() => {setApi(null); window.gridcraft = null; setMounted(!mounted);}}>{mounted ? "Unmount" : "Mount"}</button>
      <span>Workbook changes: {changes}</span>
    </div>
    {error && <p role="alert">{error}</p>}
    {mounted && <Gridcraft style={{height: "auto", flex: 1, minHeight: 0}} options={{webgl: true, cellsOnly, dark}} onReady={(created) => {window.gridcraft = created; setApi(created);}} onChange={() => setChanges(n => n + 1)} onError={(err) => setError(String(err))} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
