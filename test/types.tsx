import {createRef} from "react";
import {Gridcraft} from "../dist/react.js";
import type {SpreadsheetAPI} from "../dist/index.js";
const ref = createRef<SpreadsheetAPI>();
const component = <Gridcraft ref={ref} options={{cellsOnly: true}} onReady={api => {
  api.setCellsOnly(false);
  api.setValues("A1", [[1, "=SUM(A1:A2)"]]);
  api.exportWorkbook("xlsx");
}} />;
void component;
