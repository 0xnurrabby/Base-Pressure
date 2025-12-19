// Base Pressure — Farcaster Mini App (Base)
// Domain: https://nurrabby.com/
//
// Mini App SDK
import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk@0.2.1";

// Builder Codes (ERC-8021)
import { Attribution } from "https://esm.sh/ox/erc8021";
const BUILDER_CODE = "TODO_REPLACE_BUILDER_CODE";
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
let isMini = false;
try {
  isMini = await sdk.isInMiniApp();
} catch {
  isMini = false;
}

if (!isMini) {
  // Hard gate: do not run the game in browser mode.
  miniOnly.hidden = false;
  // Still call ready() so embed preview isn't stuck on splash in hosts that partially load.
  try { await sdk.actions.ready(); } catch {}
  throw new Error("Not running in Mini App context.");
}

// Load context ASAP (used for display name + pfp)
let fcUser = null;
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
// Local leaderboard (offchain)
// ---------------------------
const LS_KEY = "base_pressure_leaderboard_v1";

function loadEntries() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
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

function displayName() {
  if (fcUser?.displayName) return fcUser.displayName;
  if (fcUser?.username) return `@${fcUser.username}`;
  if (walletAddress) return `${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`;
  return "anon";
}

function renderBoard() {
  const entries = filterBoard(loadEntries(), activeBoard)
    .sort((a,b) => (b.score - a.score) || (b.ts - a.ts))
    .slice(0, 10);

  if (!entries.length) {
    boardEl.innerHTML = `<div class="row"><div class="rowLeft"><div class="rank">—</div><div class="rowUser"><div class="rowName">No scores yet</div><div class="rowMeta">Bank a run to appear here.</div></div></div><div class="rowScore">0</div></div>`;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"})[c]);
}

// ---------------------------
// Game state
// ---------------------------
let walletProvider = null;
let walletAddress = null;

let total = 0;
let run = 0;
let pumps = 0;
let multiplier = 1.0;
let popped = false;

function formatInt(n) {
  return Math.max(0, Math.floor(n)).toLocaleString();
}

function calcRisk(pumpsCount) {
  // High-tension curve, but keep it fair early.
  const base = 0.03;                  // 3%
  const ramp = 0.018 * pumpsCount;    // +1.8% per pump
  const jitter = 0.0;                 // shown risk doesn't include hidden jitter
  return Math.min(0.92, base + ramp + jitter);
}

function calcHiddenRisk(pumpsCount) {
  // Add some randomness so it's not perfectly predictable.
  const shown = calcRisk(pumpsCount);
  const jitter = (Math.random() * 0.06); // up to +6%
  return Math.min(0.97, shown + jitter);
}

function updateUI() {
  runPointsEl.textContent = formatInt(run);
  totalPointsEl.textContent = formatInt(total);
  multEl.textContent = `${multiplier.toFixed(1)}x`;
  riskEl.textContent = `${Math.round(calcRisk(pumps) * 100)}%`;

  // Bubble scale (keep always on screen)
  const maxScale = 1.35;
  const scale = Math.min(maxScale, 1 + pumps * 0.03);
  bubble.style.transform = `scale(${scale})`;
  bubbleGlow.style.transform = `scale(${Math.min(1.45, scale + 0.08)})`;
  bubble.style.filter = `saturate(${1 + pumps * 0.01})`;

  // Controls
  const canPlay = !!walletAddress && !popped;
  pumpBtn.disabled = !canPlay;
  bankBtn.disabled = !canPlay || run <= 0;

  // Mint button appears if total is a new personal best (local)
  const entries = loadEntries();
  const best = entries.reduce((m, e) => Math.max(m, e.score || 0), 0);
  mintRow.hidden = !(total > 0 && total >= best);
}

function resetRun(reason = "") {
  run = 0;
  pumps = 0;
  multiplier = 1.0;
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

  // Score
  pumps += 1;
  multiplier = Math.min(9.9, 1 + pumps * 0.12);
  const gained = Math.floor(10 * multiplier);
  run += gained;

  // Feedback (haptics + rising tone)
  const vib = Math.min(75, 18 + pumps * 6);
  vibrate(vib);
  blip(220 + pumps * 26, 0.07);

  // Pop check
  const risk = calcHiddenRisk(pumps);
  if (Math.random() < risk) {
    popped = true;
    run = 0;
    pumps = 0;
    multiplier = 1.0;

    glassBreak();
    flashRed();
    vibrate(160);
    toast("💥 POP! You lost the run. Bank earlier.");
    updateUI();
    // Allow immediate new run
    popped = false;
    updateUI();
    return;
  }

  updateUI();
});

bankBtn.addEventListener("click", () => {
  if (!walletAddress || run <= 0) return;

  total += run;

  const entries = loadEntries();
  entries.push({
    ts: nowMs(),
    score: total,
    run,
    pumps,
    wallet: walletAddress,
    username: fcUser?.username ?? null,
    name: fcUser?.displayName ?? null,
  });
  saveEntries(entries);

  toast(`Banked +${formatInt(run)}. Total: ${formatInt(total)}`);
  run = 0;
  pumps = 0;
  multiplier = 1.0;

  updateUI();
  renderBoard();
});

// Reset local scores
resetBtn.addEventListener("click", () => {
  if (!confirm("Reset local (offchain) leaderboard data on this device?")) return;
  saveEntries([]);
  total = 0;
  resetRun("Local scores reset.");
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

    // Add a local note that this score was minted
    const entries = loadEntries();
    entries.push({
      ts: nowMs(),
      score: scoreToMint,
      run: 0,
      pumps: 0,
      wallet: walletAddress,
      username: fcUser?.username ?? null,
      name: fcUser?.displayName ?? null,
      minted: true,
    });
    saveEntries(entries);
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
updateUI();
