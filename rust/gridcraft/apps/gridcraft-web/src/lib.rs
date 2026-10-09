//! Embeddable browser UI and command API. The standalone binary is unchanged.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[cfg(target_arch = "wasm32")]
pub mod web;
#[cfg(target_arch = "wasm32")]
mod embed;
#[cfg(target_arch = "wasm32")]
pub use embed::*;
