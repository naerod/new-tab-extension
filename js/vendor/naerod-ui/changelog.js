/* Copie du module partage naerod-ui/ui/src/changelog.js (v1.1.x). Ecarts : import ./icons.js (police locale) ; .icon{text-transform:none} (la ligature « check » cassait sous .now en majuscules). */
/**
 * <naerod-changelog> et <naerod-version> — journal des versions partage.
 *
 * Meme principe que <naerod-header> : le site n apporte QUE ses donnees
 * (`changelog.json`), jamais le rendu. Une evolution du journal se fait ici,
 * une fois, pour tous les sites.
 *
 *   <naerod-changelog src="/changelog.json"></naerod-changelog>
 *   <naerod-version src="/changelog.json" env-src="/api/version"></naerod-version>
 *
 * Format de `changelog.json` (identique sur tous les sites) :
 *   { "versions": [ { "v":"1.5", "date":"2026-09-20",
 *                     "title": {"fr":"…","en":"…"},
 *                     "fr": ["…"], "en": ["…"] } ] }
 * Les langues absentes retombent sur `en` puis `fr`.
 */
import { STRINGS } from "./strings.js";
import { ensureIconFont } from "./icons.js";

const CL_STRINGS = {
  en: { nrd_cl_title:"Changelog", nrd_cl_sub:"Every change to the site, version by version.", nrd_cl_current:"current", nrd_cl_error:"Could not load the changelog.", nrd_cl_empty:"No version published yet.", nrd_cl_loading:"Loading the changelog…", nrd_cl_badge:"Version %s — see the changelog" },
  fr: { nrd_cl_title:"Journal des versions", nrd_cl_sub:"Toutes les évolutions du site, version par version.", nrd_cl_current:"actuelle", nrd_cl_error:"Impossible de charger le journal des versions.", nrd_cl_empty:"Aucune version publiée pour l'instant.", nrd_cl_loading:"Chargement du journal des versions…", nrd_cl_badge:"Version %s — voir le journal des versions" },
  ja: { nrd_cl_title:"変更履歴", nrd_cl_sub:"バージョンごとのすべての変更点。", nrd_cl_current:"現在", nrd_cl_error:"変更履歴を読み込めませんでした。", nrd_cl_empty:"公開されたバージョンはまだありません。", nrd_cl_loading:"変更履歴を読み込み中…", nrd_cl_badge:"バージョン %s — 変更履歴を見る" },
  pt: { nrd_cl_title:"Registo de alterações", nrd_cl_sub:"Todas as mudanças do site, versão a versão.", nrd_cl_current:"atual", nrd_cl_error:"Não foi possível carregar o registo de alterações.", nrd_cl_empty:"Ainda não há nenhuma versão publicada.", nrd_cl_loading:"A carregar o registo de alterações…", nrd_cl_badge:"Versão %s — ver o registo de alterações" },
  es: { nrd_cl_title:"Registro de cambios", nrd_cl_sub:"Todos los cambios del sitio, versión a versión.", nrd_cl_current:"actual", nrd_cl_error:"No se ha podido cargar el registro de cambios.", nrd_cl_empty:"Todavía no hay ninguna versión publicada.", nrd_cl_loading:"Cargando el registro de cambios…", nrd_cl_badge:"Versión %s — ver el registro de cambios" },
  ko: { nrd_cl_title:"변경 이력", nrd_cl_sub:"버전별 사이트의 모든 변경 사항입니다.", nrd_cl_current:"현재", nrd_cl_error:"변경 이력을 불러올 수 없습니다.", nrd_cl_empty:"아직 게시된 버전이 없습니다.", nrd_cl_loading:"변경 이력을 불러오는 중…", nrd_cl_badge:"버전 %s — 변경 이력 보기" },
  zh: { nrd_cl_title:"更新日志", nrd_cl_sub:"按版本列出的所有网站改动。", nrd_cl_current:"当前", nrd_cl_error:"无法加载更新日志。", nrd_cl_empty:"尚未发布任何版本。", nrd_cl_loading:"正在加载更新日志…", nrd_cl_badge:"版本 %s — 查看更新日志" },
  de: { nrd_cl_title:"Änderungsprotokoll", nrd_cl_sub:"Alle Änderungen der Website, Version für Version.", nrd_cl_current:"aktuell", nrd_cl_error:"Das Änderungsprotokoll konnte nicht geladen werden.", nrd_cl_empty:"Bisher wurde keine Version veröffentlicht.", nrd_cl_loading:"Änderungsprotokoll wird geladen…", nrd_cl_badge:"Version %s — Änderungsprotokoll ansehen" },
  it: { nrd_cl_title:"Registro delle modifiche", nrd_cl_sub:"Tutte le novità del sito, versione per versione.", nrd_cl_current:"attuale", nrd_cl_error:"Impossibile caricare il registro delle modifiche.", nrd_cl_empty:"Nessuna versione pubblicata per ora.", nrd_cl_loading:"Caricamento del registro delle modifiche…", nrd_cl_badge:"Versione %s — vedi il registro delle modifiche" },
  id: { nrd_cl_title:"Catatan perubahan", nrd_cl_sub:"Semua perubahan situs, versi demi versi.", nrd_cl_current:"saat ini", nrd_cl_error:"Tidak dapat memuat catatan perubahan.", nrd_cl_empty:"Belum ada versi yang dirilis.", nrd_cl_loading:"Memuat catatan perubahan…", nrd_cl_badge:"Versi %s — lihat catatan perubahan" },
};

/** Langue courante — meme source que <naerod-header>. */
function lang() {
  const l = localStorage.getItem("lang") || document.documentElement.lang || "fr";
  return CL_STRINGS[l] ? l : (CL_STRINGS[l.slice(0, 2)] ? l.slice(0, 2) : "en");
}

/**
 * Traduction : le site d abord (evenement `naerod:i18n`), puis le dictionnaire
 * partage. Un site peut donc personnaliser un libelle sans forker le composant.
 */
function t(el, key) {
  const ev = new CustomEvent("naerod:i18n", {
    bubbles: true, composed: true, detail: { key, lang: lang(), text: null },
  });
  el.dispatchEvent(ev);
  if (ev.detail.text) return ev.detail.text;
  const l = lang();
  return (CL_STRINGS[l] && CL_STRINGS[l][key])
      || (STRINGS[l] && STRINGS[l][key])
      || CL_STRINGS.en[key] || key;
}

/** Texte d une entree dans la langue courante, avec repli en -> fr. */
function pick(obj, l) {
  if (!obj) return null;
  return obj[l] || obj.en || obj.fr || null;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

/** Date localisee — jamais formatee a la main (regle DA). */
function fmtDate(iso, l) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  try { return new Intl.DateTimeFormat(l, { day:"numeric", month:"long", year:"numeric" }).format(d); }
  catch { return iso; }
}

const CSS = `
:host{display:block;color:var(--nrd-fg,#e8e8e8);font-family:var(--nrd-font,"Google Sans Flex",system-ui,sans-serif)}
*{box-sizing:border-box}
.wrap{max-width:var(--nrd-cl-max,760px);margin:0 auto;padding:0 16px}
h1{display:flex;align-items:center;gap:10px;margin:0 0 4px;font-size:1.8rem;line-height:1.2}
.sub{margin:0 0 32px;color:var(--nrd-muted,#9aa0a6);max-width:70ch}
.icon{text-transform:none;font-family:"Material Symbols Outlined";font-size:1.6rem;line-height:1;
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}
ol{list-style:none;margin:0;padding:0 0 0 26px;position:relative}
ol::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;
  background:var(--nrd-border,#2a2d31)}
li{position:relative;margin:0 0 28px}
li::before{content:"";position:absolute;left:-26px;top:7px;width:14px;height:14px;border-radius:50%;
  background:var(--nrd-bg,#16181b);border:2px solid var(--nrd-border,#2a2d31)}
li.latest::before{background:var(--nrd-accent,#1db954);border-color:var(--nrd-accent,#1db954)}
.head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.v{font-weight:700;font-size:1.15rem;color:var(--nrd-accent,#1db954)}
.now{display:inline-flex;align-items:center;gap:4px;padding:1px 9px;border-radius:999px;
  border:1px solid var(--nrd-accent,#1db954);color:var(--nrd-accent,#1db954);
  font-size:.7rem;text-transform:uppercase;letter-spacing:.5px}
.date{margin-left:auto;color:var(--nrd-muted,#9aa0a6);font-size:.85rem}
.title{margin:2px 0 8px;font-weight:600;color:var(--nrd-fg,#e8e8e8)}
ul{margin:0;padding-left:20px;line-height:1.55}
ul li{margin:0 0 6px;position:static}
ul li::before{content:none}
.state{color:var(--nrd-muted,#9aa0a6);display:flex;align-items:center;gap:8px}
.skel{height:14px;border-radius:7px;background:var(--nrd-border,#2a2d31);opacity:.6;
  animation:p 1.2s ease-in-out infinite}
.skel.w1{width:38%;margin:0 0 10px}.skel.w2{width:85%;margin:0 0 8px}.skel.w3{width:62%;margin:0 0 28px}
@keyframes p{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.skel{animation:none}}
@media (max-width:420px){.date{margin-left:0;width:100%}}
`;

class NaerodChangelog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._state = "loading";
    this._onLang = () => this._render();
  }

  connectedCallback() {
    ensureIconFont();
    document.addEventListener("naerod:langchange", this._onLang);
    document.addEventListener("langchange", this._onLang); // compat sites existants
    this._render();
    this._load();
  }

  disconnectedCallback() {
    document.removeEventListener("naerod:langchange", this._onLang);
    document.removeEventListener("langchange", this._onLang);
  }

  get src() { return this.getAttribute("src") || "/changelog.json"; }

  async _load() {
    try {
      const r = await fetch(this.src, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      this._data = Array.isArray(d.versions) ? d.versions : [];
      this._state = this._data.length ? "ready" : "empty";
      // La version en tete est la version courante — meme source unique.
      if (this._data[0]) {
        document.dispatchEvent(new CustomEvent("naerod:version",
          { detail: { version: this._data[0].v } }));
      }
    } catch {
      this._state = "error";
    }
    this._render();
  }

  _render() {
    const l = lang();
    const heading = this.hasAttribute("no-heading") ? "" : `
      <h1><span class="icon" aria-hidden="true">history</span>${esc(t(this, "nrd_cl_title"))}</h1>
      <p class="sub">${esc(t(this, "nrd_cl_sub"))}</p>`;

    let body;
    if (this._state === "loading") {
      body = `<div aria-busy="true" aria-live="polite" aria-label="${esc(t(this,"nrd_cl_loading"))}">` +
        Array.from({ length: 3 }, () =>
          `<div class="skel w1"></div><div class="skel w2"></div><div class="skel w3"></div>`).join("") +
        `</div>`;
    } else if (this._state === "error") {
      body = `<p class="state"><span class="icon" aria-hidden="true">error</span>${esc(t(this,"nrd_cl_error"))}</p>`;
    } else if (this._state === "empty") {
      body = `<p class="state"><span class="icon" aria-hidden="true">inbox</span>${esc(t(this,"nrd_cl_empty"))}</p>`;
    } else {
      const cur = this.getAttribute("current");
      body = `<ol>` + this._data.map((e, i) => {
        const isNow = cur ? String(cur).indexOf(e.v) === 0 : i === 0;
        const items = (pick(e, l) || []).map((x) => `<li>${esc(x)}</li>`).join("");
        const title = pick(e.title, l);
        return `<li class="${i === 0 ? "latest" : ""}">
          <div class="head">
            <span class="v">v${esc(e.v)}</span>
            ${isNow ? `<span class="now"><span class="icon" style="font-size:.85rem" aria-hidden="true">check</span>${esc(t(this,"nrd_cl_current"))}</span>` : ""}
            <span class="date">${esc(fmtDate(e.date, l))}</span>
          </div>
          ${title ? `<p class="title">${esc(title)}</p>` : ""}
          ${items ? `<ul>${items}</ul>` : ""}
        </li>`;
      }).join("") + `</ol>`;
    }

    document.documentElement.lang = l;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="wrap">${heading}${body}</div>`;
  }
}

const BADGE_CSS = `
:host{display:inline-block}
a{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;
  border:1px solid var(--nrd-border,#2a2d31);color:var(--nrd-muted,#9aa0a6);
  font-family:var(--nrd-font,"Google Sans Code",ui-monospace,monospace);
  font-size:.75rem;text-decoration:none;font-variant-numeric:tabular-nums;line-height:1.7}
a:hover{color:var(--nrd-fg,#e8e8e8);border-color:var(--nrd-accent,#1db954)}
a:focus-visible{outline:2px solid var(--nrd-accent,#1db954);outline-offset:2px}
a.preprod{color:var(--nrd-danger,#e5534b);border-color:var(--nrd-danger,#e5534b)}
`;

/**
 * Badge de version du pied de page — lit la MEME source que la page /changelog
 * (la version en tete du fichier), et renvoie vers elle.
 * `env-src` (facultatif) : endpoint renvoyant {version, env, commit} ; il a
 * priorite quand il existe, pour distinguer prod et preprod.
 */
class NaerodVersion extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._label = "";
    this._env = "";
  }

  connectedCallback() { this._render(); this._load(); }

  async _load() {
    const envSrc = this.getAttribute("env-src");
    if (envSrc) {
      try {
        const v = await (await fetch(envSrc, { cache: "no-store" })).json();
        if (v && v.version) {
          this._env = v.env || "";
          this._label = `v${v.version}${v.env ? ` · ${v.env}` : ""}${v.commit ? ` · ${v.commit}` : ""}`;
          return this._render();
        }
      } catch { /* repli sur le changelog */ }
    }
    try {
      const d = await (await fetch(this.getAttribute("src") || "/changelog.json", { cache: "no-store" })).json();
      if (d && d.versions && d.versions[0]) this._label = `v${d.versions[0].v}`;
    } catch { /* badge masque */ }
    this._render();
  }

  _render() {
    if (!this._label) { this.shadowRoot.innerHTML = ""; return; }
    const href = this.getAttribute("href") || "/changelog";
    const aria = t(this, "nrd_cl_badge").replace("%s", this._label.replace(/^v/, ""));
    this.shadowRoot.innerHTML = `<style>${BADGE_CSS}</style>` +
      `<a href="${esc(href)}" class="${this._env === "preprod" ? "preprod" : ""}" ` +
      `aria-label="${esc(aria)}">${esc(this._label)}</a>`;
  }
}

if (!customElements.get("naerod-changelog")) customElements.define("naerod-changelog", NaerodChangelog);
if (!customElements.get("naerod-version")) customElements.define("naerod-version", NaerodVersion);

export { NaerodChangelog, NaerodVersion, CL_STRINGS };
