//! Canvas embedding API. Independent of Gridcraft's standalone browser application.
#![cfg(target_arch = "wasm32")]
#![forbid(unsafe_code)]

mod services;

use std::{cell::RefCell, rc::Rc, sync::Arc};

use gridcraft_engine::{Session, model::Workbook};
use gridcraft_ui_egui::{Inbox, SheetApp};
use wasm_bindgen::prelude::*;

struct State {
    app: SheetApp,
    previous: Option<(u64, Arc<Workbook>)>,
    version: u32,
    disposed: bool,
}

impl State {
    fn changed(&mut self) {
        let current = self.app.session.active().map(|d| (d.uid, d.wb.clone()));
        let equal = match (&self.previous, &current) {
            (Some((a, aw)), Some((b, bw))) => a == b && Arc::ptr_eq(aw, bw),
            (None, None) => true,
            _ => false,
        };
        if !equal {
            self.version = self.version.wrapping_add(1);
            self.previous = current;
        }
    }
}

struct EmbeddedApp {
    state: Rc<RefCell<State>>,
    inbox: Inbox,
}

impl eframe::App for EmbeddedApp {
    fn logic(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let dropped = ctx.input_mut(|i| std::mem::take(&mut i.raw.dropped_files));
        for file in dropped {
            let inbox = self.inbox.clone();
            let ctx = ctx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let name = file.path().file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Book.xlsx".into());
                match file.bytes_async().await {
                    Ok(bytes) => {
                        inbox.lock().unwrap_or_else(|e| e.into_inner()).push((name, bytes));
                        ctx.request_repaint();
                    }
                    Err(e) => log::error!("couldn't read dropped file: {e}"),
                }
            });
        }
        if let Ok(mut state) = self.state.try_borrow_mut() {
            state.app.logic(ctx);
            state.changed();
        }
    }

    fn raw_input_hook(&mut self, _ctx: &egui::Context, raw: &mut egui::RawInput) {
        if let Ok(mut state) = self.state.try_borrow_mut() {
            state.app.raw_input_hook(raw);
        }
    }

    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        if let Ok(mut state) = self.state.try_borrow_mut() {
            state.app.ui(ui);
            state.changed();
        }
    }
}

/// Each handle owns one UI, workbook session, and web runner.
#[wasm_bindgen]
pub struct GridcraftHandle {
    runner: eframe::WebRunner,
    state: Rc<RefCell<State>>,
    ctx: egui::Context,
}

#[wasm_bindgen]
impl GridcraftHandle {
    /// JSON in/out keeps the engine's command schema intact.
    pub fn execute(&self, command: &str, params: &str) -> Result<String, JsValue> {
        let params = serde_json::from_str(params).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut state = self.state.try_borrow_mut().map_err(|_| JsValue::from_str("spreadsheet is busy"))?;
        if state.disposed {
            return Err(JsValue::from_str("spreadsheet was destroyed"));
        }
        let result = state.app.run(command, params).map_err(|e| JsValue::from_str(&e))?;
        state.changed();
        self.ctx.request_repaint();
        serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn commands(&self) -> Result<String, JsValue> {
        let state = self.state.try_borrow().map_err(|_| JsValue::from_str("spreadsheet is busy"))?;
        serde_json::to_string(&state.app.session.commands()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn version(&self) -> Result<u32, JsValue> {
        let state = self.state.try_borrow().map_err(|_| JsValue::from_str("spreadsheet is busy"))?;
        Ok(state.version)
    }

    pub fn destroy(&mut self) {
        if let Ok(mut state) = self.state.try_borrow_mut() {
            state.disposed = true;
        }
        self.runner.destroy();
    }
}

impl Drop for GridcraftHandle {
    fn drop(&mut self) {
        self.runner.destroy();
    }
}

/// Mount into a host-owned canvas. No global canvas id or URL query state.
#[wasm_bindgen]
pub async fn mount(canvas: web_sys::HtmlCanvasElement, sample: Option<String>, dark: bool, webgl: bool, cells_only: bool) -> Result<GridcraftHandle, JsValue> {
    let mut session = Session::new();
    let params = sample.map(|name| serde_json::json!({"sample": name})).unwrap_or_else(|| serde_json::json!({}));
    session.run("file.new", params).map_err(|e| JsValue::from_str(&e))?;
    let inbox = Inbox::default();
    let state = Rc::new(RefCell::new(State {
        app: SheetApp::new(session, Default::default()),
        previous: None,
        version: 0,
        disposed: false,
    }));
    let app_state = state.clone();
    let app_inbox = inbox.clone();
    let ctx_cell = Rc::new(RefCell::new(None));
    let app_ctx = ctx_cell.clone();
    let mut options = eframe::WebOptions::default();
    if webgl && let eframe::egui_wgpu::WgpuSetup::CreateNew(create) = &mut options.wgpu_options.wgpu_setup {
        create.instance_descriptor.backends = eframe::wgpu::Backends::GL;
    }
    let runner = eframe::WebRunner::new();
    let result = runner.start(canvas, options, Box::new(move |cc| {
        SheetApp::setup_context(&cc.egui_ctx, dark);
        let mut state = app_state.try_borrow_mut().map_err(|_| std::io::Error::other("spreadsheet is busy"))?;
        state.app.ui.dark = dark;
        state.app.ui.cells_only = cells_only;
        state.app.services = services::services(app_inbox.clone(), cc.egui_ctx.clone());
        state.changed();
        *app_ctx.try_borrow_mut().map_err(|_| std::io::Error::other("context is busy"))? = Some(cc.egui_ctx.clone());
        Ok(Box::new(EmbeddedApp { state: app_state.clone(), inbox: app_inbox.clone() }))
    })).await;
    if let Err(error) = result {
        runner.destroy();
        return Err(error);
    }
    let ctx = ctx_cell.try_borrow().map_err(|_| JsValue::from_str("context is busy"))?.clone().ok_or_else(|| JsValue::from_str("context was not initialized"))?;
    Ok(GridcraftHandle { runner, state, ctx })
}
