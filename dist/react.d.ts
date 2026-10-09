import type {CSSProperties, ForwardRefExoticComponent, RefAttributes} from "react";
import type {SpreadsheetAPI, SpreadsheetOptions} from "./index.js";
export interface GridcraftProps {
  /** Applied on mount. To replace configuration, remount with a different key. */
  options?: SpreadsheetOptions;
  className?: string;
  style?: CSSProperties;
  onReady?: (api: SpreadsheetAPI) => void;
  onChange?: (api: SpreadsheetAPI) => void;
  onError?: (error: unknown) => void;
}
export const Gridcraft: ForwardRefExoticComponent<GridcraftProps & RefAttributes<SpreadsheetAPI | null>>;
