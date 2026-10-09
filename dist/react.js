"use client";
import {createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState} from "react";
import {createSpreadsheet} from "./index.js";

export const Gridcraft = forwardRef(function Gridcraft({options, onReady, onChange, onError, style, className}, ref) {
  const canvasRef = useRef(null);
  const callbacks = useRef({onReady, onChange, onError});
  callbacks.current = {onReady, onChange, onError};
  const initialOptions = useRef(options);
  const [api, setApi] = useState(null);
  const [error, setError] = useState(null);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => {
    let cancelled = false;
    let instance;
    let unsubscribe;
    // Create a fresh canvas per effect so StrictMode's discarded async mount
    // never shares a canvas with the replacement instance.
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {width: "100%", height: "100%", display: "block"});
    canvas.setAttribute("aria-label", "Gridcraft spreadsheet");
    canvasRef.current.appendChild(canvas);
    createSpreadsheet(canvas, initialOptions.current).then((created) => {
      if (cancelled) { created.destroy(); return; }
      instance = created;
      unsubscribe = created.onChange((next) => callbacks.current.onChange?.(next));
      setApi(created);
      callbacks.current.onReady?.(created);
    }).catch((err) => {
      if (cancelled) return;
      setError(String(err.message ?? err));
      callbacks.current.onError?.(err);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      instance?.destroy();
      canvas.remove();
    };
  }, []);
  return createElement("div", {className, style: {position: "relative", width: "100%", height: 600, ...style}},
    createElement("div", {ref: canvasRef, style: {width: "100%", height: "100%"}}),
    error ? createElement("div", {role: "alert", style: {position: "absolute", inset: 0, background: "white", padding: 20}}, error) : null);
});
