//! Hostile and broken input: must return an error or warnings, never panic.

use std::io::Write;

use super::{make_zip, minimal};
use crate::{IoError, read_xlsx, write_xlsx};

#[test]
fn garbage_and_truncation() {
    assert!(read_xlsx(b"").is_err());
    assert!(read_xlsx(b"hello world").is_err());
    assert!(read_xlsx(b"PK\x03\x04garbage").is_err());
    let good = write_xlsx(&gridcraft_model::Workbook::new()).unwrap();
    for n in [10, 100, good.len() / 2, good.len() - 10] {
        let _ = read_xlsx(&good[..n]);
    }
    // Flip bytes throughout a valid file.
    for i in (0..good.len()).step_by(97) {
        let mut b = good.clone();
        b[i] ^= 0xFF;
        let _ = read_xlsx(&b);
    }
}

#[test]
fn missing_parts() {
    // No workbook at all.
    let z = make_zip(&[("[Content_Types].xml", super::CT.as_bytes())]);
    assert!(matches!(read_xlsx(&z), Err(IoError::Format(_))));
    // Workbook pointing at a missing sheet part.
    let wb = r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="r"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>"#;
    let rels = r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/nope.xml"/></Relationships>"#;
    let z = make_zip(&[
        ("_rels/.rels", super::ROOT_RELS.as_bytes()),
        ("xl/workbook.xml", wb.as_bytes()),
        ("xl/_rels/workbook.xml.rels", rels.as_bytes()),
    ]);
    let (wb, rep) = read_xlsx(&z).unwrap();
    assert_eq!(wb.sheets.len(), 1);
    assert!(!rep.warnings.is_empty());
    // No root rels: falls back to xl/workbook.xml; no sheets → one empty sheet.
    let wb2 = r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>"#;
    let z = make_zip(&[("xl/workbook.xml", wb2.as_bytes())]);
    let (wb, rep) = read_xlsx(&z).unwrap();
    assert_eq!(wb.sheets.len(), 1);
    assert!(rep.warnings.iter().any(|w| w.contains("no worksheets")));
}

#[test]
fn huge_coordinates_and_dimensions() {
    let body = r#"<dimension ref="A1:XFD1048576"/><cols><col min="1" max="4000000000" width="1e308"/><col min="0" max="0"/></cols>
      <sheetData><row r="4294967295"><c r="A1"><v>1</v></c></row><row r="2000000"><c r="A2000000"><v>1</v></c></row>
      <row r="3"><c r="ZZZZ3"><v>1</v></c><c r="XFE3"><v>1</v></c><c r="XFD3"><v>7</v></c><c r="B3" s="99999"><v>nan</v></c><c r="C3" t="s"><v>-1</v></c><c r="D3" t="d"><v>9999-99-99</v></c></row>
      <row r="0"/></sheetData>
      <mergeCells><mergeCell ref="A1:XFD1048576"/><mergeCell ref="bogus"/></mergeCells>
      <hyperlinks><hyperlink ref="A1:XFD1048576" location="x"/></hyperlinks>
      <sheetViews><sheetView zoomScale="99999"><pane xSplit="1e9" ySplit="-5" state="frozen"/></sheetView></sheetViews>"#;
    let (wb, rep) = read_xlsx(&minimal(body, &[], "", "")).unwrap();
    let s = wb.sheet(0).unwrap();
    assert_eq!(s.value(gridcraft_core::CellRef::parse("XFD3").unwrap()), gridcraft_core::Value::Number(7.0));
    assert!(s.cells.len() <= 4);
    assert!(s.hyperlinks.len() <= 10_000);
    assert_eq!(s.zoom, 400);
    assert!(rep.warnings.iter().any(|w| w.contains("dropped")));
    // Still writable.
    let out = write_xlsx(&wb).unwrap();
    read_xlsx(&out).unwrap();
}

#[test]
fn deeply_nested_and_broken_xml() {
    let mut deep = String::from("<sheetData/><extLst>");
    for _ in 0..5000 {
        deep.push_str("<x>");
    }
    let (wb, rep) = read_xlsx(&minimal(&deep, &[], "", "")).unwrap();
    assert_eq!(wb.sheets.len(), 1);
    assert!(rep.warnings.iter().any(|w| w.contains("could not be read") || w.contains("damaged")));
    // Truncated sheet XML keeps earlier rows.
    let (wb, _) = read_xlsx(&minimal(r#"<sheetData><row r="1"><c r="A1"><v>5</v></c></row><row r="2"><c r="A2"><v"#, &[], "", "")).unwrap();
    assert_eq!(wb.sheet(0).unwrap().value(gridcraft_core::CellRef::new(0, 0)), gridcraft_core::Value::Number(5.0));
    // Broken optional parts are warnings.
    let rels = r#"<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>"#;
    let (_, rep) = read_xlsx(&minimal(
        "<sheetData/>",
        &[("xl/styles.xml", "<styleSheet><<<"), ("xl/theme/theme1.xml", "\u{0}\u{1}"), ("xl/sharedStrings.xml", "<sst><si><t>a</t></si><si><t>")],
        rels,
        "",
    ))
    .unwrap();
    assert!(!rep.warnings.is_empty());
    // Hostile drawing / table / comment references.
    let srels = r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../../../../etc/passwd"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/t.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../c.xml"/></Relationships>"#;
    let (_, rep) = read_xlsx(&minimal(
        r#"<sheetData/><drawing r:id="rId1"/><tableParts><tablePart r:id="rId2"/><tablePart r:id="rId9"/></tableParts>"#,
        &[
            ("xl/worksheets/_rels/sheet1.xml.rels", srels),
            ("xl/tables/t.xml", "<table ref='garbage'/>"),
            ("xl/c.xml", "<comments><commentList><comment ref='ZZZZZ99999999'/></commentList></comments>"),
        ],
        "",
        "",
    ))
    .unwrap();
    assert!(!rep.warnings.is_empty());
}

#[test]
fn zip_bomb_is_rejected() {
    // A part that inflates beyond the per-part cap: 600 MB of zeros compresses very well, but
    // building it takes a while, so test the cap via a declared size instead using a smaller
    // stand-in limit check on the reader path.
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).large_file(true);
    z.start_file("xl/workbook.xml", opts).unwrap();
    let chunk = vec![b' '; 1 << 20];
    for _ in 0..520 {
        z.write_all(&chunk).unwrap();
    }
    let bytes = z.finish().unwrap().into_inner();
    assert!(bytes.len() < 10 << 20);
    assert!(matches!(read_xlsx(&bytes), Err(IoError::TooLarge(_))));
}
