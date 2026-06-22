// index.js — wires the providers into a registry. Phase B adds F1 (Jolpica/OpenF1),
// tennis (TheSportsDB). Pro providers register here later with tier:"pro".

import { createRegistry } from "./registry.js";
import { footballDataProvider, createFootballDataAdapter } from "./football-data.js";
import { espnProvider, createEspnAdapter } from "./espn.js";

/**
 * @param {Object} deps
 * @param {(url:string)=>Promise<any>} deps.httpGet         keyless/direct GET (ESPN, Jolpica...)
 * @param {(url:string)=>Promise<any>} [deps.proxyGet]      proxy GET (naerod-api) for keyed sources
 */
export function buildRegistry({ httpGet, proxyGet } = {}) {
  const registry = createRegistry();
  const get = httpGet || (() => Promise.reject(new Error("no httpGet")));
  const pget = proxyGet || get;

  registry.register({ ...footballDataProvider, adapter: createFootballDataAdapter({ httpGet: pget }) });
  registry.register({ ...espnProvider, adapter: createEspnAdapter({ httpGet: get }) });

  return registry;
}

export { createRegistry } from "./registry.js";
