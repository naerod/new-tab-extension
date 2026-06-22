// entitlements.js — Pro gating WITHOUT selling anything (brief §3.9).
// V1 runs 100% on free providers. This module is the single place that decides
// what the current user is entitled to, so wiring a paid tier later = flip the
// source of `tier` (e.g. a license check) without touching feature code.

const FEATURES = {
  // feature key -> minimum tier required
  liveScoresRealtime: "pro", // second-by-second live (paid upstream)
  playerStatsDeep: "pro",    // fine-grained player stats
  // everything else defaults to "free"
};

export function createEntitlements({ storage, registry } = {}) {
  // In V1 there is no payment path, so tier is always "free" unless a config flag
  // is set manually (useful for dev/QA of the gated UI).
  async function getTier() {
    if (!storage) return "free";
    const t = await storage.getConfig("tier", "free");
    return t === "pro" ? "pro" : "free";
  }

  async function isPro() { return (await getTier()) === "pro"; }

  /** Is a named feature available to the current user? */
  async function hasFeature(key) {
    const required = FEATURES[key] || "free";
    if (required === "free") return true;
    return isPro();
  }

  /** Providers usable by the current user for a sport+capability. */
  async function providersFor(query) {
    if (!registry) return [];
    const maxTier = await getTier();
    return registry.find({ ...query, maxTier });
  }

  /** Best provider the current user may use (free preferred). */
  async function pickProvider(query) {
    if (!registry) return null;
    const maxTier = await getTier();
    return registry.pick({ ...query, maxTier });
  }

  return { getTier, isPro, hasFeature, providersFor, pickProvider, FEATURES };
}
