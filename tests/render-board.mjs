import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
// Load before the per-test DOM so Node uses server defaults without browser cache-GC timers.
import '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { createServer } from 'vite';
import { act, createElement, StrictMode } from 'react';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';
import { readFile } from 'node:fs/promises';

function streamingEventSource(nativeFetch, url, inAct, sources) {
  return class StreamingEventSource {
    constructor(path) {
      this.listeners = new Map();
      this.controller = new AbortController();
      this.closed = false;
      sources.push(this);
      void this.read(new URL(path, url));
    }
    addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
    close() { this.closed = true; this.controller.abort(); }
    emit(name) { for (const listener of this.listeners.get(name) ?? []) listener({ type: name }); }
    async read(address) {
      try {
        const response = await nativeFetch(address, { signal: this.controller.signal });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
            const name = /^event: (.*)$/m.exec(buffer.slice(0, end))?.[1];
            buffer = buffer.slice(end + 2);
            if (name && !this.closed) await inAct(() => this.emit(name));
          }
        }
        if (!this.closed) await inAct(() => this.emit('error'));
      } catch { if (!this.closed) await inAct(() => this.emit('error')); }
    }
  };
}

/**
 * Renders the real production App against a real server and temporary files. With `live`, the app also receives
 * the server's event stream through a fetch-based EventSource, since jsdom provides none.
 */
export async function renderBoard(t, files, editable = false, { live = false, address = 'http://localhost/', mapGeometry = false } = {}) {
  const folder = await fixture(t, files);
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  const dom = new JSDOM('<div id="root"></div>', { url: address, virtualConsole });
  dom.window.matchMedia = (query) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  dom.window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = clearTimeout;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(element) { queueMicrotask(() => { if (!this.closed) this.callback([{ target: element, boundingClientRect: element.getBoundingClientRect(), intersectionRect: element.getBoundingClientRect(), isIntersecting: true, intersectionRatio: 1 }]); }); }
    unobserve() {}
    disconnect() { this.closed = true; }
  };
  dom.window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const measurements = [];
  if (mapGeometry) {
    const style = dom.window.document.createElement('style');
    style.textContent = await readFile(new URL('../node_modules/@xyflow/react/dist/style.css', import.meta.url), 'utf8');
    dom.window.document.head.append(style);
    // A deterministic browser geometry adapter for the real React Flow canvas. Browser checks cover
    // physical pointer placement; this seam verifies its controlled-node measurement contract.
    dom.window.DOMMatrixReadOnly = class {
      constructor() { this.m22 = 1; }
    };
    Object.defineProperties(dom.window.HTMLElement.prototype, {
      offsetWidth: { get() { return this.classList.contains('react-flow__node') ? 224 : 700; }, configurable: true },
      offsetHeight: { get() { return this.classList.contains('react-flow__node') ? 90 : 500; }, configurable: true },
      clientWidth: { get() { return this.offsetWidth; }, configurable: true },
      clientHeight: { get() { return this.offsetHeight; }, configurable: true },
    });
    dom.window.ResizeObserver = class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); }
      observe(target) {
        this.targets.add(target);
        measurements.push(target);
        queueMicrotask(() => { if (this.targets.has(target)) this.callback([{ target, contentRect: { width: target.offsetWidth, height: target.offsetHeight } }]); });
      }
      unobserve(target) { this.targets.delete(target); }
      disconnect() { this.targets.clear(); }
    };
  }
  dom.window.document.elementFromPoint = () => dom.window.document.body;
  dom.window.document.elementsFromPoint = () => [dom.window.document.body];
  dom.window.document.getAnimations = () => [];
  dom.window.HTMLElement.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, finish() {} });
  dom.window.HTMLElement.prototype.getAnimations = () => [];
  // Node fetch needs Node's AbortController; DOM listeners need signals from their own realm.
  const addListener = dom.window.EventTarget.prototype.addEventListener;
  dom.window.EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (options?.signal && !(options.signal instanceof dom.window.AbortSignal)) {
      const controller = new dom.window.AbortController();
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      options = { ...options, signal: controller.signal };
    }
    return addListener.call(this, type, listener, options);
  };
  const globals = { FormData: dom.window.FormData, PointerEvent: dom.window.PointerEvent ?? dom.window.MouseEvent, IntersectionObserver: dom.window.IntersectionObserver, Document: dom.window.Document, ShadowRoot: dom.window.ShadowRoot, SVGElement: dom.window.SVGElement, KeyboardEvent: dom.window.KeyboardEvent, MouseEvent: dom.window.MouseEvent, CSS: { escape: (value) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) }, getComputedStyle: dom.window.getComputedStyle, Node: dom.window.Node, Element: dom.window.Element, HTMLInputElement: dom.window.HTMLInputElement, MutationObserver: dom.window.MutationObserver, requestAnimationFrame: dom.window.requestAnimationFrame, cancelAnimationFrame: dom.window.cancelAnimationFrame, ResizeObserver: dom.window.ResizeObserver, window: dom.window, location: dom.window.location, history: dom.window.history, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  let sessionToken;
  let server;
  const sources = [];
  if (editable) {
    const started = await startServer(folder);
    const url = started.url;
    server = started.server;
    t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
    const nativeFetch = globalThis.fetch;
    sessionToken = (await (await nativeFetch(`${url}/api/context`)).json()).sessionToken;
    globals.fetch = (path, options) => nativeFetch(new URL(path, url), options);
    if (live) globals.EventSource = streamingEventSource(nativeFetch, url, (callback) => act(callback), sources);
  }
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  dom.window.confirm = () => true;
  Object.assign(globalThis, globals);
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', ssr: { noExternal: ['nuqs', '@fontsource-variable/ibm-plex-sans', '@fontsource/ibm-plex-mono', '@fontsource-variable/roboto-condensed'] } });
  const { App } = await vite.ssrLoadModule('/App.tsx');
  const { ClientProviders, createClientRouter } = await vite.ssrLoadModule('/ClientState.tsx');
  const router = createClientRouter(createElement(App));
  const root = createRoot(document.getElementById('root'));
  let mounted = true;
  const unmount = async () => { if (mounted) { mounted = false; await act(async () => root.unmount()); } };
  t.after(async () => {
    await unmount();
    router.dispose();
    // Let queued router/query notifications settle while their browser globals still exist.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
    await vite.close();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const tree = createElement(ClientProviders, {}, createElement(RouterProvider, { router }));
  await act(async () => root.render(createElement(StrictMode, {}, tree)));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
  return {
    options: async (element) => {
      assert.ok(element, 'combobox exists');
      const statusTrigger = [...dom.window.document.querySelectorAll('button[aria-label]')].find((button) => button.getAttribute('aria-label') === element.getAttribute('aria-label'));
      if (statusTrigger && element.closest('[hidden]')) await act(async () => { statusTrigger.click(); await new Promise((resolve) => setTimeout(resolve, 100)); });
      await act(async () => { element.parentElement.querySelector('button').click(); await new Promise((resolve) => setTimeout(resolve, 30)); });
      const list = dom.window.document.getElementById(element.getAttribute('aria-controls'));
      const names = [...list.querySelectorAll('[role="option"]')].map((option) => option.textContent);
      await act(async () => { element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      return names;
    },
    folder, document: dom.window.document, sources, server, unmount, measurements,
    until: async (predicate, label, timeout = 8000) => {
      const deadline = Date.now() + timeout;
      while (!predicate()) {
        assert.ok(Date.now() < deadline, `Timed out waiting for ${label}`);
        await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
      }
    },
    click: async (element) => { assert.ok(element, 'click target exists'); await act(async () => { element.click(); await new Promise((resolve) => setTimeout(resolve, 250)); }); },
    change: async (element, value) => {
      assert.ok(element, 'input exists');
      if (element.getAttribute('role') === 'combobox') {
        const statusTrigger = [...dom.window.document.querySelectorAll('button[aria-label]')].find((button) => button.getAttribute('aria-label') === element.getAttribute('aria-label'));
        if (statusTrigger && element.closest('[hidden]')) await act(async () => { statusTrigger.click(); await new Promise((resolve) => setTimeout(resolve, 100)); });
        for (let attempt = 0; element.disabled && attempt < 100; attempt++) await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
        assert.equal(element.disabled, false, 'picker is ready');
        const trigger = element.parentElement.querySelector('button');
        await act(async () => { trigger.click(); await new Promise((resolve) => setTimeout(resolve, 30)); });
        const options = [...dom.window.document.getElementById(element.getAttribute('aria-controls')).querySelectorAll('[role="option"]')];
        const option = options.find((node) => node.textContent === value);
        assert.ok(option, `available choice: ${value}`);
        await act(async () => { option.click(); await new Promise((resolve) => setTimeout(resolve, 100)); });
        return;
      }
      await act(async () => {
        const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
    },
    settled: async () => {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
      for (let attempt = 0; attempt < 100 && dom.window.document.querySelector('[aria-busy="true"]'); attempt++) {
        await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
      }
      assert.equal(dom.window.document.querySelector('[aria-busy="true"]'), null, 'status operation finishes');
    },
  };
}
