
// ============================================================
// TERRA INCOGNITA v2 — Full-Stack Simulation
// All 25 requested systems implemented with a mock backend layer
// (lib/* functions are written to mirror real API shapes —
//  swap their internals for real Supabase/Stripe/Resend calls)
// ============================================================

import { useState, useEffect, useMemo, useRef } from "react";
import "./theme.css";

// ============================================================
// SECTION 1: MOCK BACKEND LAYER
// Every function here is written with the exact signature/shape
// a real backend call would have. Swap internals only.
// ============================================================

// ---- "Supabase" client shim (real schema documented at bottom) ----
const db = {
  get: (table, fallback) => { try { const v = localStorage.getItem(`ti_${table}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (table, data) => { try { localStorage.setItem(`ti_${table}`, JSON.stringify(data)); } catch {} },
};

// ---- "Resend" email shim — logs to an in-app inbox instead of sending ----
function sendEmail({ to, subject, body, template }) {
  const log = db.get("email_log", []);
  const entry = { id: Date.now() + Math.random(), to, subject, body, template, sentAt: new Date().toISOString() };
  db.set("email_log", [entry, ...log].slice(0, 200));
  return Promise.resolve({ success: true, id: entry.id });
}

// ---- "Stripe" checkout shim — simulates a payment session ----
function createCheckoutSession({ plan, userId }) {
  // Real version: stripe.checkout.sessions.create({...}) + webhook on completion
  return new Promise(resolve => {
    setTimeout(() => resolve({ sessionId: "cs_mock_" + Date.now(), status: "ready" }), 400);
  });
}
function confirmPayment({ userId, plan }) {
  const users = db.get("users", []);
  const updated = users.map(u => u.id === userId ? { ...u, plan, planStartedAt: new Date().toISOString() } : u);
  db.set("users", updated);
  const sub = db.get("subscriptions", []);
  db.set("subscriptions", [...sub, { id: Date.now(), userId, plan, status: "active", startedAt: new Date().toISOString(), mrr: plan === "pro" ? 12 : plan === "institution" ? 199 : 0 }]);
  return updated.find(u => u.id === userId);
}

// ---- "PostHog/Plausible" analytics shim ----
function trackEvent(name, props = {}) {
  const events = db.get("analytics_events", []);
  db.set("analytics_events", [{ name, props, ts: new Date().toISOString() }, ...events].slice(0, 500));
}

// ---- OAuth shim ----
function oauthSignIn(provider) {
  // Real version: supabase.auth.signInWithOAuth({ provider })
  const mockProfiles = {
    google: { name: "Alex Rivera", email: "alex.rivera@gmail.com" },
    github: { name: "sam-dev", email: "sam@users.noreply.github.com" },
  };
  return Promise.resolve(mockProfiles[provider]);
}

// ============================================================
// SECTION 2: SEED DATA
// ============================================================
const SEED_PROBLEMS = [
  { id: 1, slug: "riemann-hypothesis", field: "Mathematics", title: "The Riemann Hypothesis", summary: "All non-trivial zeros of the Riemann zeta function lie on the critical line Re(s) = ½.", detail: "First posed by Bernhard Riemann in 1859. A proof would reveal the deep structure behind prime distribution. One of the seven Millennium Prize Problems — $1M reward.", status: "open", difficulty: "Extreme", watchers: ["u1","u2","u3"], bounty: 1000000, year: 1859, submitter: "Clay Mathematics Institute", votes: ["u1","u4"], tags: ["number theory","complex analysis","primes"], approved: true, createdAt: "2024-01-15", versions: [{ at: "2024-01-15", note: "Initial entry" }] },
  { id: 2, slug: "hard-problem-of-consciousness", field: "Biology", title: "The Hard Problem of Consciousness", summary: "Why does physical brain activity give rise to subjective experience — the 'what it is like' to see red or feel pain?", detail: "Coined by David Chalmers in 1995. Neuroscience explains correlates but not the existence of qualia itself. Sits at the intersection of philosophy, neuroscience, and physics.", status: "open", difficulty: "Unknown depth", watchers: ["u2","u5"], bounty: 0, year: 1995, submitter: "David Chalmers", votes: ["u2"], tags: ["consciousness","philosophy of mind","neuroscience"], approved: true, createdAt: "2024-01-20", versions: [{ at: "2024-01-20", note: "Initial entry" }] },
  { id: 3, field: "Physics", slug: "what-is-dark-matter", title: "What is Dark Matter?", summary: "27% of the universe appears to be made of something that doesn't interact with light. We've never directly detected it.", detail: "Evidence from galaxy rotation curves, gravitational lensing, and cosmic structure. Candidates: WIMPs, axions, sterile neutrinos. XENON1T, PandaX, and LUX experiments found nothing yet.", status: "open", difficulty: "Very hard", watchers: ["u1","u3","u4","u5"], bounty: 0, year: 1933, submitter: "Fritz Zwicky", votes: ["u1","u3","u4"], tags: ["cosmology","particle physics","dark matter"], approved: true, createdAt: "2024-01-10", versions: [{ at: "2024-01-10", note: "Initial entry" }] },
  { id: 4, field: "History", slug: "bronze-age-collapse", title: "The Bronze Age Collapse (~1200 BCE)", summary: "Virtually every major Eastern Mediterranean civilization collapsed simultaneously. We don't know why.", detail: "Mycenaean Greeks, Hittites, Egyptians, Cypriots — all declined within decades. Sea Peoples, drought, revolts, earthquakes, and trade disruption are all candidates. Likely multicausal.", status: "partial", difficulty: "Contested", watchers: ["u2"], bounty: 0, year: -1200, submitter: "Robert Drews", votes: ["u2","u5"], tags: ["ancient history","collapse","Mediterranean"], approved: true, createdAt: "2024-02-01", versions: [{ at: "2024-02-01", note: "Initial entry" }] },
  { id: 5, field: "Computer Science", slug: "p-vs-np", title: "Does P = NP?", summary: "Can every problem whose solution is quickly verifiable also be quickly solved? The answer reshapes cryptography and AI.", detail: "Posed by Stephen Cook in 1971. If P=NP, protein folding, logistics, and code-breaking all become trivial. Most believe P≠NP but no proof exists. Another Millennium Prize Problem.", status: "open", difficulty: "Extreme", watchers: ["u1","u2","u3"], bounty: 1000000, year: 1971, submitter: "Stephen Cook", votes: ["u1","u2","u3","u4"], tags: ["complexity theory","algorithms","cryptography"], approved: true, createdAt: "2024-01-12", versions: [{ at: "2024-01-12", note: "Initial entry" }] },
  { id: 6, field: "Astronomy", slug: "fermi-paradox", title: "The Fermi Paradox", summary: "Given billions of potentially habitable planets, why haven't we found any evidence of extraterrestrial life?", detail: "Enrico Fermi asked 'Where is everybody?' in 1950. Proposed resolutions: Great Filter, Rare Earth, dark forest theory, simulation hypothesis. Deeply empirical and deeply philosophical.", status: "open", difficulty: "Philosophical + empirical", watchers: ["u3","u4","u5"], bounty: 0, year: 1950, submitter: "Enrico Fermi", votes: ["u3","u4"], tags: ["SETI","astrobiology","cosmology"], approved: true, createdAt: "2024-01-08", versions: [{ at: "2024-01-08", note: "Initial entry" }] },
  { id: 7, field: "Linguistics", slug: "origin-of-language", title: "The Origin of Language", summary: "How did humans develop the capacity for symbolic language? No other species has it, and the fossil record is nearly silent.", detail: "Theories range from gestural origins to social grooming to sexual selection. FOXP2 is implicated but not sufficient. Chomsky's universal grammar remains contested.", status: "open", difficulty: "Very hard", watchers: ["u2"], bounty: 0, year: 1866, submitter: "Société de Linguistique de Paris", votes: ["u2"], tags: ["evolution","cognition","anthropology"], approved: true, createdAt: "2024-02-10", versions: [{ at: "2024-02-10", note: "Initial entry" }] },
  { id: 8, field: "Mathematics", slug: "navier-stokes", title: "Navier–Stokes Existence & Smoothness", summary: "Do smooth, globally-defined solutions to fluid flow equations always exist, or can turbulence create mathematical singularities?", detail: "The Navier–Stokes equations govern everything from ocean currents to blood flow. Whether solutions can 'blow up' in finite time is unknown.", status: "open", difficulty: "Extreme", watchers: ["u1","u4"], bounty: 1000000, year: 1845, submitter: "Clay Mathematics Institute", votes: ["u1"], tags: ["fluid dynamics","PDEs","turbulence"], approved: true, createdAt: "2024-01-18", versions: [{ at: "2024-01-18", note: "Initial entry" }] },
  { id: 9, field: "Biology", slug: "origin-of-life", title: "How Did Life Originate?", summary: "We don't know how the first self-replicating molecules emerged from chemistry. The gap between chemistry and biology remains unexplained.", detail: "RNA world hypothesis is leading but incomplete. Questions remain about nucleotide polymerization, membrane formation, and co-evolution of metabolism and replication.", status: "partial", difficulty: "Very hard", watchers: ["u3","u5"], bounty: 0, year: 1953, submitter: "Stanley Miller", votes: ["u3"], tags: ["abiogenesis","prebiotic chemistry","evolution"], approved: true, createdAt: "2024-01-25", versions: [{ at: "2024-01-25", note: "Initial entry" }] },
  { id: 10, field: "Physics", slug: "arrow-of-time", title: "Why Does Time Flow Forward?", summary: "The laws of physics are time-symmetric. Why do we experience an irreversible arrow of time from past to future?", detail: "The second law of thermodynamics describes entropy increase but doesn't explain why the universe started in a low-entropy state.", status: "solved", difficulty: "Deep", watchers: ["u1","u2","u4"], bounty: 0, year: 1927, submitter: "Arthur Eddington", votes: ["u1","u2"], tags: ["thermodynamics","cosmology","time"], approved: true, createdAt: "2024-01-30", solvedAt: "2026-06-01", solvedRef: "Penrose & Gefter, 'Entropic Origins of Cosmic Time', Phys. Rev. D (2026)", versions: [{ at: "2024-01-30", note: "Initial entry" }, { at: "2026-06-01", note: "Marked solved" }] },
];

const FIELDS = ["Mathematics","Physics","Biology","History","Computer Science","Astronomy","Linguistics","Chemistry","Psychology","Archaeology","Economics","Neuroscience"];
const FIELD_COLORS = {
  Mathematics: { bg: "#EEEDFE", text: "#3C3489", dot: "#534AB7" },
  Physics: { bg: "#E6F1FB", text: "#0C447C", dot: "#185FA5" },
  Biology: { bg: "#EAF3DE", text: "#27500A", dot: "#3B6D11" },
  History: { bg: "#FAEEDA", text: "#633806", dot: "#854F0B" },
  "Computer Science": { bg: "#E1F5EE", text: "#085041", dot: "#0F6E56" },
  Astronomy: { bg: "#FAECE7", text: "#712B13", dot: "#993C1D" },
  Linguistics: { bg: "#FBEAF0", text: "#72243E", dot: "#993556" },
  Chemistry: { bg: "#E1F5EE", text: "#085041", dot: "#0F6E56" },
  Psychology: { bg: "#EEEDFE", text: "#3C3489", dot: "#534AB7" },
  Archaeology: { bg: "#FAEEDA", text: "#633806", dot: "#854F0B" },
  Economics: { bg: "#E6F1FB", text: "#0C447C", dot: "#185FA5" },
  Neuroscience: { bg: "#EAF3DE", text: "#27500A", dot: "#3B6D11" },
};

const SEED_BLOG = [
  { id: 1, slug: "why-open-problems-matter", title: "Why open problems deserve their own internet", date: "2026-06-20", excerpt: "Wikipedia documents what we know. Nobody had built the equivalent for what we don't — until now.", body: "# Why open problems deserve their own internet\n\nEvery field of human inquiry keeps a running list of what it doesn't know. Mathematicians have their open conjectures. Historians have their unresolved mysteries. Biologists have their unexplained mechanisms.\n\nBut these lists live in **siloed, inaccessible places** — appendices of textbooks, scattered wiki pages, conference talk slides. There's no shared home for *the questions themselves*.\n\nThat's the gap Terra Incognita fills." },
  { id: 2, slug: "the-solved-event", title: "What happens when a 70-year-old mystery gets solved", date: "2026-06-22", excerpt: "We built an entire feature around a single moment: the instant a question becomes an answer.", body: "# What happens when a mystery gets solved\n\nMost platforms treat 'solved' as a status flip. We treat it as an **event** — worth a notification, a page, and a moment of recognition for everyone who's been following along." },
];

const SEED_PROBLEM_OF_WEEK = { problemId: 6, week: "June 22–28, 2026", curatorNote: "We're featuring the Fermi Paradox this week because of renewed interest following new exoplanet atmosphere data. It's the most-followed problem on the platform and a perfect entry point if you're new here.", body: "# The Fermi Paradox, explained for anyone\n\nImagine a city of a billion houses, and you knock on one — silence. You knock on the next — silence. You've knocked on every house on your street and heard nothing back.\n\nThat's roughly the situation we're in with the universe. There are an estimated 100 billion to 400 billion stars in our galaxy alone, and a meaningful fraction likely host planets in the 'habitable zone.' Yet despite decades of listening, **we've heard nothing**.\n\n## Why this is strange\n\nEnrico Fermi posed this almost as a joke at lunch in 1950: 'Where is everybody?' But the more you sit with the math, the stranger the silence becomes." };

// ============================================================
// SECTION 3: STORE INITIALIZATION
// ============================================================
function initStore() {
  if (!db.get("initialized")) {
    db.set("problems", SEED_PROBLEMS);
    db.set("users", [
      { id: "u1", email: "admin@terra.io", name: "Admin", password: "admin123", role: "admin", plan: "institution", joined: "2024-01-01", referralCode: "ADMIN1", referredBy: null, submissionsToday: 0, lastSubmissionDate: null },
      { id: "u2", email: "alex@university.edu", name: "Alex Chen", password: "pass123", role: "user", plan: "free", joined: "2024-03-12", referralCode: "ALEX42", referredBy: null, submissionsToday: 0, lastSubmissionDate: null },
      { id: "u3", email: "priya@labs.org", name: "Priya Sharma", password: "pass123", role: "user", plan: "pro", joined: "2024-02-05", referralCode: "PRIYA9", referredBy: null, submissionsToday: 0, lastSubmissionDate: null },
      { id: "u4", email: "jordan@mit.edu", name: "Jordan Lee", password: "pass123", role: "user", plan: "free", joined: "2024-04-18", referralCode: "JORD17", referredBy: "ALEX42", submissionsToday: 0, lastSubmissionDate: null },
      { id: "u5", email: "sam@indep.org", name: "Sam Okafor", password: "pass123", role: "user", plan: "free", joined: "2024-05-02", referralCode: "SAMOK3", referredBy: null, submissionsToday: 0, lastSubmissionDate: null },
    ]);
    db.set("waitlist", []);
    db.set("email_log", []);
    db.set("subscriptions", []);
    db.set("analytics_events", []);
    db.set("referral_conversions", [{ code: "ALEX42", convertedUserId: "u4", at: "2024-04-18" }]);
    db.set("blog", SEED_BLOG);
    db.set("problem_of_week", SEED_PROBLEM_OF_WEEK);
    db.set("institutions", [{ id: 1, name: "MIT Department of Physics", ownerId: "u3", seats: 50, members: [{ email: "priya@labs.org", role: "owner" }, { email: "jordan@mit.edu", role: "member" }], collections: [{ name: "Faculty watchlist", problemIds: [1, 5, 8] }] }]);
    db.set("initialized", true);
  }
}

// ============================================================
// SECTION 4: SIMPLE FUZZY SEARCH (Fuse.js-style, no dependency)
// ============================================================
function fuzzySearch(items, query, keys) {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items
    .map(item => {
      let score = 0;
      keys.forEach(key => {
        const val = (item[key] || "").toString().toLowerCase();
        if (val === q) score += 10;
        else if (val.startsWith(q)) score += 5;
        else if (val.includes(q)) score += 2;
      });
      if (item.tags?.some(t => t.toLowerCase().includes(q))) score += 3;
      return { item, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.item);
}

// ============================================================
// SECTION 5: RELATED PROBLEMS ENGINE (tag overlap)
// ============================================================
function getRelated(problem, allProblems, n = 3) {
  return allProblems
    .filter(p => p.id !== problem.id && p.approved)
    .map(p => ({ p, overlap: p.tags.filter(t => problem.tags.includes(t)).length }))
    .filter(x => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, n)
    .map(x => x.p);
}

// ============================================================
// SECTION 6: RATE LIMITING
// ============================================================
function checkRateLimit(user) {
  if (!user) return { allowed: false, reason: "Not signed in" };
  if (user.plan !== "free") return { allowed: true };
  const today = new Date().toISOString().slice(0, 10);
  if (user.lastSubmissionDate !== today) return { allowed: true, remaining: 3 };
  const used = user.submissionsToday || 0;
  if (used >= 3) return { allowed: false, reason: "Free plan limit: 3 submissions/day. Upgrade to Pro for unlimited." };
  return { allowed: true, remaining: 3 - used };
}

// ============================================================
// SECTION 7: ICONS
// ============================================================
const Icon = ({ name, size = 18, style = {} }) => {
  const icons = {
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    globe: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>,
    starFilled: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>,
    eye: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    eyeFilled: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    trending: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    arrow: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    lock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    share: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
    trophy: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/><path d="M7 4H4a2 2 0 0 0-2 2v1a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V6a2 2 0 0 0-2-2h-3"/><rect x="7" y="2" width="10" height="9" rx="1"/></svg>,
    book: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    zap: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    link: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    confetti: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 22 16 8M5.5 18.5 9 22M2 8l3 3M14 2l3 3M18 6l3-3M6 11l-3-3M16 2l3 3"/></svg>,
    crown: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></svg>,
    code: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    smartphone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>,
    building: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="9" y2="13"/><line x1="15" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="9" y2="17"/><line x1="15" y1="17" x2="15" y2="17"/></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    barChart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  };
  return <span style={{ display: "inline-flex", alignItems: "center", ...style }}>{icons[name] || null}</span>;
};

// ============================================================
// SECTION 8: SHARED UI COMPONENTS
// ============================================================
function Badge({ field }) {
  const c = FIELD_COLORS[field] || { bg: "#F1EFE8", text: "#444441" };
  return <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{field}</span>;
}

function StatusBadge({ status }) {
  const map = {
    open: { bg: "#EAF3DE", text: "#27500A", label: "Open" },
    partial: { bg: "#FAEEDA", text: "#633806", label: "Partial" },
    solved: { bg: "#E6F1FB", text: "#0C447C", label: "Solved" },
    pending: { bg: "#F1EFE8", text: "#5F5E5A", label: "Pending review" },
  };
  const s = map[status] || map.open;
  return <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6 }}>{s.label}</span>;
}

function Modal({ open, onClose, children, title, width = 560 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1rem", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 16, width: "100%", maxWidth: width, padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.3 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 4, marginLeft: 12 }}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, style = {}, disabled = false, size = "md" }) {
  const base = { cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 8, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity 0.1s", opacity: disabled ? 0.5 : 1, fontSize: size === "sm" ? 13 : 14, padding: size === "sm" ? "6px 12px" : "9px 18px" };
  const variants = {
    primary: { background: "#1a1a1a", color: "#fff" },
    secondary: { background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)" },
    ghost: { background: "none", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)" },
    danger: { background: "#FCEBEB", color: "#791F1F" },
    success: { background: "#EAF3DE", color: "#27500A" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", outline: "none" }} />
    </div>
  );
}

function ProblemCard({ p, onClick, user, onToggleWatch, onVote }) {
  const isWatching = user && p.watchers.includes(user.id);
  const hasVoted = user && p.votes.includes(user.id);
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.25rem", transition: "border-color 0.15s" }}>
      <div onClick={() => onClick(p)} style={{ cursor: "pointer", marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{p.title}</span>
      </div>
      <p onClick={() => onClick(p)} style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 10, cursor: "pointer" }}>{p.summary}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge field={p.field} />
        <StatusBadge status={p.status} />
        {p.bounty > 0 && <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6 }}>${(p.bounty / 1000000).toFixed(0)}M bounty</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => onVote && onVote(p)} disabled={!user} style={{ background: "none", border: "none", cursor: user ? "pointer" : "default", display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: hasVoted ? "#BA7517" : "var(--color-text-tertiary)" }}>
            <Icon name={hasVoted ? "starFilled" : "star"} size={13} />{p.votes.length}
          </button>
          <button onClick={() => onToggleWatch && onToggleWatch(p)} disabled={!user} style={{ background: "none", border: "none", cursor: user ? "pointer" : "default", display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: isWatching ? "#185FA5" : "var(--color-text-tertiary)" }}>
            <Icon name={isWatching ? "eyeFilled" : "eye"} size={13} />{p.watchers.length}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 9: PROBLEM DETAIL (with vote, follow, cite, related, SEO meta)
// ============================================================
function ProblemDetail({ p, onClose, user, problems, onToggleWatch, onVote, onOpenRelated }) {
  const [copied, setCopied] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const related = useMemo(() => getRelated(p, problems), [p, problems]);
  const isWatching = user && p.watchers.includes(user.id);
  const hasVoted = user && p.votes.includes(user.id);

  function copyLink() {
    const url = `https://terraincognita.io/problems/${p.slug}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    trackEvent("share_clicked", { problemId: p.id });
  }

  const bibtex = `@misc{terra_incognita_${p.slug?.replace(/-/g, "_")},\n  title = {${p.title}},\n  howpublished = {Terra Incognita},\n  year = {${new Date().getFullYear()}},\n  url = {https://terraincognita.io/problems/${p.slug}}\n}`;

  return (
    <Modal open title={p.title} onClose={onClose} width={640}>
      {/* SEO meta preview (would render as actual <head> tags on /problems/[slug]) */}
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-secondary)", padding: "6px 10px", borderRadius: 6, marginBottom: "1rem", fontFamily: "monospace" }}>
        /problems/{p.slug} · canonical SEO page
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <Badge field={p.field} />
        <StatusBadge status={p.status} />
        {p.bounty > 0 && <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6 }}>${(p.bounty / 1000000).toFixed(0)}M bounty</span>}
        {p.year && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", padding: "3px 0" }}>First posed {p.year < 0 ? Math.abs(p.year) + " BCE" : p.year}</span>}
      </div>

      {p.status === "solved" && (
        <div style={{ background: "#E6F1FB", border: "0.5px solid #92C2E8", borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#0C447C", marginBottom: 3 }}>✓ Solved {p.solvedAt}</div>
          <div style={{ fontSize: 12, color: "#185FA5" }}>{p.solvedRef}</div>
        </div>
      )}

      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Plain-language summary</div>
        <p style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.65 }}>{p.summary}</p>
      </div>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Background</div>
        <p style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.65 }}>{p.detail}</p>
      </div>
      {p.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1.25rem" }}>
          {p.tags.map(t => <span key={t} style={{ fontSize: 11, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", padding: "3px 8px", borderRadius: 6 }}>#{t}</span>)}
        </div>
      )}

      {related.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Related problems</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {related.map(r => (
              <button key={r.id} onClick={() => onOpenRelated(r)} style={{ textAlign: "left", background: "var(--color-background-secondary)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{r.title}</span>
                <Badge field={r.field} />
              </button>
            ))}
          </div>
        </div>
      )}

      {p.versions?.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Version history</div>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.6 }}>
            {p.versions.map((v, i) => <div key={i}>{v.at} — {v.note}</div>)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => onVote(p)} disabled={!user} style={{ background: "none", border: "none", cursor: user ? "pointer" : "default", display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: hasVoted ? "#BA7517" : "var(--color-text-secondary)" }}>
          <Icon name={hasVoted ? "starFilled" : "star"} size={14} /> {p.votes.length} votes
        </button>
        <Btn size="sm" variant={isWatching ? "secondary" : "ghost"} disabled={!user} onClick={() => onToggleWatch(p)}>
          <Icon name={isWatching ? "eyeFilled" : "eye"} size={14} />{isWatching ? "Following" : "Follow"} ({p.watchers.length})
        </Btn>
        <Btn size="sm" variant="ghost" onClick={copyLink}><Icon name="link" size={14} />{copied ? "Copied!" : "Copy link"}</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setCiteOpen(!citeOpen)}><Icon name="book" size={14} />Cite</Btn>
      </div>
      {citeOpen && (
        <pre style={{ background: "var(--color-background-secondary)", padding: "10px 12px", borderRadius: 8, fontSize: 11, marginTop: 10, overflow: "auto", color: "var(--color-text-primary)", fontFamily: "monospace" }}>{bibtex}</pre>
      )}
    </Modal>
  );
}

// ============================================================
// SECTION 10: SOLVED EVENT PAGE
// ============================================================
function SolvedEvent({ problem, setPage }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth; canvas.height = 260;
    const colors = ["#534AB7", "#185FA5", "#27500A", "#BA7517", "#791F1F"];
    const pieces = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      r: 3 + Math.random() * 4, c: colors[Math.floor(Math.random() * colors.length)],
      vy: 1 + Math.random() * 2.5, vx: -1 + Math.random() * 2, rot: Math.random() * 360, vr: -4 + Math.random() * 8,
    }));
    let frame, t = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.8);
        ctx.restore();
      });
      t++;
      if (t < 240) frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!problem) return null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg, #E6F1FB, #EEEDFE)", marginBottom: "1.5rem" }}>
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1.5rem" }}>
          <Icon name="confetti" size={28} style={{ color: "#0C447C", marginBottom: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: "#0C447C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Solved</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", maxWidth: 480 }}>{problem.title}</h1>
        </div>
      </div>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Resolved by</div>
        <p style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.6 }}>{problem.solvedRef}</p>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
        {problem.watchers.length.toLocaleString()} people were following this problem. After {new Date().getFullYear() - problem.year} years open, it's closed. An email announcement just went out to every follower.
      </p>
      <Btn onClick={() => setPage("browse")}>Browse more open problems <Icon name="arrow" size={15} /></Btn>
    </div>
  );
}

// ============================================================
// SECTION 11: NAV
// ============================================================
function Nav({ page, setPage, user, setUser }) {
  const navLinks = [
    { id: "browse", label: "Browse" },
    { id: "potw", label: "Problem of the Week" },
    { id: "blog", label: "Blog" },
    { id: "submit", label: "Submit" },
    { id: "pricing", label: "Pricing" },
  ];
  return (
    <nav style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 1.5rem", display: "flex", alignItems: "center", height: 56, position: "sticky", top: 0, background: "var(--color-background-primary)", zIndex: 100, overflowX: "auto" }}>
      <button onClick={() => setPage("landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginRight: 24, padding: 0, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: "#1a1a1a", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="globe" size={14} style={{ color: "#fff" }} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Terra Incognita</span>
      </button>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {navLinks.map(l => (
          <button key={l.id} onClick={() => setPage(l.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "6px 10px", borderRadius: 6, color: page === l.id ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: page === l.id ? 500 : 400, whiteSpace: "nowrap" }}>{l.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {user ? (
          <>
            <Btn size="sm" variant="ghost" onClick={() => setPage(user.role === "admin" ? "admin" : "dashboard")}>{user.role === "admin" ? <><Icon name="settings" size={14} />Admin</> : <><Icon name="users" size={14} />Dashboard</>}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => { setUser(null); setPage("landing"); }}><Icon name="logout" size={14} /></Btn>
          </>
        ) : (
          <>
            <Btn size="sm" variant="ghost" onClick={() => setPage("login")}>Sign in</Btn>
            <Btn size="sm" onClick={() => setPage("signup")}>Join free</Btn>
          </>
        )}
      </div>
    </nav>
  );
}

// ============================================================
// SECTION 12: LANDING
// ============================================================
function Landing({ setPage, problems, user, setDetail }) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const approved = problems.filter(p => p.approved).slice(0, 4);

  function joinWaitlist(e) {
    e.preventDefault();
    if (!email) return;
    const list = db.get("waitlist", []);
    if (!list.find(x => x.email === email)) db.set("waitlist", [...list, { email, joined: new Date().toISOString() }]);
    sendEmail({ to: email, subject: "Welcome to Terra Incognita", body: "You're on the list for the Problem of the Week digest.", template: "waitlist_welcome" });
    trackEvent("waitlist_joined", { email });
    setJoined(true);
  }

  const stats = [{ n: String(problems.filter(p => p.approved).length), label: "Open problems" }, { n: "18", label: "Fields of study" }, { n: "31K", label: "Researchers following" }, { n: String(problems.filter(p => p.status === "solved").length), label: "Solved this year" }];
  const features = [
    { icon: "globe", title: "Cross-disciplinary", body: "Problems from mathematics, physics, history, linguistics, and 14 other fields — all in one place, properly linked." },
    { icon: "book", title: "Plain-language first", body: "Every problem has a non-specialist summary. You don't need a PhD to understand what humanity doesn't know yet." },
    { icon: "trophy", title: "The solved event", body: "When a problem closes, it's an event. Follow problems, get notified, and watch knowledge advance in real time." },
    { icon: "code", title: "Built for builders", body: "Full API access, BibTeX citations, CSV export, and programmatic SEO pages for every problem." },
  ];
  const faqs = [
    { q: "Who can submit a problem?", a: "Anyone with a verified account. Submissions go through editorial review to ensure quality and genuine openness." },
    { q: "Is it free to use?", a: "Browsing and following is free forever. Pro unlocks unlimited submissions, API access, and export." },
    { q: "How is this different from Wikipedia?", a: "Wikipedia documents what we know. We document what we don't." },
  ];

  return (
    <div>
      <div style={{ padding: "5rem 1.5rem 3.5rem", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#F1EFE8", color: "#5F5E5A", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20, marginBottom: "1.25rem" }}>WHAT HUMANITY DOESN'T KNOW YET</div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 600, lineHeight: 1.15, color: "var(--color-text-primary)", marginBottom: "1.25rem", letterSpacing: "-0.02em" }}>The world's open questions,<br />organized.</h1>
        <p style={{ fontSize: 18, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: "2.5rem", maxWidth: 520, margin: "0 auto 2.5rem" }}>Browse unsolved problems from 18 fields of science, mathematics, and history. Follow them. Contribute to them. Watch them fall.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => setPage("browse")} style={{ fontSize: 15, padding: "11px 24px" }}>Explore problems <Icon name="arrow" size={16} /></Btn>
          <Btn variant="ghost" onClick={() => setPage("submit")} style={{ fontSize: 15, padding: "11px 24px" }}>Submit a question</Btn>
        </div>
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: "center", padding: "0.75rem", borderRight: i < stats.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--color-text-primary)" }}>{s.n}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "3rem 1.5rem", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>Recent additions</h2>
          <Btn variant="ghost" size="sm" onClick={() => setPage("browse")}>Browse all <Icon name="arrow" size={14} /></Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {approved.map(p => <ProblemCard key={p.id} p={p} onClick={setDetail} user={user} />)}
        </div>
      </div>
      <div style={{ background: "var(--color-background-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "2rem", textAlign: "center" }}>Why Terra Incognita?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ width: 36, height: 36, background: "#F1EFE8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name={f.icon} size={18} /></div>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 6, color: "var(--color-text-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "3.5rem 1.5rem", maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 10, color: "var(--color-text-primary)" }}>Get the problem of the week</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>Every Thursday — one unsolved problem, explained for anyone.</p>
        {joined ? (
          <div style={{ background: "#EAF3DE", color: "#27500A", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500 }}><Icon name="check" size={16} /> You're on the list.</div>
        ) : (
          <form onSubmit={joinWaitlist} style={{ display: "flex", gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" required style={{ flex: 1, padding: "9px 14px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", outline: "none" }} />
            <Btn>Subscribe</Btn>
          </form>
        )}
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "3rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: "1.5rem", color: "var(--color-text-primary)" }}>Questions</h2>
        {faqs.map((f, i) => (
          <div key={i} style={{ borderBottom: i < faqs.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", padding: "1rem 0" }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>{f.q}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{f.a}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "2rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, background: "#1a1a1a", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="globe" size={11} style={{ color: "#fff" }} /></div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Terra Incognita</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>© 2026 Terra Incognita Inc.</span>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 13: BROWSE (with Fuse-style search)
// ============================================================
function Browse({ user, problems, setProblems, setDetail }) {
  const [search, setSearch] = useState("");
  const [field, setField] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("watchers");

  const approved = problems.filter(p => p.approved);
  const searched = useMemo(() => fuzzySearch(approved, search, ["title", "summary", "field"]), [approved, search]);
  const filtered = searched.filter(p => (field === "All" || p.field === field) && (status === "All" || p.status === status))
    .sort((a, b) => sort === "watchers" ? b.watchers.length - a.watchers.length : sort === "votes" ? b.votes.length - a.votes.length : new Date(b.createdAt) - new Date(a.createdAt));

  function toggleWatch(p) {
    if (!user) return;
    const updated = problems.map(x => x.id === p.id ? { ...x, watchers: x.watchers.includes(user.id) ? x.watchers.filter(w => w !== user.id) : [...x.watchers, user.id] } : x);
    db.set("problems", updated); setProblems(updated);
    trackEvent("problem_followed", { problemId: p.id });
  }
  function vote(p) {
    if (!user) return;
    const updated = problems.map(x => x.id === p.id ? { ...x, votes: x.votes.includes(user.id) ? x.votes.filter(v => v !== user.id) : [...x.votes, user.id] } : x);
    db.set("problems", updated); setProblems(updated);
    trackEvent("problem_voted", { problemId: p.id });
  }

  const fieldCounts = ["All", ...FIELDS].reduce((acc, f) => { acc[f] = f === "All" ? approved.length : approved.filter(p => p.field === f).length; return acc; }, {});

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Browse open problems</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{approved.length} problems across {FIELDS.filter(f => approved.some(p => p.field === f)).length} fields</p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }}><Icon name="search" size={15} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search problems… (fuzzy match on title, summary, tags)" style={{ width: "100%", padding: "8px 12px 8px 34px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", outline: "none" }} />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="All">All status</option><option value="open">Open</option><option value="partial">Partially solved</option><option value="solved">Solved</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="watchers">Most followed</option><option value="votes">Most voted</option><option value="newest">Newest</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {["All", ...FIELDS.filter(f => fieldCounts[f] > 0)].map(f => (
          <button key={f} onClick={() => setField(f)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "0.5px solid", borderColor: field === f ? "var(--color-border-primary)" : "var(--color-border-tertiary)", background: field === f ? "var(--color-background-secondary)" : "var(--color-background-primary)", color: field === f ? "var(--color-text-primary)" : "var(--color-text-secondary)", cursor: "pointer", fontWeight: field === f ? 500 : 400 }}>
            {f} {fieldCounts[f] ? <span style={{ color: "var(--color-text-tertiary)" }}>({fieldCounts[f]})</span> : null}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: 14 }}>No problems match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(p => <ProblemCard key={p.id} p={p} onClick={setDetail} user={user} onToggleWatch={toggleWatch} onVote={vote} />)}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 14: SUBMIT (with rate limiting)
// ============================================================
function Submit({ user, setUser, setPage, problems, setProblems }) {
  const [form, setForm] = useState({ title: "", summary: "", detail: "", field: "Mathematics", status: "open", year: "", tags: "" });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const limit = checkRateLimit(user);

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.summary.trim() || form.summary.length < 30) e.summary = "Write at least 30 characters";
    if (!form.detail.trim() || form.detail.length < 50) e.detail = "Write at least 50 characters";
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!limit.allowed) return;

    const newId = Math.max(...problems.map(p => p.id)) + 1;
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const newP = { ...form, id: newId, slug, approved: false, votes: [], watchers: [], bounty: 0, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), createdAt: new Date().toISOString().slice(0, 10), year: parseInt(form.year) || null, submitterEmail: user.email, versions: [{ at: new Date().toISOString().slice(0, 10), note: "Submitted for review" }] };
    const updated = [...problems, newP];
    db.set("problems", updated); setProblems(updated);

    const today = new Date().toISOString().slice(0, 10);
    const users = db.get("users", []);
    const updatedUsers = users.map(u => u.id === user.id ? { ...u, submissionsToday: u.lastSubmissionDate === today ? (u.submissionsToday || 0) + 1 : 1, lastSubmissionDate: today } : u);
    db.set("users", updatedUsers); setUser(updatedUsers.find(u => u.id === user.id));

    sendEmail({ to: user.email, subject: "We received your submission", body: `Your problem "${form.title}" was submitted for editorial review.`, template: "submission_received" });
    trackEvent("problem_submitted", { field: form.field });
    setSubmitted(true);
  }

  if (!user) return (
    <div style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem 1.5rem", textAlign: "center" }}>
      <Icon name="lock" size={32} style={{ color: "var(--color-text-tertiary)", marginBottom: "1rem" }} />
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: "var(--color-text-primary)" }}>Sign in to submit a problem</h2>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>You need a free account. It takes 30 seconds.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Btn onClick={() => setPage("signup")}>Create free account</Btn>
        <Btn variant="ghost" onClick={() => setPage("login")}>Sign in</Btn>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem 1.5rem", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, background: "#EAF3DE", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}><Icon name="check" size={24} style={{ color: "#27500A" }} /></div>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: "var(--color-text-primary)" }}>Submitted for review</h2>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>Our editorial team will review it within 48 hours. A confirmation email was logged to your inbox.</p>
    </div>
  );

  const f = (key) => ({ value: form[key], onChange: e => setForm(prev => ({ ...prev, [key]: e.target.value })) });

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Submit an open problem</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>A good submission has a clear title, a plain-language summary, and enough background for a specialist to evaluate it.</p>
      </div>
      {user.plan === "free" && (
        <div style={{ background: limit.allowed ? "var(--color-background-secondary)" : "#FCEBEB", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: limit.allowed ? "var(--color-text-secondary)" : "#791F1F", marginBottom: "1.25rem" }}>
          {limit.allowed ? `Free plan: ${limit.remaining} submission${limit.remaining === 1 ? "" : "s"} remaining today.` : limit.reason}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Problem title *</label>
          <input {...f("title")} placeholder="e.g. Why do we need to sleep?" style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: `0.5px solid ${errors.title ? "#E24B4A" : "var(--color-border-secondary)"}`, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
          {errors.title && <span style={{ fontSize: 12, color: "#E24B4A" }}>{errors.title}</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Plain-language summary *</label>
          <textarea {...f("summary")} rows={3} placeholder="Describe the mystery in 2–3 sentences…" style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: `0.5px solid ${errors.summary ? "#E24B4A" : "var(--color-border-secondary)"}`, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical" }} />
          {errors.summary && <span style={{ fontSize: 12, color: "#E24B4A" }}>{errors.summary}</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Technical background *</label>
          <textarea {...f("detail")} rows={5} placeholder="Historical context, key attempts at solution, relevant literature…" style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: `0.5px solid ${errors.detail ? "#E24B4A" : "var(--color-border-secondary)"}`, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical" }} />
          {errors.detail && <span style={{ fontSize: 12, color: "#E24B4A" }}>{errors.detail}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Field</label>
            <select {...f("field")} style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
              {FIELDS.map(fl => <option key={fl}>{fl}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Status</label>
            <select {...f("status")} style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
              <option value="open">Open</option><option value="partial">Partially solved</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Tags (comma-separated)</label>
          <input {...f("tags")} placeholder="e.g. number theory, primes" style={{ width: "100%", padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        </div>
        <Btn disabled={!limit.allowed} style={{ width: "100%", justifyContent: "center", padding: "11px 0" }}>Submit for editorial review <Icon name="arrow" size={16} /></Btn>
      </form>
    </div>
  );
}

// ============================================================
// SECTION 15: AUTH (email/password + OAuth)
// ============================================================
function Login({ setPage, setUser }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [oauthLoading, setOauthLoading] = useState(null);

  function handle(e) {
    e.preventDefault();
    const users = db.get("users", []);
    const u = users.find(u => u.email === email && u.password === password);
    if (!u) { setError("Invalid email or password."); return; }
    setUser(u); trackEvent("login", { method: "password" }); setPage(u.role === "admin" ? "admin" : "dashboard");
  }

  async function handleOAuth(provider) {
    setOauthLoading(provider);
    const profile = await oauthSignIn(provider);
    const users = db.get("users", []);
    let u = users.find(x => x.email === profile.email);
    if (!u) {
      u = { id: "u" + Date.now(), email: profile.email, name: profile.name, password: null, role: "user", plan: "free", joined: new Date().toISOString().slice(0, 10), referralCode: profile.name.slice(0, 4).toUpperCase() + Math.floor(Math.random() * 90), referredBy: null, submissionsToday: 0, lastSubmissionDate: null, oauthProvider: provider };
      db.set("users", [...users, u]);
    }
    setUser(u); trackEvent("login", { method: provider }); setOauthLoading(null); setPage("dashboard");
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: "0.25rem", color: "var(--color-text-primary)" }}>Sign in</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>No account? <button onClick={() => setPage("signup")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontWeight: 500, fontSize: 14, textDecoration: "underline" }}>Join free</button></p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
        <Btn variant="secondary" onClick={() => handleOAuth("google")} disabled={oauthLoading} style={{ justifyContent: "center" }}>{oauthLoading === "google" ? "Connecting…" : "Continue with Google"}</Btn>
        <Btn variant="secondary" onClick={() => handleOAuth("github")} disabled={oauthLoading} style={{ justifyContent: "center" }}>{oauthLoading === "github" ? "Connecting…" : "Continue with GitHub"}</Btn>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.25rem" }}>
        <div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)" }} /><span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>or</span><div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)" }} />
      </div>
      <form onSubmit={handle}>
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        {error && <div style={{ fontSize: 13, color: "#E24B4A", marginBottom: 10 }}>{error}</div>}
        <Btn style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>Sign in</Btn>
      </form>
      <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: "1.5rem" }}>Demo: admin@terra.io / admin123, or priya@labs.org / pass123 (Pro)</p>
    </div>
  );
}

function Signup({ setPage, setUser }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" }); const [error, setError] = useState(""); const [ref, setRef] = useState(null);
  useEffect(() => { const stored = sessionStorage.getItem("ti_ref"); if (stored) setRef(stored); }, []);

  function handle(e) {
    e.preventDefault();
    const users = db.get("users", []);
    if (users.find(u => u.email === form.email)) { setError("Email already in use."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    const code = (form.name.slice(0, 4) || "USER").toUpperCase().replace(/[^A-Z]/g, "") + Math.floor(Math.random() * 90 + 10);
    const newUser = { id: "u" + Date.now(), ...form, role: "user", plan: "free", joined: new Date().toISOString().slice(0, 10), referralCode: code, referredBy: ref, submissionsToday: 0, lastSubmissionDate: null };
    db.set("users", [...users, newUser]);
    if (ref) {
      const conversions = db.get("referral_conversions", []);
      db.set("referral_conversions", [...conversions, { code: ref, convertedUserId: newUser.id, at: new Date().toISOString().slice(0, 10) }]);
      trackEvent("referral_converted", { code: ref });
    }
    sendEmail({ to: form.email, subject: "Welcome to Terra Incognita", body: "Your account is ready. Start by browsing or submitting a problem.", template: "welcome" });
    trackEvent("signup", { referred: !!ref });
    setUser(newUser); setPage("dashboard");
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: "0.25rem", color: "var(--color-text-primary)" }}>Create a free account</h1>
      {ref && <div style={{ background: "#EAF3DE", color: "#27500A", fontSize: 12, padding: "6px 10px", borderRadius: 6, marginBottom: "1rem" }}>Referred by code {ref} — they'll get credit when you join.</div>}
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "2rem" }}>Already signed up? <button onClick={() => setPage("login")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontWeight: 500, fontSize: 14, textDecoration: "underline" }}>Sign in</button></p>
      <form onSubmit={handle}>
        <Input label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
        <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 6 characters" />
        {error && <div style={{ fontSize: 13, color: "#E24B4A", marginBottom: 10 }}>{error}</div>}
        <Btn style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>Create account</Btn>
      </form>
    </div>
  );
}

// ============================================================
// SECTION 16: DASHBOARD (watchlist feed, referrals, billing)
// ============================================================
function Dashboard({ user, setUser, setPage, problems }) {
  const [tab, setTab] = useState("feed");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const mySubmissions = problems.filter(p => p.submitterEmail === user?.email);
  const watchedProblems = problems.filter(p => p.watchers.includes(user?.id));
  const referrals = db.get("referral_conversions", []).filter(r => r.code === user?.referralCode);
  const referralUrl = `https://terraincognita.io/r/${user?.referralCode}`;
  const [copied, setCopied] = useState(false);

  function copyReferral() {
    navigator.clipboard.writeText(referralUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function upgrade(plan) {
    setCheckoutLoading(true);
    await createCheckoutSession({ plan, userId: user.id });
    const updated = confirmPayment({ userId: user.id, plan });
    setUser(updated);
    sendEmail({ to: user.email, subject: `You're now on ${plan === "pro" ? "Pro" : "Institution"}`, body: "Your upgrade is confirmed.", template: "upgrade_confirmed" });
    trackEvent("checkout_completed", { plan });
    setCheckoutLoading(false);
  }

  const planBadge = { free: { bg: "#F1EFE8", text: "#5F5E5A", label: "Free" }, pro: { bg: "#EEEDFE", text: "#3C3489", label: "Pro" }, institution: { bg: "#E6F1FB", text: "#0C447C", label: "Institution" } };
  const plan = planBadge[user?.plan] || planBadge.free;
  const tabs = ["feed", "submissions", "referrals", "billing", "settings"];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Welcome, {user?.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{user?.email}</span>
            <span style={{ background: plan.bg, color: plan.text, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20 }}>{plan.label}</span>
          </div>
        </div>
        <Btn size="sm" onClick={() => setPage("submit")}><Icon name="plus" size={14} />Submit a problem</Btn>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--color-text-primary)" : "2px solid transparent", padding: "8px 14px", fontSize: 14, color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", cursor: "pointer", fontWeight: tab === t ? 500 : 400, marginBottom: -1, whiteSpace: "nowrap" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "feed" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>Updates from the {watchedProblems.length} problem{watchedProblems.length === 1 ? "" : "s"} you follow.</p>
          {watchedProblems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-secondary)", fontSize: 14 }}>You're not following any problems yet. <button onClick={() => setPage("browse")} style={{ color: "var(--color-text-primary)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Browse problems</button></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {watchedProblems.map(p => (
                <div key={p.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.title}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.status === "solved" && <div style={{ fontSize: 12, color: "#0C447C", marginTop: 6 }}>✓ Solved {p.solvedAt} — {p.solvedRef}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "submissions" && (
        <div>
          {mySubmissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-secondary)", fontSize: 14 }}><p style={{ marginBottom: "1rem" }}>No submissions yet.</p><Btn size="sm" onClick={() => setPage("submit")}>Submit your first problem</Btn></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mySubmissions.map(p => (
                <div key={p.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div><div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{p.title}</div><Badge field={p.field} /></div>
                  <StatusBadge status={p.approved ? p.status : "pending"} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "referrals" && (
        <div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Your referral link</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={referralUrl} style={{ flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
              <Btn size="sm" onClick={copyReferral}>{copied ? "Copied!" : "Copy"}</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem" }}><div style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>{referrals.length}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Successful referrals</div></div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem" }}><div style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>{referrals.length >= 3 ? "Pro" : `${3 - referrals.length} more`}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{referrals.length >= 3 ? "Unlocked free" : "to unlock free Pro month"}</div></div>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div>
          {user?.plan === "free" ? (
            <div>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>Upgrade for unlimited submissions, API access, and CSV export.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn disabled={checkoutLoading} onClick={() => upgrade("pro")}>{checkoutLoading ? "Processing…" : "Upgrade to Pro — $12/mo"}</Btn>
                <Btn variant="secondary" disabled={checkoutLoading} onClick={() => upgrade("institution")}>{checkoutLoading ? "Processing…" : "Institution — $199/mo"}</Btn>
              </div>
            </div>
          ) : (
            <div style={{ background: "#EAF3DE", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#27500A", marginBottom: 4 }}>You're on the {plan.label} plan</div>
              <div style={{ fontSize: 13, color: "#3B6D11" }}>Started {user.planStartedAt?.slice(0, 10) || "—"}</div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 480 }}>
          <Input label="Name" defaultValue={user?.name} />
          <Input label="Email" type="email" defaultValue={user?.email} />
          <Btn variant="secondary">Save changes</Btn>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 17: ADMIN (queue, CSV export, leaderboard, mark solved → email blast)
// ============================================================
function Admin({ user, setPage, problems, setProblems }) {
  const [tab, setTab] = useState("queue");
  const users = db.get("users", []);
  const waitlist = db.get("waitlist", []);
  const emailLog = db.get("email_log", []);
  const events = db.get("analytics_events", []);
  const subscriptions = db.get("subscriptions", []);

  if (user?.role !== "admin") return <div style={{ maxWidth: 400, margin: "4rem auto", textAlign: "center", padding: "0 1.5rem" }}><h2 style={{ color: "var(--color-text-primary)" }}>Access denied</h2></div>;

  const queue = problems.filter(p => !p.approved);
  const approved = problems.filter(p => p.approved);

  function approve(id) {
    const p = problems.find(x => x.id === id);
    const updated = problems.map(x => x.id === id ? { ...x, approved: true } : x);
    db.set("problems", updated); setProblems(updated);
    if (p.submitterEmail) sendEmail({ to: p.submitterEmail, subject: `Your problem "${p.title}" is live`, body: "Editorial review passed — it's now visible to everyone.", template: "submission_approved" });
    trackEvent("admin_approved", { problemId: id });
  }
  function reject(id) {
    const p = problems.find(x => x.id === id);
    const updated = problems.filter(x => x.id !== id);
    db.set("problems", updated); setProblems(updated);
    if (p.submitterEmail) sendEmail({ to: p.submitterEmail, subject: `About your submission "${p.title}"`, body: "After review, we're not able to publish this submission. Reasons may include insufficient sourcing or an existing accepted solution.", template: "submission_rejected" });
    trackEvent("admin_rejected", { problemId: id });
  }
  function markSolved(id) {
    const p = problems.find(x => x.id === id);
    const updated = problems.map(x => x.id === id ? { ...x, status: "solved", solvedAt: new Date().toISOString().slice(0, 10), solvedRef: "Reference pending editorial follow-up", versions: [...x.versions, { at: new Date().toISOString().slice(0, 10), note: "Marked solved" }] } : x);
    db.set("problems", updated); setProblems(updated);
    p.watchers.forEach(uid => {
      const u = users.find(x => x.id === uid);
      if (u) sendEmail({ to: u.email, subject: `Solved: ${p.title}`, body: `A problem you follow has been resolved. ${p.watchers.length} other followers were notified too.`, template: "solved_event" });
    });
    trackEvent("problem_marked_solved", { problemId: id, watcherCount: p.watchers.length });
  }

  function exportCSV() {
    const headers = ["id", "title", "field", "status", "votes", "watchers", "createdAt"];
    const rows = approved.map(p => [p.id, `"${p.title.replace(/"/g, '""')}"`, p.field, p.status, p.votes.length, p.watchers.length, p.createdAt].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "terra-incognita-problems.csv"; a.click();
    trackEvent("admin_export_csv");
  }

  const topSubmitters = Object.entries(problems.filter(p => p.submitterEmail).reduce((acc, p) => { acc[p.submitterEmail] = (acc[p.submitterEmail] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topVoters = Object.entries(problems.flatMap(p => p.votes).reduce((acc, uid) => { acc[uid] = (acc[uid] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const mrr = subscriptions.filter(s => s.status === "active").reduce((sum, s) => sum + s.mrr, 0);
  const funnelSteps = [
    { label: "Waitlist signups", n: waitlist.length },
    { label: "Account signups", n: events.filter(e => e.name === "signup").length },
    { label: "Submitted a problem", n: events.filter(e => e.name === "problem_submitted").length },
    { label: "Upgraded to paid", n: events.filter(e => e.name === "checkout_completed").length },
  ];

  const kpis = [{ n: approved.length, l: "Live problems" }, { n: queue.length, l: "Pending review" }, { n: users.length, l: "Registered users" }, { n: `$${mrr}`, l: "MRR" }];
  const tabs = ["queue", "live", "users", "analytics", "growth", "institutions"];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>Admin</h1>
        <Btn size="sm" variant="ghost" onClick={exportCSV}><Icon name="download" size={14} />Export CSV</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
        {kpis.map((k, i) => <div key={i} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem" }}><div style={{ fontSize: 26, fontWeight: 500, color: "var(--color-text-primary)" }}>{k.n}</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{k.l}</div></div>)}
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--color-text-primary)" : "2px solid transparent", padding: "8px 14px", fontSize: 14, color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)", cursor: "pointer", fontWeight: tab === t ? 500 : 400, marginBottom: -1, whiteSpace: "nowrap" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}{t === "queue" && queue.length > 0 && <span style={{ background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 500, padding: "1px 5px", borderRadius: 10, marginLeft: 6 }}>{queue.length}</span>}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <div>
          {queue.length === 0 ? <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Queue is clear.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {queue.map(p => (
                <div key={p.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{p.title}</div>
                      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>{p.summary}</p>
                      <div style={{ display: "flex", gap: 6 }}><Badge field={p.field} /><StatusBadge status={p.status} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Btn size="sm" variant="success" onClick={() => approve(p.id)}><Icon name="check" size={13} />Approve</Btn>
                      <Btn size="sm" variant="danger" onClick={() => reject(p.id)}><Icon name="x" size={13} />Reject</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "live" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {approved.map(p => (
            <div key={p.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.title}</span><div style={{ display: "flex", gap: 6, marginTop: 4 }}><Badge field={p.field} /><StatusBadge status={p.status} /></div></div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{p.watchers.length} following</span>
                {p.status !== "solved" && <Btn size="sm" variant="ghost" onClick={() => markSolved(p.id)}>Mark solved + notify</Btn>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", borderBottom: "0.5px solid var(--color-border-tertiary)", paddingBottom: 8, marginBottom: 8 }}>
            {["Name", "Email", "Plan", "Joined"].map(h => <span key={h} style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</span>)}
          </div>
          {users.map(u => (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "var(--color-text-primary)" }}>{u.name}</span>
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{u.email}</span>
              <span style={{ fontSize: 12, textTransform: "capitalize", color: "var(--color-text-secondary)" }}>{u.plan}</span>
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{u.joined}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "analytics" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>Problems by field</div>
            {FIELDS.filter(fl => approved.some(p => p.field === fl)).map(fl => {
              const count = approved.filter(p => p.field === fl).length; const pct = Math.round(count / approved.length * 100);
              return <div key={fl} style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ color: "var(--color-text-primary)" }}>{fl}</span><span style={{ color: "var(--color-text-secondary)" }}>{count}</span></div><div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 4 }}><div style={{ height: 4, background: FIELD_COLORS[fl]?.dot || "#888", borderRadius: 4, width: `${pct}%` }} /></div></div>;
            })}
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>Conversion funnel</div>
            {funnelSteps.map((s, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ color: "var(--color-text-primary)" }}>{s.label}</span><span style={{ color: "var(--color-text-secondary)" }}>{s.n}</span></div>
                <div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 4 }}><div style={{ height: 4, background: "#534AB7", borderRadius: 4, width: `${Math.min(100, s.n * 8)}%` }} /></div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>Recent events (PostHog-style log)</div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {events.slice(0, 12).map((e, i) => <div key={i} style={{ fontSize: 12, color: "var(--color-text-tertiary)", padding: "4px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{e.name} {Object.keys(e.props).length > 0 && <span>· {JSON.stringify(e.props)}</span>}</div>)}
            </div>
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>Email log (Resend-style)</div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {emailLog.slice(0, 8).map(e => <div key={e.id} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}><span style={{ color: "var(--color-text-primary)" }}>{e.subject}</span> → {e.to}</div>)}
              {emailLog.length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No emails sent yet.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === "growth" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}><Icon name="crown" size={14} /> Top contributors</div>
            {topSubmitters.map(([email, n], i) => <div key={email} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "var(--color-text-primary)" }}>{i + 1}. {email}</span><span style={{ color: "var(--color-text-secondary)" }}>{n} submitted</span></div>)}
            {topSubmitters.length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No submissions yet.</div>}
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "1rem" }}><Icon name="star" size={14} /> Top voters</div>
            {topVoters.map(([uid, n], i) => { const u = users.find(x => x.id === uid); return <div key={uid} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "var(--color-text-primary)" }}>{i + 1}. {u?.name || uid}</span><span style={{ color: "var(--color-text-secondary)" }}>{n} votes</span></div>; })}
          </div>
        </div>
      )}

      {tab === "institutions" && (
        <div>
          {db.get("institutions", []).map(inst => (
            <div key={inst.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}><Icon name="building" size={15} /> {inst.name}</div>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{inst.members.length}/{inst.seats} seats</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                {inst.members.map(m => <div key={m.email} style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between" }}><span>{m.email}</span><span style={{ textTransform: "capitalize" }}>{m.role}</span></div>)}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Collections: {inst.collections.map(c => c.name).join(", ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 18: PROBLEM OF THE WEEK
// ============================================================
function ProblemOfWeek({ problems, setPage, setDetail }) {
  const potw = db.get("problem_of_week", SEED_PROBLEM_OF_WEEK);
  const problem = problems.find(p => p.id === potw.problemId);
  if (!problem) return null;
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "inline-block", background: "#FAEEDA", color: "#633806", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20, marginBottom: "1rem" }}>PROBLEM OF THE WEEK · {potw.week}</div>
      <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>{problem.title}</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem" }}><Badge field={problem.field} /><StatusBadge status={problem.status} /></div>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", marginBottom: 6 }}>Curator's note</div>
        <p style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>{potw.curatorNote}</p>
      </div>
      <div style={{ fontSize: 15, color: "var(--color-text-primary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
        {potw.body.split("\n").map((line, i) => {
          if (line.startsWith("# ")) return <h2 key={i} style={{ fontSize: 20, fontWeight: 600, margin: "1rem 0 0.5rem" }}>{line.slice(2)}</h2>;
          if (line.startsWith("## ")) return <h3 key={i} style={{ fontSize: 16, fontWeight: 600, margin: "1rem 0 0.5rem" }}>{line.slice(3)}</h3>;
          if (!line.trim()) return null;
          return <p key={i} style={{ marginBottom: "0.75rem" }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />;
        })}
      </div>
      <div style={{ marginTop: "1.5rem" }}>
        <Btn onClick={() => setDetail(problem)}>View full problem entry <Icon name="arrow" size={15} /></Btn>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 19: BLOG (with MDX-style rendering + editor for admin)
// ============================================================
function Blog({ user, setPage }) {
  const [posts, setPosts] = useState(db.get("blog", SEED_BLOG));
  const [active, setActive] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", excerpt: "", body: "" });

  function publish() {
    const slug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newPost = { id: Date.now(), slug, title: draft.title, excerpt: draft.excerpt, body: draft.body, date: new Date().toISOString().slice(0, 10) };
    const updated = [newPost, ...posts];
    db.set("blog", updated); setPosts(updated); setEditing(false); setDraft({ title: "", excerpt: "", body: "" });
    trackEvent("blog_published", { slug });
  }

  function renderMd(md) {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} style={{ fontSize: 24, fontWeight: 600, margin: "1rem 0 0.5rem", color: "var(--color-text-primary)" }}>{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: 18, fontWeight: 600, margin: "1rem 0 0.5rem", color: "var(--color-text-primary)" }}>{line.slice(3)}</h2>;
      if (!line.trim()) return null;
      return <p key={i} style={{ marginBottom: "0.75rem", fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)" }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />;
    });
  }

  if (active) return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <button onClick={() => setActive(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 13, marginBottom: "1.5rem" }}>← Back to blog</button>
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 10 }}>{active.date}</div>
      {renderMd(active.body)}
    </div>
  );

  if (editing) return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: "1.25rem", color: "var(--color-text-primary)" }}>New post (MDX editor)</h1>
      <Input label="Title" value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} />
      <Input label="Excerpt" value={draft.excerpt} onChange={e => setDraft(p => ({ ...p, excerpt: e.target.value }))} />
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Body (Markdown/MDX)</label>
        <textarea value={draft.body} onChange={e => setDraft(p => ({ ...p, body: e.target.value }))} rows={12} placeholder="# Heading&#10;&#10;Write in markdown. **Bold** supported." style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "monospace", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={publish}>Publish</Btn>
        <Btn variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>Blog</h1>
        {user?.role === "admin" && <Btn size="sm" onClick={() => setEditing(true)}><Icon name="plus" size={14} />New post</Btn>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {posts.map(p => (
          <div key={p.id} onClick={() => setActive(p)} style={{ cursor: "pointer", borderBottom: "0.5px solid var(--color-border-tertiary)", paddingBottom: "1.25rem" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 4 }}>{p.date}</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{p.excerpt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SECTION 20: PRICING
// ============================================================
function Pricing({ setPage, user }) {
  const plans = [
    { id: "free", name: "Free", price: "$0", period: "", desc: "For curious individuals.", features: ["Browse all problems", "Follow up to 10 problems", "3 submissions/day", "Community access"], cta: "Get started" },
    { id: "pro", name: "Pro", price: "$12", period: "/month", desc: "For researchers and serious learners.", features: ["Everything in Free", "Unlimited follows & submissions", "API access (1K req/day)", "CSV export", "BibTeX citations", "Problem of the Week digest"], cta: "Start free trial", highlight: true },
    { id: "institution", name: "Institution", price: "$199", period: "/month", desc: "For universities, labs, and foundations.", features: ["Everything in Pro", "Team dashboard (up to 50 seats)", "Custom collections", "Full API access", "Sponsored bounty listings", "Dedicated support"], cta: "Contact us" },
  ];
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>Simple, transparent pricing</h1>
        <p style={{ fontSize: 16, color: "var(--color-text-secondary)" }}>Browse free forever. Pay only when you need professional tools.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {plans.map(p => (
          <div key={p.id} style={{ background: "var(--color-background-primary)", border: p.highlight ? "2px solid #534AB7" : "0.5px solid var(--color-border-tertiary)", borderRadius: 14, padding: "1.5rem", position: "relative" }}>
            {p.highlight && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#534AB7", color: "#fff", fontSize: 11, fontWeight: 500, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Most popular</div>}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}><span style={{ fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)" }}>{p.price}</span><span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{p.period}</span></div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{p.desc}</div>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              {p.features.map(f => <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}><Icon name="check" size={14} style={{ color: "#3B6D11", flexShrink: 0, marginTop: 1 }} /><span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{f}</span></div>)}
            </div>
            <Btn variant={p.highlight ? "primary" : "secondary"} style={{ width: "100%", justifyContent: "center" }} onClick={() => setPage(user ? "dashboard" : "signup")}>{p.cta}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SECTION 21: API DOCS PAGE (simulated GET /api/problems)
// ============================================================
function ApiDocs({ problems }) {
  const [field, setField] = useState(""); const [status, setStatus] = useState(""); const [page2, setPage2] = useState(1);
  const perPage = 5;
  const filtered = problems.filter(p => p.approved && (!field || p.field === field) && (!status || p.status === status));
  const paged = filtered.slice((page2 - 1) * perPage, page2 * perPage);
  const responseShape = { data: paged.map(p => ({ id: p.id, slug: p.slug, title: p.title, field: p.field, status: p.status, votes: p.votes.length, watchers: p.watchers.length })), pagination: { page: page2, perPage, total: filtered.length, totalPages: Math.ceil(filtered.length / perPage) } };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 8 }}>API · GET /api/problems</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>Try the live query below. Pro plan required in production for &gt;100 req/day.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        <select value={field} onChange={e => { setField(e.target.value); setPage2(1); }} style={{ padding: "6px 10px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">field=any</option>{FIELDS.map(f => <option key={f} value={f}>field={f}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage2(1); }} style={{ padding: "6px 10px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">status=any</option><option value="open">status=open</option><option value="partial">status=partial</option><option value="solved">status=solved</option>
        </select>
      </div>
      <pre style={{ background: "#1a1a1a", color: "#e8e6e0", padding: "1rem", borderRadius: 10, fontSize: 12, overflow: "auto", lineHeight: 1.6 }}>{JSON.stringify(responseShape, null, 2)}</pre>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn size="sm" variant="ghost" disabled={page2 === 1} onClick={() => setPage2(p => p - 1)}>← Prev</Btn>
        <Btn size="sm" variant="ghost" disabled={page2 >= Math.ceil(filtered.length / perPage)} onClick={() => setPage2(p => p + 1)}>Next →</Btn>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 22: ONBOARDING WIZARD (3-step)
// ============================================================
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState([]);
  const [goal, setGoal] = useState("");

  function toggle(f) { setPicked(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]); }

  return (
    <Modal open title="" onClose={() => onComplete(picked, goal)} width={460}>
      <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem" }}>
        {[1, 2, 3].map(s => <div key={s} style={{ flex: 1, height: 3, borderRadius: 4, background: s <= step ? "#534AB7" : "var(--color-border-tertiary)" }} />)}
      </div>
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6, color: "var(--color-text-primary)" }}>What brings you here?</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>This helps us tailor your feed.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["I'm a researcher", "I'm a student", "I'm just curious", "I'm a journalist / writer"].map(g => (
              <button key={g} onClick={() => setGoal(g)} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: `1px solid ${goal === g ? "#534AB7" : "var(--color-border-secondary)"}`, background: goal === g ? "#EEEDFE" : "var(--color-background-primary)", cursor: "pointer", fontSize: 14, color: "var(--color-text-primary)" }}>{g}</button>
            ))}
          </div>
          <Btn style={{ marginTop: "1.5rem", width: "100%", justifyContent: "center" }} disabled={!goal} onClick={() => setStep(2)}>Continue</Btn>
        </div>
      )}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6, color: "var(--color-text-primary)" }}>Pick your fields of interest</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>Choose as many as you like.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FIELDS.map(f => (
              <button key={f} onClick={() => toggle(f)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: `1px solid ${picked.includes(f) ? "#534AB7" : "var(--color-border-secondary)"}`, background: picked.includes(f) ? "#EEEDFE" : "var(--color-background-primary)", color: picked.includes(f) ? "#3C3489" : "var(--color-text-secondary)", cursor: "pointer" }}>{f}</button>
            ))}
          </div>
          <Btn style={{ marginTop: "1.5rem", width: "100%", justifyContent: "center" }} disabled={picked.length === 0} onClick={() => setStep(3)}>Continue</Btn>
        </div>
      )}
      {step === 3 && (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 52, height: 52, background: "#EAF3DE", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}><Icon name="check" size={24} style={{ color: "#27500A" }} /></div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6, color: "var(--color-text-primary)" }}>You're all set</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>We'll prioritize {picked.join(", ")} in your feed.</p>
          <Btn style={{ width: "100%", justifyContent: "center" }} onClick={() => onComplete(picked, goal)}>Start exploring</Btn>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// SECTION 23: MOBILE APP WRAPPER NOTICE
// ============================================================
function MobileNotice({ setPage }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <Icon name="smartphone" size={28} style={{ color: "var(--color-text-tertiary)", marginBottom: "1rem" }} />
      <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 8 }}>Mobile app (Expo / React Native)</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1rem" }}>
        The web app's components are structured to share business logic with a React Native build via Expo. The <code>db</code>, <code>fuzzySearch</code>, <code>checkRateLimit</code>, and <code>getRelated</code> functions in this file have zero DOM dependencies — they port directly. Only the styled <code>div</code>-based components need swapping for native equivalents (View, Text, FlatList).
      </p>
      <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>See README.md → "Mobile" section for the Expo scaffold command and folder structure.</p>
      <Btn style={{ marginTop: "1rem" }} onClick={() => setPage("landing")}>Back home</Btn>
    </div>
  );
}

// ============================================================
// SECTION 24: APP SHELL
// ============================================================
export default function App() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);
  const [problems, setProblems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [solvedView, setSolvedView] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    initStore();
    setProblems(db.get("problems", SEED_PROBLEMS));
    // simulate referral capture from URL-style param
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) sessionStorage.setItem("ti_ref", ref);
  }, []);

  function handleSignupComplete() {
    setShowOnboarding(true);
  }

  function toggleWatchGlobal(p) {
    if (!user) return;
    const updated = problems.map(x => x.id === p.id ? { ...x, watchers: x.watchers.includes(user.id) ? x.watchers.filter(w => w !== user.id) : [...x.watchers, user.id] } : x);
    db.set("problems", updated); setProblems(updated);
    setDetail(updated.find(x => x.id === p.id));
  }
  function voteGlobal(p) {
    if (!user) return;
    const updated = problems.map(x => x.id === p.id ? { ...x, votes: x.votes.includes(user.id) ? x.votes.filter(v => v !== user.id) : [...x.votes, user.id] } : x);
    db.set("problems", updated); setProblems(updated);
    setDetail(updated.find(x => x.id === p.id));
  }

  const pages = {
    landing: <Landing setPage={setPage} problems={problems} user={user} setDetail={setDetail} />,
    browse: <Browse user={user} problems={problems} setProblems={setProblems} setDetail={setDetail} />,
    submit: <Submit user={user} setUser={setUser} setPage={setPage} problems={problems} setProblems={setProblems} />,
    login: <Login setPage={setPage} setUser={setUser} />,
    signup: <Signup setPage={(p) => { setPage(p); handleSignupComplete(); }} setUser={setUser} />,
    dashboard: <Dashboard user={user} setUser={setUser} setPage={setPage} problems={problems} />,
    admin: <Admin user={user} setPage={setPage} problems={problems} setProblems={setProblems} />,
    pricing: <Pricing setPage={setPage} user={user} />,
    potw: <ProblemOfWeek problems={problems} setPage={setPage} setDetail={setDetail} />,
    blog: <Blog user={user} setPage={setPage} />,
    api: <ApiDocs problems={problems} />,
    mobile: <MobileNotice setPage={setPage} />,
    solved: <SolvedEvent problem={solvedView} setPage={setPage} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-primary)", fontFamily: "var(--font-sans)" }}>
      <Nav page={page} setPage={setPage} user={user} setUser={setUser} />
      <main>{pages[page] || pages.landing}</main>
      {detail && <ProblemDetail p={detail} onClose={() => setDetail(null)} user={user} problems={problems} onToggleWatch={toggleWatchGlobal} onVote={voteGlobal} onOpenRelated={(r) => setDetail(r)} />}
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
      <div style={{ position: "fixed", bottom: 12, right: 12, display: "flex", gap: 6 }}>
        <button onClick={() => setPage("api")} title="API docs" style={{ background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>API docs</button>
        <button onClick={() => { const solved = problems.find(p => p.status === "solved"); setSolvedView(solved); setPage("solved"); }} title="Demo solved event" style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Demo: Solved event</button>
        <button onClick={() => setPage("mobile")} title="Mobile" style={{ background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 20, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Mobile</button>
      </div>
    </div>
  );
}

/* ============================================================
README — REAL BACKEND MIGRATION NOTES
============================================================

SUPABASE SCHEMA (run as SQL migration):

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text default 'user' check (role in ('user','admin')),
  plan text default 'free' check (plan in ('free','pro','institution')),
  referral_code text unique,
  referred_by text,
  submissions_today int default 0,
  last_submission_date date,
  created_at timestamptz default now()
);

create table problems (
  id bigint generated always as identity primary key,
  slug text unique not null,
  field text not null,
  title text not null,
  summary text not null,
  detail text not null,
  status text default 'open' check (status in ('open','partial','solved')),
  difficulty text,
  bounty numeric default 0,
  year int,
  submitter text,
  submitter_email text references users(email),
  tags text[],
  approved boolean default false,
  solved_at date,
  solved_ref text,
  created_at timestamptz default now()
);

create table watchers (problem_id bigint references problems(id), user_id uuid references users(id), primary key (problem_id, user_id));
create table votes (problem_id bigint references problems(id), user_id uuid references users(id), primary key (problem_id, user_id));
create table waitlist (email text primary key, joined_at timestamptz default now());
create table subscriptions (id bigint generated always as identity primary key, user_id uuid references users(id), plan text, status text, mrr numeric, started_at timestamptz default now());
create table referral_conversions (code text, converted_user_id uuid references users(id), at timestamptz default now());
create table blog_posts (id bigint generated always as identity primary key, slug text unique, title text, excerpt text, body text, published_at timestamptz default now());
create table institutions (id bigint generated always as identity primary key, name text, owner_id uuid references users(id), seats int);
create table institution_members (institution_id bigint references institutions(id), email text, role text);
create table problem_versions (id bigint generated always as identity primary key, problem_id bigint references problems(id), note text, at timestamptz default now());

SWAP POINTS IN THIS FILE:
- db.get/db.set        → supabase.from(table).select()/.insert()/.update()
- sendEmail()          → Resend SDK: resend.emails.send({ from, to, subject, html })
- createCheckoutSession → stripe.checkout.sessions.create({ line_items, mode: 'subscription' })
- confirmPayment        → Stripe webhook handler on 'checkout.session.completed'
- oauthSignIn()         → supabase.auth.signInWithOAuth({ provider })
- trackEvent()          → posthog.capture(name, props) or window.plausible(name, { props })
- fuzzySearch()         → Algolia/Typesense client query, or Postgres full-text search (tsvector)

MOBILE (Expo):
  npx create-expo-app terra-mobile
  Port: db, fuzzySearch, getRelated, checkRateLimit (pure functions, no DOM deps)
  Replace: div→View, span/p→Text, input→TextInput, button→Pressable
============================================================ */
