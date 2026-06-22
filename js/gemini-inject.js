/* gemini-inject.js — content script on gemini.google.com/app
 *
 * The new-tab search box (engine = Gemini) stores the query in
 * chrome.storage.local then opens this page. Gemini does NOT read ?prompt= or
 * ?q= natively, so we inject the text into its input here, simulating native
 * input/textInput events (Angular/Quill won't react to a bare `.value =`).
 *
 * Behaviour: auto-focus, NO auto-submit. One-shot — the query is cleared after
 * use and ignored if older than the TTL (avoids re-injecting on later visits).
 */
(function () {
  "use strict";
  const TTL_MS = 60000;

  function getQuery(cb) {
    try {
      chrome.storage.local.get({ geminiQuery: null }, (r) => {
        const item = r && r.geminiQuery;
        if (!item || !item.q) return cb(null);
        chrome.storage.local.remove("geminiQuery"); // one-shot
        if (Date.now() - (item.ts || 0) > TTL_MS) return cb(null);
        cb(item.q);
      });
    } catch (e) { cb(null); }
  }

  function findEditor() {
    const sels = [
      "rich-textarea .ql-editor[contenteditable='true']",
      "div.ql-editor[contenteditable='true']",
      "[contenteditable='true'][role='textbox']",
      "textarea[aria-label]",
      "textarea",
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function injectInto(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    // contenteditable (Quill / Angular rich-textarea)
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* ignore */ }

    el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    // execCommand triggers the framework's native input pipeline reliably
    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch (e) { ok = false; }
    if (!ok || el.textContent.indexOf(text) === -1) {
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // place caret at end, keep focus
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* ignore */ }
    el.focus();
  }

  function run(text) {
    let tries = 0;
    const max = 60; // ~12s at 200ms
    const timer = setInterval(() => {
      const el = findEditor();
      if (el) {
        clearInterval(timer);
        // a short settle delay lets Angular finish wiring the editor
        setTimeout(() => { try { injectInto(el, text); } catch (e) { console.warn("[gemini-inject]", e); } }, 120);
      } else if (++tries >= max) {
        clearInterval(timer);
      }
    }, 200);
  }

  getQuery((q) => { if (q) run(q); });
})();
