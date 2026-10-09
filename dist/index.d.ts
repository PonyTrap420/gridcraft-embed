export interface SpreadsheetOptions {
  sample?: "sales" | "budget" | "grades";
  dark?: boolean;
  webgl?: boolean;
  /** Hide app controls; retain editable cells, row/column headers, and scrolling. */
  cellsOnly?: boolean;
  /** Initialization is shared: the first mount's URL is used. */
  wasmUrl?: string | URL;
}
export interface SpreadsheetAPI {
  setCellsOnly(on: boolean): {on: boolean};
  execute<T = unknown>(command: string, params?: Record<string, unknown>): T;
  commands(): unknown[];
  setCell(cell: string, input: string | number | boolean, sheet?: string | number): unknown;
  getCell<T = unknown>(cell: string, sheet?: string | number): T;
  setValues(range: string, values: (string | number | boolean | null)[][]): unknown;
  readRange<T = unknown>(range: string, options?: {sheet?: string | number; formulas?: boolean; formatted?: boolean}): T;
  inspect<T = unknown>(): T;
  undo(): unknown;
  redo(): unknown;
  importWorkbook(input: Blob | Uint8Array | ArrayBuffer, name?: string): Promise<unknown>;
  exportWorkbook(format?: "xlsx" | "csv" | "tsv" | "json" | "html"): Blob;
  /** Coalesced workbook changes (including edits through the UI), polled every 150ms. */
  onChange(listener: (api: SpreadsheetAPI) => void): () => void;
  destroy(): void;
}
export function createSpreadsheet(canvas: HTMLCanvasElement, options?: SpreadsheetOptions): Promise<SpreadsheetAPI>;
