//! Conditional formatting evaluation: what extra style, data bar, colour scale or icon a cell
//! gets.

use std::collections::HashMap;

use gridcraft_core::{CellRef, RangeRef, Value, compare};
use gridcraft_model::*;

/// The conditional look of one cell.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CfLook {
    /// Differential style (only non-default parts apply).
    pub style: Option<Style>,
    /// Fill from a colour scale (RGB).
    pub scale_fill: Option<[u8; 3]>,
    /// Data bar: fraction 0..=1 of the cell width, colour, gradient.
    pub bar: Option<(f32, [u8; 3], bool)>,
    /// Icon: set name and index (0 = lowest).
    pub icon: Option<(String, usize)>,
    pub hide_value: bool,
}

/// Precomputed statistics per rule (min/max/percentiles/top-N thresholds/duplicates).
#[derive(Default)]
pub struct CfCache {
    stats: HashMap<usize, RuleStats>,
}

#[derive(Default, Clone)]
struct RuleStats {
    sorted: Vec<f64>,
    avg: f64,
    std: f64,
    counts: HashMap<String, usize>,
}

fn numbers_in(sh: &Sheet, ranges: &[RangeRef]) -> (Vec<f64>, HashMap<String, usize>) {
    let mut nums = Vec::new();
    let mut counts = HashMap::new();
    for r in ranges {
        let r = match sh.used_range().and_then(|u| r.intersection(&u)) {
            Some(x) => x,
            None => continue,
        };
        for c in r.iter().take(2_000_000) {
            let v = sh.value(c);
            if let Value::Number(n) = v {
                nums.push(n);
            }
            if !v.is_empty() {
                *counts.entry(v.display().to_lowercase()).or_insert(0) += 1;
            }
        }
    }
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    (nums, counts)
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let rank = (p / 100.0).clamp(0.0, 1.0) * (sorted.len() - 1) as f64;
    let lo = rank.floor() as usize;
    let hi = rank.ceil() as usize;
    let a = sorted.get(lo).copied().unwrap_or(0.0);
    let b = sorted.get(hi).copied().unwrap_or(a);
    a + (b - a) * (rank - lo as f64)
}

fn threshold(wb: &Workbook, sheet: usize, at: CellRef, st: &RuleStats, k: &CfValueKind) -> f64 {
    let min = st.sorted.first().copied().unwrap_or(0.0);
    let max = st.sorted.last().copied().unwrap_or(0.0);
    match k {
        CfValueKind::Min => min,
        CfValueKind::Max => max,
        CfValueKind::Number(n) => *n,
        CfValueKind::Percent(p) => min + (max - min) * p / 100.0,
        CfValueKind::Percentile(p) => percentile(&st.sorted, *p),
        CfValueKind::Formula(f) => gridcraft_calc::evaluate(wb, sheet, at, f).to_number().unwrap_or(0.0),
    }
}

fn lerp(a: [u8; 3], b: [u8; 3], t: f64) -> [u8; 3] {
    let t = t.clamp(0.0, 1.0);
    [
        (a[0] as f64 + (b[0] as f64 - a[0] as f64) * t).round() as u8,
        (a[1] as f64 + (b[1] as f64 - a[1] as f64) * t).round() as u8,
        (a[2] as f64 + (b[2] as f64 - a[2] as f64) * t).round() as u8,
    ]
}

/// Number of icons in a set name like `3TrafficLights1`, `5Quarters`.
pub fn icon_count(set: &str) -> usize {
    set.chars().next().and_then(|c| c.to_digit(10)).unwrap_or(3) as usize
}

impl CfCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Conditional look of `c`, or `None` when no rule applies.
    pub fn look(&mut self, wb: &Workbook, sheet: usize, c: CellRef) -> Option<CfLook> {
        let sh = wb.sheet(sheet)?;
        if sh.cond_formats.is_empty() {
            return None;
        }
        let mut out = CfLook::default();
        let mut any = false;
        let mut rules: Vec<(usize, &CondFormat)> =
            sh.cond_formats.iter().enumerate().filter(|(_, cf)| cf.ranges.iter().any(|r| r.contains(c))).collect();
        rules.sort_by_key(|(_, cf)| cf.priority);
        let v = sh.value(c);
        for (idx, cf) in rules {
            let first = cf.ranges.first().map(|r| r.start).unwrap_or(c);
            let st = self
                .stats
                .entry(idx)
                .or_insert_with(|| {
                    let (sorted, counts) = numbers_in(sh, &cf.ranges);
                    let n = sorted.len().max(1) as f64;
                    let avg = sorted.iter().sum::<f64>() / n;
                    let std = (sorted.iter().map(|x| (x - avg).powi(2)).sum::<f64>() / n).sqrt();
                    RuleStats { sorted, avg, std, counts }
                })
                .clone();
            let text = v.display();
            let matched_style: Option<&Style> = match &cf.rule {
                CfRule::CellIs { op, a, b, style } => {
                    let eval = |f: &str| gridcraft_calc::evaluate(wb, sheet, c, &relative(f, first, c));
                    let av = eval(a);
                    let ok = match op {
                        CfOperator::Between | CfOperator::NotBetween => {
                            let bv = b.as_deref().map(eval).unwrap_or_default();
                            let (lo, hi) = if compare(&av, &bv) == std::cmp::Ordering::Greater { (bv, av) } else { (av, bv) };
                            let inside = compare(&v, &lo) != std::cmp::Ordering::Less && compare(&v, &hi) != std::cmp::Ordering::Greater;
                            if *op == CfOperator::Between { inside } else { !inside }
                        }
                        CfOperator::Equal => compare(&v, &av) == std::cmp::Ordering::Equal,
                        CfOperator::NotEqual => compare(&v, &av) != std::cmp::Ordering::Equal,
                        CfOperator::Greater => compare(&v, &av) == std::cmp::Ordering::Greater,
                        CfOperator::Less => compare(&v, &av) == std::cmp::Ordering::Less,
                        CfOperator::GreaterOrEqual => compare(&v, &av) != std::cmp::Ordering::Less,
                        CfOperator::LessOrEqual => compare(&v, &av) != std::cmp::Ordering::Greater,
                    };
                    (ok && !v.is_empty()).then_some(style.as_ref())
                }
                CfRule::Expression { formula, style } => {
                    gridcraft_calc::evaluate(wb, sheet, c, &relative(formula, first, c)).to_bool().unwrap_or(false).then_some(style.as_ref())
                }
                CfRule::ContainsText { text: t, style } => text.to_lowercase().contains(&t.to_lowercase()).then_some(style.as_ref()),
                CfRule::NotContainsText { text: t, style } => (!text.to_lowercase().contains(&t.to_lowercase())).then_some(style.as_ref()),
                CfRule::BeginsWith { text: t, style } => text.to_lowercase().starts_with(&t.to_lowercase()).then_some(style.as_ref()),
                CfRule::EndsWith { text: t, style } => text.to_lowercase().ends_with(&t.to_lowercase()).then_some(style.as_ref()),
                CfRule::Blanks { style } => (v.is_empty() || text.trim().is_empty()).then_some(style.as_ref()),
                CfRule::NoBlanks { style } => (!v.is_empty()).then_some(style.as_ref()),
                CfRule::Errors { style } => v.is_error().then_some(style.as_ref()),
                CfRule::NoErrors { style } => (!v.is_error()).then_some(style.as_ref()),
                CfRule::Duplicate { style } => {
                    (!v.is_empty() && st.counts.get(&text.to_lowercase()).copied().unwrap_or(0) > 1).then_some(style.as_ref())
                }
                CfRule::Unique { style } => {
                    (!v.is_empty() && st.counts.get(&text.to_lowercase()).copied().unwrap_or(0) == 1).then_some(style.as_ref())
                }
                CfRule::Top10 { bottom, percent, rank, style } => match v.as_f64() {
                    Some(n) if !st.sorted.is_empty() => {
                        let k = if *percent { ((st.sorted.len() as f64) * (*rank as f64) / 100.0).floor().max(1.0) as usize } else { *rank as usize };
                        let k = k.clamp(1, st.sorted.len());
                        let ok = if *bottom {
                            n <= st.sorted.get(k - 1).copied().unwrap_or(n)
                        } else {
                            n >= st.sorted.get(st.sorted.len() - k).copied().unwrap_or(n)
                        };
                        ok.then_some(style.as_ref())
                    }
                    _ => None,
                },
                CfRule::AboveAverage { below, equal, std_dev, style } => match v.as_f64() {
                    Some(n) => {
                        let thr = st.avg + if *below { -1.0 } else { 1.0 } * st.std * *std_dev as f64;
                        let ok = if *below { n < thr || (*equal && n == thr) } else { n > thr || (*equal && n == thr) };
                        ok.then_some(style.as_ref())
                    }
                    None => None,
                },
                CfRule::TimePeriod { period, style } => match v.as_f64() {
                    Some(n) => {
                        let today = gridcraft_calc::now_serial().floor();
                        let d = n.floor();
                        let wd = gridcraft_core::date::datetime_from_serial(wb.date_system, today).map(|x| x.weekday as f64).unwrap_or(0.0);
                        let week_start = today - wd;
                        let (ty, tm) =
                            gridcraft_core::date::datetime_from_serial(wb.date_system, today).map(|x| (x.year, x.month)).unwrap_or((2026, 1));
                        let ym = gridcraft_core::date::datetime_from_serial(wb.date_system, d).map(|x| (x.year, x.month));
                        let month_off = |k: i32| {
                            let m = tm as i32 + k;
                            let y = ty + (m - 1).div_euclid(12);
                            let m = (m - 1).rem_euclid(12) + 1;
                            ym == Some((y, m as u32))
                        };
                        let ok = match period.as_str() {
                            "yesterday" => d == today - 1.0,
                            "today" => d == today,
                            "tomorrow" => d == today + 1.0,
                            "last7Days" => d > today - 7.0 && d <= today,
                            "lastWeek" => d >= week_start - 7.0 && d < week_start,
                            "thisWeek" => d >= week_start && d < week_start + 7.0,
                            "nextWeek" => d >= week_start + 7.0 && d < week_start + 14.0,
                            "lastMonth" => month_off(-1),
                            "thisMonth" => month_off(0),
                            "nextMonth" => month_off(1),
                            _ => false,
                        };
                        ok.then_some(style.as_ref())
                    }
                    None => None,
                },
                CfRule::ColorScale { stops } => {
                    if let Some(n) = v.as_f64() {
                        let pts: Vec<(f64, [u8; 3])> = stops
                            .iter()
                            .map(|(k, col)| (threshold(wb, sheet, c, &st, k), col.resolve(&wb.theme).unwrap_or([255, 255, 255])))
                            .collect();
                        let rgb = match pts.as_slice() {
                            [(a, ca), (b, cb)] => lerp(*ca, *cb, if b > a { (n - a) / (b - a) } else { 0.0 }),
                            [(a, ca), (m, cm), (b, cb)] => {
                                if n <= *m {
                                    lerp(*ca, *cm, if m > a { (n - a) / (m - a) } else { 0.0 })
                                } else {
                                    lerp(*cm, *cb, if b > m { (n - m) / (b - m) } else { 1.0 })
                                }
                            }
                            _ => [255, 255, 255],
                        };
                        if out.scale_fill.is_none() {
                            out.scale_fill = Some(rgb);
                            any = true;
                        }
                    }
                    None
                }
                CfRule::DataBar { min, max, color, gradient, show_value } => {
                    if let Some(n) = v.as_f64() {
                        let lo = threshold(wb, sheet, c, &st, min);
                        let hi = threshold(wb, sheet, c, &st, max);
                        let lo = if lo > 0.0 { 0.0 } else { lo };
                        let frac = if hi > lo { ((n - lo) / (hi - lo)).clamp(0.0, 1.0) } else { 1.0 };
                        if out.bar.is_none() {
                            out.bar = Some((
                                (frac as f32) * 0.9 + 0.1 * (frac > 0.0) as u8 as f32,
                                color.resolve(&wb.theme).unwrap_or([0x63, 0x8E, 0xC6]),
                                *gradient,
                            ));
                            out.hide_value |= !show_value;
                            any = true;
                        }
                    }
                    None
                }
                CfRule::IconSet { set, thresholds, reverse, show_value } => {
                    if let Some(n) = v.as_f64() {
                        let k = icon_count(set);
                        let cuts: Vec<f64> = if thresholds.len() + 1 == k {
                            thresholds.iter().map(|t| threshold(wb, sheet, c, &st, t)).collect()
                        } else {
                            (1..k).map(|i| percentile(&st.sorted, i as f64 * 100.0 / k as f64)).collect()
                        };
                        let mut idx = cuts.iter().filter(|cut| n >= **cut).count();
                        if *reverse {
                            idx = k - 1 - idx.min(k - 1);
                        }
                        if out.icon.is_none() {
                            out.icon = Some((set.clone(), idx.min(k - 1)));
                            out.hide_value |= !show_value;
                            any = true;
                        }
                    }
                    None
                }
            };
            if let Some(st) = matched_style {
                any = true;
                out.style = Some(match out.style.take() {
                    None => st.clone(),
                    Some(prev) => prev,
                });
                if cf.stop_if_true {
                    break;
                }
            }
        }
        any.then_some(out)
    }
}

/// Shifts a rule formula written for the top-left cell of the range to `c`.
fn relative(f: &str, first: CellRef, c: CellRef) -> String {
    if first == c {
        return f.to_string();
    }
    match gridcraft_formula::parse(f.trim_start_matches('=')) {
        Ok(e) => {
            gridcraft_formula::print(&gridcraft_formula::adjust::shift_relative(e, c.row as i64 - first.row as i64, c.col as i64 - first.col as i64))
        }
        Err(_) => f.to_string(),
    }
}
