// registry.js — provider registry with declared capabilities + access tier
// (brief §3.3 / §3.9). The UI asks the registry "who can give me live football
// scores at the free tier?" and never hard-codes a provider.

/**
 * @typedef {Object} Capabilities
 * @property {boolean} [standings]
 * @property {boolean} [fixtures]
 * @property {boolean} [results]
 * @property {boolean} [liveScores]   true even if only approximate (polled)
 * @property {boolean} [playerStats]
 * @property {boolean} [search]
 */

/**
 * @typedef {Object} Provider
 * @property {string} key
 * @property {string} name
 * @property {string[]} sports                 e.g. ["football"]
 * @property {Capabilities} capabilities
 * @property {"free"|"pro"} tier
 * @property {Object} [adapter]                methods returning internal types
 * @property {string} [note]
 */

export function createRegistry() {
  /** @type {Map<string, Provider>} */
  const providers = new Map();

  function register(provider) {
    if (!provider || !provider.key) throw new Error("provider needs a key");
    providers.set(provider.key, {
      tier: "free",
      sports: [],
      capabilities: {},
      ...provider,
    });
    return provider;
  }

  function get(key) { return providers.get(key) || null; }
  function all() { return [...providers.values()]; }

  /**
   * Find providers matching a sport + a required capability, not above the
   * allowed tier. Free-tier users never get a `pro` provider.
   * @param {Object} q
   * @param {string} [q.sport]
   * @param {keyof Capabilities} [q.capability]
   * @param {"free"|"pro"} [q.maxTier]  highest tier the user is entitled to
   */
  function find({ sport, capability, maxTier = "free" } = {}) {
    const tierRank = { free: 0, pro: 1 };
    return all().filter((p) => {
      if (sport && !p.sports.includes(sport)) return false;
      if (capability && !p.capabilities[capability]) return false;
      if (tierRank[p.tier] > tierRank[maxTier]) return false;
      return true;
    });
  }

  /** Best provider for a capability: free preferred, then registration order. */
  function pick(q) {
    const matches = find(q);
    matches.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "free" ? -1 : 1));
    return matches[0] || null;
  }

  return { register, get, all, find, pick };
}
