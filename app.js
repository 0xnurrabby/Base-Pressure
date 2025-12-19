// Base Pressure — Farcaster Mini App (Base)
// Domain: https://base-pressure.vercel.app/
//
// Mini App SDK
import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk@0.2.1";

// Builder Codes (ERC-8021)
import { Attribution } from "https://esm.sh/ox/erc8021";
const BUILDER_CODE = "bc_6f1dev0n";
const dataSuffix = Attribution.toDataSuffix({
  codes: [BUILDER_CODE]
});

// Ethers (ABI encoding)
import { ethers } from "https://esm.sh/ethers@6.13.4";

// ---------------------------
// Constants
// ---------------------------
const BASE_CHAIN_ID_HEX = "0x2105";
const CONTRACT = "0xB331328F506f2D35125e367A190e914B1b6830cF";
const ABI = [
  "function logAction(bytes32 action, bytes data) external"
];

// ---------------------------
// DOM
// ---------------------------
const el = (id) => document.getElementById(id);
const bubble = el("bubble");
const bubbleGlow = el("bubbleGlow");
const bubbleCracks = el("bubbleCracks");
const runPointsEl = el("runPoints");
const totalPointsEl = el("totalPoints");
const multEl = el("multiplier");
const riskEl = el("risk");
const pumpBtn = el("pumpBtn");
const bankBtn = el("bankBtn");
const connectBtn = el("connectBtn");
const profileEl = el("profile");
const toastEl = el("toast");
const mintRow = el("mintRow");
const mintBtn = el("mintBtn");
const boardEl = el("board");
const resetBtn = el("resetBtn");
const miniOnly = el("miniOnly");
const resultModal = el("resultModal");
const resultTitle = el("resultTitle");
const resultBody = el("resultBody");
const resultRank = el("resultRank");
const saveNowBtn = el("saveNowBtn");
const laterBtn = el("laterBtn");

if (miniOnly) miniOnly.hidden = true;

// Tabs
let activeBoard = "daily";
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll(".tab")) t.classList.remove("active");
    tab.classList.add("active");
    activeBoard = tab.dataset.board;
    renderBoard();
  });
}

// ---------------------------
// Mini App detection gate
// ---------------------------
// Some Farcaster clients may not report `isInMiniApp()` correctly on first load.
// We treat the environment as a Mini App if ANY of these succeed:
// - sdk.isInMiniApp() returns true
// - sdk.context can be read
// - sdk.wallet.getEthereumProvider() is available
let isMini = false;
let fcUser = null;

try {
  isMini = await sdk.isInMiniApp();
} catch {
  isMini = false;
}

try {
  const ctx = await sdk.context;
  fcUser = ctx?.user ?? null;
  // If context is readable, we are inside a Mini App host.
  if (fcUser || ctx) isMini = true;
} catch {
  // ignore
}

try {
  // If the host provides the Mini App ethereum provider, we are in Mini App.
  const p = await sdk.wallet.getEthereumProvider();
  if (p) isMini = true;
} catch {
  // ignore
}
// Retry a few times — some clients populate context/provider after a short delay
if (!isMini) {
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 180));

    try {
      const ctx = await sdk.context;
      fcUser = ctx?.user ?? null;
      if (ctx) { isMini = true; break; }
    } catch {}

    try {
      const p = await sdk.wallet.getEthereumProvider();
      if (p) { isMini = true; break; }
    } catch {}
  }
}

// Last-resort fallback: known Mini App hosts user agents
if (!isMini) {
  const ua = navigator.userAgent || "";
  if (/Warpcast|Farcaster|Base|Coinbase/i.test(ua)) isMini = true;
}
// Guaranteed heuristic: Mini Apps are typically embedded (not top-level).
// If we're not the top window, treat as Mini App.
if (!isMini) {
  try {
    if (window.self !== window.top) isMini = true;
  } catch {
    // Accessing window.top can throw in embedded contexts; that's also a signal.
    isMini = true;
  }
}


if (!isMini) {
  // Hard gate: do not run the game in browser mode.
  try { await sdk.actions.ready(); } catch {}
  throw new Error("Not running in Mini App context.");
}

// Load context ASAP (used for display name + pfp)
// (fcUser may already be populated above) (used for display name + pfp)
// fcUser already loaded above when possible
try {
  const ctx = await sdk.context;
  fcUser = ctx?.user ?? null;
} catch {
  fcUser = null;
}

// Now we can show the app.
await sdk.actions.ready();

// ---------------------------
// Haptics & Sound (Web Audio)
// ---------------------------
const vibrate = (ms) => {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {}
};

let audioCtx = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
};

const blip = (pitch = 220, dur = 0.08) => {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = pitch;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start();
    o.stop(now + dur);
  } catch {}
};

const glassBreak = () => {
  try {
    const ctx = getAudioCtx();
    const bufferSize = 0.25 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      out[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const biquad = ctx.createBiquadFilter();
    biquad.type = "highpass";
    biquad.frequency.value = 1200;

    const g = ctx.createGain();
    g.gain.value = 0.25;

    src.connect(biquad);
    biquad.connect(g);
    g.connect(ctx.destination);

    src.start();
  } catch {}
};

// ---------------------------
// Local storage (banks + saved scores)
// ---------------------------
// banks: every successful BANK (for streak/UX), saves: scores that were saved/minted (leaderboard)
const LS_KEY = "base_pressure_state_v2";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { banks: [], saves: [] };
    const parsed = JSON.parse(raw);

    // Migration from older array format
    if (Array.isArray(parsed)) {
      return { banks: parsed, saves: parsed.filter(e => e.minted) };
    }
    return {
      banks: Array.isArray(parsed.banks) ? parsed.banks : [],
      saves: Array.isArray(parsed.saves) ? parsed.saves : [],
    };
  } catch {
    return { banks: [], saves: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

function nowMs() { return Date.now(); }

function startOfDayMs(ts) {
  const d = new Date(ts);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function startOfWeekMs(ts) {
  // ISO-ish week starting Monday
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function pruneState(state) {
  // Keep storage light: banks up to 400 entries, saves up to 200 entries, and drop very old items.
  const cutoff = nowMs() - 1000 * 60 * 60 * 24 * 40; // 40 days
  state.banks = state.banks.filter(e => (e.ts ?? 0) >= cutoff).slice(-400);
  state.saves = state.saves.filter(e => (e.ts ?? 0) >= cutoff).slice(-200);
  return state;
}

function filterBoard(entries, mode) {
  const ts = nowMs();
  if (mode === "daily") {
    const start = startOfDayMs(ts);
    return entries.filter(e => e.ts >= start);
  }
  if (mode === "weekly") {
    const start = startOfWeekMs(ts);
    return entries.filter(e => e.ts >= start);
  }
  return entries;
}

function bestPerWallet(entries) {
  // Leaderboard shows best saved score per wallet (spam-proof)
  const by = new Map();
  for (const e of entries) {
    if (!e?.wallet || !e?.score) continue;
    const prev = by.get(e.wallet);
    if (!prev || e.score > prev.score || (e.score === prev.score && (e.ts ?? 0) > (prev.ts ?? 0))) {
      by.set(e.wallet, e);
    }
  }
  return [...by.values()];
}



// ---------------------------
// Leaderboard rendering (saved scores only)
// ---------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"})[c]);
}

function displayName() {
  if (fcUser?.displayName) return fcUser.displayName;
  if (fcUser?.username) return `@${fcUser.username}`;
  if (walletAddress) return `${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`;
  return "anon";
}

function computeRankPreview(mode, candidate) {
  const state = pruneState(loadState());
  const filtered = filterBoard(state.saves, mode);
  const best = bestPerWallet(filtered);

  // if candidate wallet already has a save, replace it for preview
  const wallet = candidate.wallet;
  const without = best.filter(e => e.wallet !== wallet);
  without.push(candidate);

  const ranked = without
    .sort((a,b) => (b.score - a.score) || ((b.ts ?? 0) - (a.ts ?? 0)));

  const rank = ranked.findIndex(e => e.wallet === wallet) + 1;
  return { rank, total: ranked.length };
}

function renderBoard() {
  const state = pruneState(loadState());
  saveState(state);

  const entries = bestPerWallet(filterBoard(state.saves, activeBoard))
    .sort((a,b) => (b.score - a.score) || ((b.ts ?? 0) - (a.ts ?? 0)))
    .slice(0, 10);

  if (!entries.length) {
    boardEl.innerHTML = `<div class="row"><div class="rowLeft"><div class="rank">—</div><div class="rowUser"><div class="rowName">No scores yet</div><div class="rowMeta">Save a score to appear here.</div></div></div><div class="rowScore">0</div></div>`;
    return;
  }

  boardEl.innerHTML = entries.map((e, i) => {
    const name = e.username ? `@${e.username}` : (e.name || "anon");
    const meta = e.wallet ? `${e.wallet.slice(0,6)}…${e.wallet.slice(-4)}` : "—";
    return `
      <div class="row">
        <div class="rowLeft">
          <div class="rank">${i+1}</div>
          <div class="rowUser">
            <div class="rowName">${escapeHtml(name)}</div>
            <div class="rowMeta">${escapeHtml(meta)}</div>
          </div>
        </div>
        <div class="rowScore">${formatInt(e.score)}</div>
      </div>
    `;
  }).join("");
}

// ---------------------------
// Game state
// ---------------------------
let walletProvider = null;
let walletAddress = null;

let total = 0;       // banked points (offchain)
let run = 0;         // current run points (not yet banked)
let pumps = 0;
let multiplier = 1.0;

// Pressure system
let pressure = 0.0;      // accumulates with each pump
let burstAt = 1.0;       // hidden tolerance threshold per run
let bankStreak = 0;      // consecutive successful BANKs
let popped = false;


function formatInt(n) {
  return Math.max(0, Math.floor(n)).toLocaleString();
}

function newBurstThreshold() {
  // Fair: most runs allow several pumps; some allow long pushes.
  // Values ~ [0.85 .. 1.35]
  const r = Math.random();
  // skewed distribution (more medium, fewer extremes)
  const v = 0.85 + 0.55 * (1 - Math.pow(1 - r, 2));
  return v;
}

function pressureRatio() {
  return burstAt ? Math.min(1.25, pressure / burstAt) : 0;
}

function riskLevel() {
  const x = pressureRatio();
  if (x < 0.45) return "SAFE";
  if (x < 0.70) return "WARM";
  if (x < 0.90) return "DANGER";
  return "CRITICAL";
}

function pumpAdds() {
  // Base increment + ramp (pressure builds faster later)
  const ramp = 0.06 + pumps * 0.012;

  // Streak reward: slightly faster multiplier (not safer)
  const streakBoost = Math.min(0.03, bankStreak * 0.004);

  // Hidden micro-noise (adds unpredictability but still "readable")
  const noise = (Math.random() - 0.5) * 0.018;

  return Math.max(0.02, ramp + streakBoost + noise);
}

function shouldPopThisPump() {
  // Main pop rule: pressure crosses the run’s tolerance.
  if (pressure >= burstAt) return true;

  // Rare surprise pop (thrill) — low early, slightly higher late.
  const x = pressureRatio();
  const surprise = 0.002 + 0.006 * Math.max(0, x - 0.6); // ~0.2% to ~0.6%
  return Math.random() < surprise;
}


function updateUI() {
  runPointsEl.textContent = formatInt(run);
  totalPointsEl.textContent = formatInt(total);
  multEl.textContent = `${multiplier.toFixed(1)}x`;

  const level = riskLevel();
  riskEl.textContent = level;

  // Risk styling (text + bubble language)
  riskEl.classList.remove("riskSafe","riskWarm","riskDanger","riskCritical");
  bubble.classList.remove("lvSafe","lvWarm","lvDanger","lvCritical","streakOn");

  if (level === "SAFE") { riskEl.classList.add("riskSafe"); bubble.classList.add("lvSafe"); }
  if (level === "WARM") { riskEl.classList.add("riskWarm"); bubble.classList.add("lvWarm"); }
  if (level === "DANGER") { riskEl.classList.add("riskDanger"); bubble.classList.add("lvDanger"); }
  if (level === "CRITICAL") { riskEl.classList.add("riskCritical"); bubble.classList.add("lvCritical"); }

  if (bankStreak >= 3) bubble.classList.add("streakOn");

  // Bubble scale (keep always on screen) — capped; intensity increases more than size
  const maxScale = 1.28;
  const scale = Math.min(maxScale, 1 + pumps * 0.022);
  bubble.style.transform = `scale(${scale})`;
  bubbleGlow.style.transform = `scale(${Math.min(1.38, scale + 0.08)})`;

  const x = pressureRatio(); // 0..1+
  bubble.style.filter = `saturate(${1 + x * 0.25}) contrast(${1 + x * 0.18})`;

  // Cracks overlay (signature)
  if (bubbleCracks) {
    const cracks = Math.max(0, (x - 0.82) / 0.25); // shows only late
    bubbleCracks.style.opacity = String(Math.min(1, cracks));
  }

  // Controls
  const canPlay = !!walletAddress && !popped;
  pumpBtn.disabled = !canPlay;
  bankBtn.disabled = !canPlay || run <= 0;

  // Save/Mint button is handled via result modal (never clutters gameplay)
  if (mintRow) mintRow.hidden = true;
}

function resetRun(reason = "") {
  run = 0;
  pumps = 0;
  multiplier = 1.0;

  pressure = 0.0;
  burstAt = newBurstThreshold();

  popped = false;
  flashOff();
  updateUI();
  if (reason) toast(reason);
}

function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.hidden = true;
  }, ms);
}

function flashRed() {
  document.body.animate(
    [
      { backgroundColor: "rgba(255,59,59,0.20)" },
      { backgroundColor: "rgba(0,0,0,0)" },
    ],
    { duration: 300, easing: "ease-out" }
  );
}

function flashOff() {
  // no-op; ensures we don't keep stateful flash overlays

// ---------------------------
// Bank celebration + Save modal
// ---------------------------
function spawnCoins() {
  const host = document.querySelector(".card") || document.body;
  const rect = host.getBoundingClientRect();

  for (let i = 0; i < 10; i++) {
    const c = document.createElement("div");
    c.className = "coin";
    c.style.left = `${rect.width * (0.42 + (Math.random() - 0.5) * 0.18)}px`;
    c.style.top = `${rect.height * 0.56}px`;
    c.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    c.style.setProperty("--dy", `${-120 - Math.random() * 140}px`);
    c.style.setProperty("--rot", `${(Math.random() - 0.5) * 220}deg`);
    host.appendChild(c);
    c.addEventListener("animationend", () => c.remove());
  }

  // Soft cash-in sound
  blip(320, 0.06);
  blip(380, 0.06);
}

function personalBestScore() {
  const state = pruneState(loadState());
  const best = state.banks.reduce((m, e) => Math.max(m, e.total || 0), 0);
  return best;
}

function bestSavedScore() {
  const state = pruneState(loadState());
  const best = state.saves.reduce((m, e) => Math.max(m, e.score || 0), 0);
  return best;
}

function maybeOfferSave() {
  // Unlock conditions (celebration moments)
  const pb = personalBestScore();
  const bestSaved = bestSavedScore();

  const isNewPB = total >= pb && total > 0;
  const isNewSavedPB = total > bestSaved;

  const highMult = multiplier >= 3.0;
  const streakMilestone = bankStreak === 3 || bankStreak === 7 || bankStreak === 30;

  if (!(isNewPB || isNewSavedPB || highMult || streakMilestone)) return;

  // Rank preview (powerful)
  const preview = computeRankPreview(activeBoard, {
    ts: nowMs(),
    score: total,
    wallet: walletAddress,
    username: fcUser?.username ?? null,
    name: fcUser?.displayName ?? null,
  });

  const title = isNewSavedPB ? "🏆 NEW PERSONAL BEST!" : "🔥 NICE RUN!";
  const body = `Total: ${formatInt(total)}  •  Streak: ${bankStreak}`;
  const rankLine = `If you save now, you’ll be #${preview.rank} on ${activeBoard}.`;

  if (resultTitle) resultTitle.textContent = title;
  if (resultBody) resultBody.textContent = body;
  if (resultRank) resultRank.textContent = rankLine;

  if (resultModal) resultModal.hidden = false;
}

function closeResultModal() {
  if (resultModal) resultModal.hidden = true;
}

laterBtn?.addEventListener("click", () => closeResultModal());

saveNowBtn?.addEventListener("click", async () => {
  closeResultModal();
  await mintHighScore();
});
}

// ---------------------------
// Wallet connect (Mini App provider)
// ---------------------------
async function getProvider() {
  if (walletProvider) return walletProvider;
  walletProvider = await sdk.wallet.getEthereumProvider(); // EIP-1193 citeturn1search0
  return walletProvider;
}

async function ensureBaseChain(provider) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === BASE_CHAIN_ID_HEX) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (e) {
    toast("Please switch to Base Mainnet (0x2105) in your wallet.");
    throw e;
  }
}

async function connectWallet() {
  try {
    const provider = await getProvider();
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No account returned");
    walletAddress = ethers.getAddress(accounts[0]);
    await ensureBaseChain(provider);

    renderProfile();
    resetRun("Connected. Pump carefully.");
  } catch (e) {
    toast("Wallet connection cancelled or failed.");
    console.warn(e);
  }
}

function renderProfile() {
  if (!walletAddress) {
    profileEl.innerHTML = `<button class="btn btn-ghost" id="connectBtn">Connect Wallet</button>`;
    el("connectBtn").addEventListener("click", connectWallet);
    return;
  }

  const pfp = fcUser?.pfpUrl ? `<img class="pfp" src="${fcUser.pfpUrl}" alt="" />` : "";
  const handle = fcUser?.username ? `@${fcUser.username}` : `${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`;
  profileEl.innerHTML = `
    ${pfp}
    <div class="handle">${escapeHtml(handle)}</div>
  `;
}

connectBtn?.addEventListener("click", connectWallet);

// ---------------------------
// Game actions
// ---------------------------
pumpBtn.addEventListener("click", () => {
  if (!walletAddress) return;

  // Build pressure first (readable fantasy)
  pumps += 1;
  pressure += pumpAdds();

  // Multiplier grows (streak makes growth feel faster)
  const streakBoost = Math.min(0.35, bankStreak * 0.03);
  multiplier = Math.min(9.9, 1 + pumps * (0.11 + streakBoost * 0.02));

  const gained = Math.floor(10 * multiplier);
  run += gained;

  // Feedback: pressure language (haptics + rising tone)
  const level = riskLevel();
  const vib = level === "SAFE" ? 18 : level === "WARM" ? 32 : level === "DANGER" ? 55 : 78;
  vibrate(vib);

  const ratio = pressureRatio();
  blip(220 + ratio * 520, 0.07);

  if (level === "CRITICAL") {
    // subtle crackle tick (very short)
    blip(820 + Math.random() * 120, 0.03);
  }

  // Pop check
  if (shouldPopThisPump()) {
    popped = true;
    bankStreak = 0;

    glassBreak();
    flashRed();
    vibrate(160);
    toast("💥 POP! You got greedy. Try banking earlier.");

    // instant restart possible
    resetRun();
    renderBoard();
    return;
  }

  updateUI();
});

bankBtn.addEventListener("click", () => {
  if (!walletAddress || run <= 0) return;

  // Relief moment (bank)
  total += run;
  bankStreak += 1;

  // Store bank event (for streak/progression)
  const state = pruneState(loadState());
  state.banks.push({
    ts: nowMs(),
    total,
    run,
    pumps,
    mult: multiplier,
    wallet: walletAddress,
    username: fcUser?.username ?? null,
    name: fcUser?.displayName ?? null,
  });
  saveState(state);

  // Bank animation (coins)
  try { spawnCoins(); } catch {}

  toast(`Banked +${formatInt(run)}. Total: ${formatInt(total)}`);

  // Decide if we should offer SAVE/MINT (celebration moments)
  maybeOfferSave();

  // Reset run pressure for next round (instant restart)
  resetRun();
  renderBoard();
});

// Reset local scores
resetBtn.addEventListener("click", () => {
  if (!confirm("Reset local data on this device? (Banks + Saved leaderboard)")) return;
  saveState({ banks: [], saves: [] });
  total = 0;
  bankStreak = 0;
  resetRun("Local data reset.");
  renderBoard();
});

// ---------------------------
// Mint High Score (contract call)
// ---------------------------
const iface = new ethers.Interface(ABI);

async function mintHighScore() {
  if (!walletAddress) {
    toast("Connect wallet first.");
    return;
  }

  const scoreToMint = total;
  if (!scoreToMint || scoreToMint <= 0) {
    toast("No score to mint yet.");
    return;
  }

  mintBtn.disabled = true;
  try {
    const provider = await getProvider();
    await ensureBaseChain(provider);

    const action = ethers.encodeBytes32String("MINT_HIGH_SCORE");
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256","uint256","string","address"],
      [BigInt(scoreToMint), BigInt(nowMs()), (fcUser?.username ?? ""), walletAddress]
    );

    // Contract call: logAction(bytes32,bytes)
    const data = iface.encodeFunctionData("logAction", [action, payload]);

    // ERC-5792 sendCalls with required fields (Base Build rule)
    const params = {
      version: "2.0.0",
      from: walletAddress,
      chainId: BASE_CHAIN_ID_HEX,
      atomicRequired: true,
      calls: [{
        to: CONTRACT,
        value: "0x0",
        data
      }],
      capabilities: {
        dataSuffix
      }
    };

    // Prefer wallet_sendCalls, fallback to eth_sendTransaction if unavailable.
    try {
      await provider.request({ method: "wallet_sendCalls", params: [params] }); // EIP-5792 citeturn0search3
      toast("Mint submitted. Check your wallet for status.");
    } catch (e) {
      // Fallback: direct tx without sendCalls (still works in some wallets)
      const tx = {
        from: walletAddress,
        to: CONTRACT,
        data,
        value: "0x0"
      };
      await provider.request({ method: "eth_sendTransaction", params: [tx] });
      toast("Mint tx sent (fallback).");
    }

    // Record this as a saved score (leaderboard = best saved per wallet)
    const state = pruneState(loadState());
    state.saves.push({
      ts: nowMs(),
      score: scoreToMint,
      wallet: walletAddress,
      username: fcUser?.username ?? null,
      name: fcUser?.displayName ?? null,
      minted: true
    });
    saveState(state);
    renderBoard();
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("user rejected")) {
      toast("Mint cancelled.");
    } else {
      toast("Mint failed. Try again.");
    }
    console.warn(e);
  } finally {
    mintBtn.disabled = false;
    updateUI();
  }
}

mintBtn.addEventListener("click", mintHighScore);

// ---------------------------
// Init
// ---------------------------
renderProfile();
renderBoard();
resetRun();
updateUI();
