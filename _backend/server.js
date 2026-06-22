const http = require('http');
const https = require('https');
require('dotenv').config({ path: '/opt/apps/naerod-api/.env' });

const PORT = 3742;
const LEETIFY_KEY = process.env.LEETIFY_KEY;
const STEAM_ID = process.env.STEAM_ID;
const PVE_HOST = process.env.PVE_HOST;             // ex: 192.168.1.100:8006
const PVE_TOKENID = process.env.PVE_TOKENID;       // ex: root@pam!newtab
const PVE_TOKENSECRET = process.env.PVE_TOKENSECRET;
const HOMELAB_KEY = process.env.HOMELAB_KEY;       // garde l'endpoint /api/homelab (exposé publiquement)
const FACEIT_KEY = process.env.FACEIT_KEY;         // Faceit Data API (server-side)
const FACEIT_NICK = process.env.FACEIT_NICKNAME;
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN; // football-data.org v4 (server-side, jamais embarqué)

function fetchLeetify(steamId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cs-prod.leetify.com',
      path: `/api/profile/id/${steamId || STEAM_ID}`,
      headers: { '_leetify_key': LEETIFY_KEY, 'Accept': 'application/json' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Proxmox: cluster/resources via token lecture seule (PVEAuditor). TLS auto-signé -> rejectUnauthorized:false
function fetchProxmox() {
  return new Promise((resolve, reject) => {
    if (!PVE_HOST || !PVE_TOKENID || !PVE_TOKENSECRET) return reject(new Error('PVE not configured'));
    const [host, port] = PVE_HOST.split(':');
    const options = {
      hostname: host,
      port: port || 8006,
      path: '/api2/json/cluster/resources',
      headers: { Authorization: `PVEAPIToken=${PVE_TOKENID}=${PVE_TOKENSECRET}` },
      rejectUnauthorized: false
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Faceit — pseudo fourni par le client.
// 1) API Data OFFICIELLE (open.faceit.com) si FACEIT_KEY est défini : stable, stats complètes.
// 2) sinon repli sur l'API web interne (sans clé) : au moins ELO + niveau (stats best-effort,
//    soumises au pare-feu Cloudflare de faceit.com).
const FACEIT_UA = { headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8', 'Referer': 'https://www.faceit.com/',
} };
const num = (v) => (v != null && v !== '' && !isNaN(parseFloat(v))) ? Math.round(parseFloat(v) * 100) / 100 : null;

async function faceitOfficial(nick) {
  const H = { headers: { Authorization: 'Bearer ' + FACEIT_KEY } };
  const p = await fetch('https://open.faceit.com/data/v4/players?nickname=' + encodeURIComponent(nick) + '&game=cs2', H);
  if (!p.ok) throw new Error('faceit player ' + p.status);
  const pj = await p.json();
  const cs2 = (pj.games && pj.games.cs2) || {};
  const out = { nickname: pj.nickname, elo: cs2.faceit_elo || null, level: cs2.skill_level || null };
  if (pj.player_id) {
    const s = await fetch('https://open.faceit.com/data/v4/players/' + pj.player_id + '/stats/cs2', H);
    if (s.ok) {
      const L = (await s.json()).lifetime || {};
      out.kd = num(L['Average K/D Ratio']); out.winrate = num(L['Win Rate %']);
      out.hs = num(L['Average Headshots %']); out.matches = L['Matches'] != null ? parseInt(L['Matches'], 10) : null;
    }
  }
  return out;
}

async function faceitInternal(nick) {
  const u = await fetch('https://www.faceit.com/api/users/v1/nicknames/' + encodeURIComponent(nick), FACEIT_UA);
  if (!u.ok) throw new Error('faceit user ' + u.status);
  const p = (await u.json()).payload || {};
  if (!p.id) throw new Error('faceit user not found');
  const cs2 = (p.games && p.games.cs2) || {};
  const out = { nickname: p.nickname || nick, elo: cs2.faceit_elo || null, level: cs2.skill_level || null };
  try {
    const s = await fetch('https://api.faceit.com/stats/v1/stats/users/' + p.id + '/games/cs2', FACEIT_UA);
    if (s.ok) {
      const L = (await s.json()).lifetime || {};
      out.kd = num(L['Average K/D Ratio'] != null ? L['Average K/D Ratio'] : L['K/D Ratio']);
      out.winrate = num(L['Win Rate %']); out.hs = num(L['Average Headshots %']);
      out.matches = L['Matches'] != null ? parseInt(L['Matches'], 10) : null;
    }
  } catch (e) { /* stats optionnelles (Cloudflare) */ }
  return out;
}

async function fetchFaceitByNick(nick) {
  if (!nick) return null;
  return FACEIT_KEY ? faceitOfficial(nick) : faceitInternal(nick);
}

// cache Faceit par pseudo (5 min)
const faceitCache = {};
const FACEIT_TTL = 5 * 60 * 1000;
async function getFaceit(nick) {
  const key = (nick || '').toLowerCase();
  const now = Date.now();
  const c = faceitCache[key];
  if (c && now - c.t < FACEIT_TTL) return c.v;
  const v = await fetchFaceitByNick(nick);
  faceitCache[key] = { v, t: now };
  return v;
}

// Sites web à surveiller (statut up/down, vérifié côté serveur)
const SITES = [
  { name: 'naerod.com', url: 'https://naerod.com' },
  { name: 'dorianjulien.com', url: 'https://dorianjulien.com' },
  { name: 'CatchR', url: 'https://catchr.naerod.com' },
  { name: 'Minecraft', url: 'https://mc.naerod.com' },
  { name: 'AIOStreams', url: 'https://aiostreams.naerod.com' },
  { name: 'Hub naerod', url: 'https://hub.naerod.com' },
  { name: 'Hub Dorian', url: 'https://hub.dorianjulien.com' },
];
function checkSite(s) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.get(s.url, { timeout: 7000 }, (res) => {
      res.resume();
      // 2xx-4xx => le serveur répond (401/403 = protégé mais up) ; 5xx/erreur/timeout => down
      const up = res.statusCode < 500;
      resolve({ name: s.name, url: s.url, status: up ? 'up' : 'down', code: res.statusCode, ms: Date.now() - t0 });
    });
    req.on('timeout', () => { req.destroy(); resolve({ name: s.name, url: s.url, status: 'down', code: 0, ms: null }); });
    req.on('error', () => resolve({ name: s.name, url: s.url, status: 'down', code: 0, ms: null }));
  });
}

// caches
let homelabCache = null, homelabTime = 0;
let sitesCache = null, sitesTime = 0;
const SITES_TTL = 60 * 1000;
async function getSites() {
  const now = Date.now();
  if (!sitesCache || now - sitesTime > SITES_TTL) {
    sitesCache = { items: await Promise.all(SITES.map(checkSite)) };
    sitesTime = now;
  }
  return sitesCache;
}
const LEETIFY_TTL = 5 * 60 * 1000;
const HOMELAB_TTL = 30 * 1000;

// cache Leetify par Steam ID (le widget CS2 transmet ?steamid= ; défaut = STEAM_ID du serveur)
const leetifyById = {};
async function getLeetify(steamId) {
  const id = steamId || STEAM_ID;
  const now = Date.now();
  const c = leetifyById[id];
  if (c && now - c.t < LEETIFY_TTL) return c.v;
  const data = await fetchLeetify(id);
  const premier = (data.games || []).filter(g => g.rankType === 11);
  const currentElo = premier.length ? premier[0].skillLevel : null;
  const peakElo = premier.length ? Math.max(...premier.map(g => g.skillLevel)) : null;
  const r = data.recentGameRatings || {};
  const v = {
    elo: currentElo,
    peakElo: peakElo,
    name: data.meta?.name,
    aim: r.aim != null ? Math.round(r.aim) : null,
    positioning: r.positioning != null ? Math.round(r.positioning) : null,
    utility: r.utility != null ? Math.round(r.utility) : null,
    gamesPlayed: r.gamesPlayed || null,
    leetifyRating: r.leetify != null ? (r.leetify * 100).toFixed(2) : null,
    faceit: null,   // Faceit géré séparément via /api/faceit?nick=
  };
  leetifyById[id] = { v, t: now };
  return v;
}

// football-data.org v4 — proxy server-side (token jamais embarqué dans l'extension,
// ADR-007). Passe-plat de la réponse v4 telle quelle ; cache agressif (limite
// gratuite ~10 req/min). pathV4 = ex "competitions/PL/standings" + query éventuelle.
function fetchFootballData(pathV4) {
  return new Promise((resolve, reject) => {
    if (!FOOTBALL_DATA_TOKEN) return reject(new Error('FOOTBALL_DATA_TOKEN not configured'));
    const options = {
      hostname: 'api.football-data.org',
      path: '/v4/' + pathV4,
      headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN, 'Accept': 'application/json' },
    };
    https.get(options, (r) => {
      let data = '';
      r.on('data', (c) => data += c);
      r.on('end', () => {
        if (r.statusCode >= 400) return reject(new Error('football-data ' + r.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
const fdCache = {};
const FD_TTL = 5 * 60 * 1000; // 5 min
async function getFootballData(pathV4) {
  const now = Date.now();
  const c = fdCache[pathV4];
  if (c && now - c.t < FD_TTL) return c.v;
  const v = await fetchFootballData(pathV4);
  fdCache[pathV4] = { v, t: now };
  return v;
}

async function getHomelab() {
  const now = Date.now();
  if (!homelabCache || now - homelabTime > HOMELAB_TTL) {
    const pve = await fetchProxmox();
    const all = (pve && pve.data) || [];
    const items = all
      .filter(r => r.type === 'lxc' || r.type === 'qemu')
      .map(r => ({
        id: r.vmid,
        name: r.name || String(r.vmid),
        type: r.type,
        status: r.status,
        cpu: r.cpu != null ? r.cpu : null,
        mem: (r.mem != null && r.maxmem) ? r.mem / r.maxmem : null,
        uptime: r.uptime || 0,
      }))
      .sort((a, b) => a.id - b.id);
    // ressources globales du/des nœud(s) Proxmox
    const nodes = all.filter(r => r.type === 'node');
    const sum = (k) => nodes.reduce((t, n) => t + (n[k] || 0), 0);
    const cores = sum('maxcpu') || 0;
    const host = nodes.length ? {
      cpu: cores ? nodes.reduce((t, n) => t + (n.cpu || 0) * (n.maxcpu || 0), 0) / cores : (nodes[0].cpu || 0),
      cores,
      memUsed: sum('mem'), memTotal: sum('maxmem'),
      mem: sum('maxmem') ? sum('mem') / sum('maxmem') : null,
      diskUsed: sum('disk'), diskTotal: sum('maxdisk'),
      disk: sum('maxdisk') ? sum('disk') / sum('maxdisk') : null,
      online: nodes.filter(n => n.status === 'online').length,
      nodes: nodes.length,
    } : null;
    homelabCache = { host, items };
    homelabTime = now;
  }
  return homelabCache;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const url = (req.url || '').split('?')[0];
  try {
    if (url === '/api/leetify') {
      const sid = (new URLSearchParams(req.url.split('?')[1] || '').get('steamid') || '').trim();
      const steamId = /^\d{17}$/.test(sid) ? sid : null;   // SteamID64 valide, sinon défaut serveur
      res.writeHead(200);
      return res.end(JSON.stringify(await getLeetify(steamId)));
    }
    if (url === '/api/faceit') {
      // endpoint ouvert (données publiques par pseudo) — plus de clé pour ne rien embarquer dans l'extension
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const nick = (qs.get('nick') || '').trim();
      if (!nick) { res.writeHead(400); return res.end('{"error":"nick required"}'); }
      const data = await getFaceit(nick);
      res.writeHead(200);
      return res.end(JSON.stringify(data || { error: 'not found' }));
    }
    if (url.startsWith('/api/football/')) {
      // endpoint ouvert (données publiques) ; la clé reste côté serveur.
      const rest = url.slice('/api/football/'.length);
      // whitelist stricte (pas d'open proxy) : competitions/<id>/(standings|matches) | teams/<id>/matches
      if (!/^(competitions\/[A-Za-z0-9_-]+\/(standings|matches|teams)|teams\/[0-9]+\/matches)$/.test(rest)) {
        res.writeHead(400); return res.end('{"error":"bad path"}');
      }
      const q = (req.url.split('?')[1] || '');
      const v4 = rest + (q ? '?' + q : '');
      const data = await getFootballData(v4); // await BEFORE writeHead, sinon ERR_HTTP_HEADERS_SENT au catch
      res.writeHead(200);
      return res.end(JSON.stringify(data));
    }
    if (url === '/api/homelab' || url === '/api/sites') {
      const k = new URLSearchParams((req.url.split('?')[1] || '')).get('k');
      if (!HOMELAB_KEY || k !== HOMELAB_KEY) {
        res.writeHead(401);
        return res.end('{"error":"unauthorized"}');
      }
      res.writeHead(200);
      return res.end(JSON.stringify(url === '/api/sites' ? await getSites() : await getHomelab()));
    }
    res.writeHead(404);
    res.end('{"error":"not found"}');
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`naerod-api listening on ${PORT}`));
