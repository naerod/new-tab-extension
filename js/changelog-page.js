/* Page « Journal des versions » : thème + langue partages avec le nouvel onglet (localStorage). */
import "./vendor/naerod-ui/changelog.js";

try {
  const th = localStorage.getItem("theme");
  document.documentElement.setAttribute("data-theme", th === "light" ? "light" : "dark");
} catch (e) { /* ignore */ }

const FR = (localStorage.getItem("lang") || "fr").slice(0, 2) !== "en";
document.title = FR ? "Journal des versions — Nouvel onglet" : "Changelog — New tab";
document.getElementById("clBackLabel").textContent = FR ? "Retour au nouvel onglet" : "Back to new tab";
const cl = document.querySelector("naerod-changelog");
fetch("manifest.json").then((r) => r.json()).then((m) => cl.setAttribute("current", m.version)).catch(() => {});
