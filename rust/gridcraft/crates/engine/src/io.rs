//! Opening and saving files: XLSX (the native format), CSV/TSV, JSON (debug), HTML export.

use std::fmt::Write as _;

use gridcraft_core::CellRef;
use gridcraft_model::Workbook;

use crate::{EngineError, Result};

/// File formats GridCraft reads or writes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FileKind {
    Xlsx,
    Csv,
    Tsv,
    Json,
    Html,
}

impl FileKind {
    pub fn from_path(path: &str) -> Option<FileKind> {
        let ext = std::path::Path::new(path).extension()?.to_str()?.to_ascii_lowercase();
        Some(match ext.as_str() {
            "xlsx" | "xlsm" | "xltx" | "xltm" => FileKind::Xlsx,
            "csv" => FileKind::Csv,
            "tsv" | "tab" | "txt" => FileKind::Tsv,
            "json" | "scjson" => FileKind::Json,
            "html" | "htm" => FileKind::Html,
            _ => return None,
        })
    }
}

/// Parses a file's bytes into a workbook. `name` picks the format by extension when the bytes
/// don't say.
pub fn open_bytes(name: &str, bytes: &[u8]) -> Result<(Workbook, Vec<String>)> {
    let kind = FileKind::from_path(name);
    let sniffed = gridcraft_xlsx::sniff(bytes);
    if sniffed == gridcraft_xlsx::Format::Xlsx || kind == Some(FileKind::Xlsx) {
        let (wb, report) = gridcraft_xlsx::read_xlsx(bytes).map_err(|e| EngineError::Other(format!("We can't open '{name}': {e}")))?;
        return Ok((wb, report.warnings));
    }
    match kind {
        Some(FileKind::Json) => {
            let mut wb: Workbook = serde_json::from_slice(bytes).map_err(|e| EngineError::Other(format!("not a GridCraft JSON workbook: {e}")))?;
            wb.styles.rebuild_index();
            if wb.sheets.is_empty() {
                wb = Workbook::new();
            }
            Ok((wb, vec![]))
        }
        Some(FileKind::Tsv) => {
            let opts = gridcraft_xlsx::CsvOptions { delimiter: b'\t', ..Default::default() };
            let mut wb = gridcraft_xlsx::read_csv(bytes, &opts).map_err(|e| EngineError::Other(e.to_string()))?;
            rename_first_sheet(&mut wb, name);
            Ok((wb, vec![]))
        }
        _ => {
            let opts = gridcraft_xlsx::CsvOptions { delimiter: 0, ..Default::default() };
            let mut wb = gridcraft_xlsx::read_csv(bytes, &opts).map_err(|e| EngineError::Other(e.to_string()))?;
            rename_first_sheet(&mut wb, name);
            Ok((wb, vec![]))
        }
    }
}

/// A CSV opens as a sheet named after the file (like Excel).
fn rename_first_sheet(wb: &mut Workbook, path: &str) {
    let stem = std::path::Path::new(path).file_stem().and_then(|s| s.to_str()).unwrap_or("Sheet1");
    let clean: String = stem.chars().filter(|c| !matches!(c, ':' | '\\' | '/' | '?' | '*' | '[' | ']')).take(31).collect();
    let clean = clean.trim_matches('\'').to_string();
    if !clean.is_empty()
        && let Some(sh) = wb.sheet_mut(0)
    {
        sh.name = clean;
    }
}

/// Encodes a workbook in the format chosen by `path`'s extension.
pub fn save_bytes(wb: &Workbook, path: &str) -> Result<Vec<u8>> {
    let sheet = wb.active_sheet;
    match FileKind::from_path(path).unwrap_or(FileKind::Xlsx) {
        FileKind::Xlsx => gridcraft_xlsx::write_xlsx(wb).map_err(|e| EngineError::Other(e.to_string())),
        FileKind::Csv => Ok(wb.sheet(sheet).map(|sh| gridcraft_xlsx::write_csv(sh, wb, b',')).unwrap_or_default()),
        FileKind::Tsv => Ok(wb.sheet(sheet).map(|sh| gridcraft_xlsx::write_csv(sh, wb, b'\t')).unwrap_or_default()),
        FileKind::Json => serde_json::to_vec_pretty(wb).map_err(|e| EngineError::Other(e.to_string())),
        FileKind::Html => Ok(to_html(wb, sheet).into_bytes()),
    }
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// A sheet as a standalone HTML table (Save as Web Page).
pub fn to_html(wb: &Workbook, sheet: usize) -> String {
    let Some(sh) = wb.sheet(sheet) else { return String::new() };
    let mut out = String::new();
    let _ = write!(
        out,
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title><style>table{{border-collapse:collapse;font-family:Calibri,Carlito,Arial,sans-serif;font-size:11pt}}td{{border:1px solid #d4d4d4;padding:2px 4px;white-space:nowrap}}</style></head><body><table>",
        esc(&sh.name)
    );
    if let Some(r) = sh.used_range() {
        for row in r.start.row..=r.end.row.min(r.start.row + 100_000) {
            if sh.is_row_hidden(row) {
                continue;
            }
            out.push_str("<tr>");
            for col in r.start.col..=r.end.col {
                let c = CellRef::new(row, col);
                if sh.merges.iter().any(|m| m.contains(c) && m.start != c) {
                    continue;
                }
                let st = wb.styles.get(sh.style_id(c));
                let mut css = String::new();
                if st.font.bold {
                    css.push_str("font-weight:bold;");
                }
                if st.font.italic {
                    css.push_str("font-style:italic;");
                }
                if let Some(h) = st.font.color.hex(&wb.theme) {
                    let _ = write!(css, "color:{h};");
                }
                if st.fill.pattern != gridcraft_model::PatternType::None
                    && let Some(h) = st.fill.fg.hex(&wb.theme)
                {
                    let _ = write!(css, "background:{h};");
                }
                let v = sh.value(c);
                let align = match st.align.h {
                    gridcraft_model::HAlign::Center => "center",
                    gridcraft_model::HAlign::Right => "right",
                    gridcraft_model::HAlign::Left => "left",
                    _ if v.is_number() => "right",
                    _ => "left",
                };
                let _ = write!(css, "text-align:{align};");
                let span = sh
                    .merges
                    .iter()
                    .find(|m| m.start == c)
                    .map(|m| format!(" rowspan=\"{}\" colspan=\"{}\"", m.height(), m.width()))
                    .unwrap_or_default();
                let _ = write!(out, "<td style=\"{css}\"{span}>{}</td>", esc(&crate::display::cell_text(wb, sh, c)));
            }
            out.push_str("</tr>");
        }
    }
    out.push_str("</table></body></html>");
    out
}

#[cfg(not(target_arch = "wasm32"))]
pub fn read_file(path: &str) -> Result<Vec<u8>> {
    let meta = std::fs::metadata(path).map_err(|e| EngineError::Other(format!("{path}: {e}")))?;
    if meta.len() > 2 * 1024 * 1024 * 1024 {
        return Err(EngineError::Other("files larger than 2 GB aren't supported".into()));
    }
    std::fs::read(path).map_err(|e| EngineError::Other(format!("{path}: {e}")))
}

#[cfg(target_arch = "wasm32")]
pub fn read_file(path: &str) -> Result<Vec<u8>> {
    Err(EngineError::Other(format!("{path}: no file system in the browser")))
}

#[cfg(not(target_arch = "wasm32"))]
pub fn write_file(path: &str, bytes: &[u8]) -> Result<()> {
    // Write to a temporary file, then rename: a crash never leaves a half-written workbook.
    let tmp = format!("{path}.sctmp");
    std::fs::write(&tmp, bytes).map_err(|e| EngineError::Other(format!("{path}: {e}")))?;
    std::fs::rename(&tmp, path).map_err(|e| EngineError::Other(format!("{path}: {e}")))
}

#[cfg(target_arch = "wasm32")]
pub fn write_file(path: &str, _bytes: &[u8]) -> Result<()> {
    Err(EngineError::Other(format!("{path}: no file system in the browser")))
}

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b = [chunk.first().copied().unwrap_or(0), chunk.get(1).copied().unwrap_or(0), chunk.get(2).copied().unwrap_or(0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(B64[((n >> (18 - 6 * i)) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

pub fn base64_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.split_once(',').filter(|(h, _)| h.starts_with("data:")).map(|(_, b)| b).unwrap_or(s);
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    let mut buf = 0u32;
    let mut bits = 0;
    for c in s.bytes() {
        if c == b'=' || c.is_ascii_whitespace() {
            continue;
        }
        let v = B64.iter().position(|&x| x == c)? as u32;
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Some(out)
}

/// Pixel size of a PNG or JPEG from its header.
pub fn image_size(data: &[u8]) -> Option<(u32, u32)> {
    if data.starts_with(&[0x89, b'P', b'N', b'G']) {
        let w = u32::from_be_bytes(data.get(16..20)?.try_into().ok()?);
        let h = u32::from_be_bytes(data.get(20..24)?.try_into().ok()?);
        return Some((w, h));
    }
    if data.starts_with(&[0xFF, 0xD8]) {
        let mut i = 2;
        while i + 9 < data.len() {
            if *data.get(i)? != 0xFF {
                i += 1;
                continue;
            }
            let marker = *data.get(i + 1)?;
            let len = u16::from_be_bytes([*data.get(i + 2)?, *data.get(i + 3)?]) as usize;
            if (0xC0..=0xCF).contains(&marker) && !matches!(marker, 0xC4 | 0xC8 | 0xCC) {
                let h = u16::from_be_bytes([*data.get(i + 5)?, *data.get(i + 6)?]) as u32;
                let w = u16::from_be_bytes([*data.get(i + 7)?, *data.get(i + 8)?]) as u32;
                return Some((w, h));
            }
            i += 2 + len;
        }
    }
    None
}
