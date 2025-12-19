
import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk@0.2.1";
import { Attribution } from "https://esm.sh/ox@0.6.6/erc8021";
import {
  encodeFunctionData,
  decodeEventLog,
  keccak256,
  stringToHex,
  hexToBigInt,
  parseAbi,
  formatEther,
} from "https://esm.sh/viem@2.21.50";

const DOMAIN = "https://base-pressure.vercel.app/";
const CONTRACT = "0xB331328F506f2D35125e367A190e914B1b6830cF";
const BASE_CHAIN_ID = "0x2105";
const BASE_RPC = "https://mainnet.base.org";

// REQUIRED by your spec:
const BUILDER_CODE = "bc_6f1dev0n";
const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });

const ABI = parseAbi([
  "event ActionLogged(address indexed user, bytes32 indexed action, uint256 timestamp, bytes data)",
  "function logAction(bytes32 action, bytes data) external",
]);

/* ----------------------------- UI scaffolding ----------------------------- */

const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "style") Object.assign(n.style, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
};

const css = `
:root{
  --bg0:#F3F8FF;
  --bg1:#FFFFFF;
  --ink:#0B1220;
  --muted:#5A6B85;
  --glass:rgba(255,255,255,.62);
  --stroke:rgba(0,0,0,.08);
  --blue:#0A7CFF;
  --blue2:#00D4FF;
  --good:#18A957;
  --bad:#E23B3B;
  --shadow: 0 12px 40px rgba(10, 22, 46, .12);
}
*{box-sizing:border-box}
html,body{height:100%; margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: radial-gradient(1200px 800px at 20% 0%, #FFFFFF 0%, var(--bg0) 45%, #EAF3FF 100%); color:var(--ink); overflow:hidden;}
#app{height:100%; padding:14px 14px 18px; padding-bottom: calc(18px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:12px;}
.card{
  background: var(--glass);
  border:1px solid var(--stroke);
  border-radius:20px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}
.topbar{display:flex; gap:10px; align-items:center; padding:12px 12px;}
.brand{display:flex; gap:10px; align-items:center; flex:1;}
.dot{width:36px; height:36px; border-radius:12px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,0) 40%),
              radial-gradient(circle at 70% 70%, rgba(0,212,255,.75), rgba(10,124,255,.75) 60%);
  box-shadow: 0 0 0 1px rgba(10,124,255,.15) inset, 0 10px 18px rgba(10,124,255,.18);
}
.h1{font-weight:800; font-size:16px; letter-spacing:.2px;}
.sub{font-size:12px; color:var(--muted); margin-top:1px}
.pill{
  font-size:12px; padding:8px 10px; border-radius:999px; border:1px solid rgba(0,0,0,.07);
  background: rgba(255,255,255,.75);
}
.btn{
  cursor:pointer; user-select:none;
  border-radius:16px; padding:12px 14px; border:1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.85);
  display:flex; align-items:center; justify-content:center; gap:10px;
  font-weight:800;
  box-shadow: 0 10px 18px rgba(10,22,46,.10);
  transition: transform .08s ease, box-shadow .08s ease, filter .08s ease;
}
.btn:active{transform: translateY(1px) scale(.99); filter: brightness(.98);}
.btn.primary{background: linear-gradient(180deg, rgba(0,212,255,.95), rgba(10,124,255,.95)); color:white; border-color: rgba(255,255,255,.35); box-shadow: 0 16px 30px rgba(10,124,255,.22);}
.btn.danger{background: linear-gradient(180deg, rgba(255,90,90,.95), rgba(226,59,59,.95)); color:white; border-color: rgba(255,255,255,.25);}
.btn.soft{background: rgba(255,255,255,.75);}
.btnRow{display:flex; gap:10px;}
.btnRow .btn{flex:1}
.grid{display:grid; grid-template-columns: 1fr 1fr; gap:10px;}
.k{font-size:11px; color:var(--muted); letter-spacing:.2px;}
.v{font-weight:900; font-size:18px;}
.small{font-size:12px; color:var(--muted)}
.main{flex:1; display:flex; flex-direction:column; gap:12px; min-height:0;}
.stage{flex:1; min-height:0; display:flex; flex-direction:column; gap:12px;}
.bubbleWrap{flex:1; min-height:0; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;}
.bubble{
  width: min(62vw, 260px);
  aspect-ratio:1/1;
  border-radius: 50%;
  position:relative;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.96), rgba(255,255,255,0) 40%),
              radial-gradient(circle at 50% 60%, rgba(0,212,255,.50), rgba(10,124,255,.55) 60%),
              radial-gradient(circle at 65% 35%, rgba(0,212,255,.45), rgba(255,255,255,0) 55%);
  box-shadow: 0 0 0 1px rgba(255,255,255,.35) inset, 0 28px 60px rgba(10,124,255,.26);
  filter: saturate(1.05);
  transform: translateZ(0);
}
.bubble::after{
  content:"";
  position:absolute; inset: -10%;
  border-radius:50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 30%);
  opacity:.7;
}
.rings{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  pointer-events:none;
}
.ring{
  width: 80%;
  height: 80%;
  border-radius:50%;
  border: 1px solid rgba(255,255,255,.35);
  box-shadow: 0 0 0 1px rgba(10,124,255,.10);
  opacity:.5;
}
.flash{
  position:absolute; inset:0; background: rgba(226,59,59,.25);
  opacity:0; pointer-events:none;
}
.flash.on{animation: flash .35s ease;}
@keyframes flash { 0%{opacity:0} 10%{opacity:1} 100%{opacity:0}}
.tabs{display:flex; gap:8px; padding:10px;}
.tab{flex:1; font-size:12px; padding:10px 10px; border-radius:14px; text-align:center; border:1px solid rgba(0,0,0,.08); background: rgba(255,255,255,.65); cursor:pointer; font-weight:800;}
.tab.active{background: rgba(255,255,255,.92); box-shadow: 0 10px 16px rgba(10,22,46,.10); }
.lb{padding:10px 10px 12px; min-height:0; display:flex; flex-direction:column; gap:8px;}
.lbList{overflow:auto; padding:2px 2px 10px; min-height:0;}
.row{display:flex; gap:8px; align-items:center; padding:10px 10px; border-radius:14px; border:1px solid rgba(0,0,0,.07); background: rgba(255,255,255,.75);}
.rank{width:26px; height:26px; border-radius:10px; background: rgba(10,124,255,.10); display:flex; align-items:center; justify-content:center; font-weight:900; color: var(--blue);}
.addr{flex:1; min-width:0;}
.addr .top{font-weight:900; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.addr .bot{font-size:11px; color:var(--muted);}
.score{font-weight:950;}
.toast{position:fixed; left:14px; right:14px; bottom: calc(14px + env(safe-area-inset-bottom)); padding:12px 14px; border-radius:16px;
  background: rgba(255,255,255,.92); border:1px solid rgba(0,0,0,.10); box-shadow: var(--shadow);
  opacity:0; transform: translateY(12px); transition: opacity .18s ease, transform .18s ease;
}
.toast.on{opacity:1; transform: translateY(0);}
`;

document.head.appendChild(el("style", {}, [css]));

const app = document.getElementById("app");

const toast = el("div", { class: "toast" }, [""]);
document.body.appendChild(toast);
let toastTimer = null;
const showToast = (msg) => {
  toast.textContent = msg;
  toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("on"), 2400);
};

/* ----------------------------- Mini App gate ------------------------------ */

let context = null;
let eth = null;

async function initMiniApp() {
  try {
    context = await sdk.context;
  } catch (e) {
    // Not fatal for running locally, but in production you'll be in a host.
    context = null;
  }
  try {
    eth = await sdk.wallet.getEthereumProvider();
  } catch (e) {
    eth = null;
  }
}

/* --------------------------- Sound (WebAudio) ----------------------------- */

let audioCtx = null;
let pumpOsc = null;
let pumpGain = null;

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  pumpGain = audioCtx.createGain();
  pumpGain.gain.value = 0.0001;
  pumpGain.connect(audioCtx.destination);
}

function pumpTone(step) {
  ensureAudio();
  if (!pumpOsc) {
    pumpOsc = audioCtx.createOscillator();
    pumpOsc.type = "sine";
    pumpOsc.connect(pumpGain);
    pumpOsc.start();
  }
  const base = 240;
  const freq = base + Math.min(900, step * 55);
  pumpOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.03);
  pumpGain.gain.setTargetAtTime(0.06, audioCtx.currentTime, 0.02);
  pumpGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime + 0.08, 0.04);
}

function popSound() {
  ensureAudio();
  const bufferSize = 0.18 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / bufferSize;
    // crackly "glass"
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.7 + 0.3 * Math.sin(t * 1800));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.value = 0.24;
  src.connect(g);
  g.connect(audioCtx.destination);
  src.start();
}

/* ------------------------------ Game state -------------------------------- */

const state = {
  connected: false,
  address: null,
  chainId: null,

  totalPoints: Number(localStorage.getItem("bp_totalPoints") || "0"),
  runPoints: 0,
  pumps: 0,
  multiplier: 1.0,
  popChance: 0.0,

  bestRun: Number(localStorage.getItem("bp_bestRun") || "0"),
  bestAllTime: Number(localStorage.getItem("bp_bestAllTime") || "0"),

  lastMintableScore: 0,
  isBusy: false,

  lbMode: "daily", // daily | weekly | all
  lbRows: [],
  lbStatus: "Loading…",
};

function resetRun() {
  state.runPoints = 0;
  state.pumps = 0;
  state.multiplier = 1.0;
  state.popChance = 0.0;
  updateUI();
}

function computePopChance(pumps) {
  // Starts gentle, then ramps fast.
  // pump 1 -> ~2.5%, pump 10 -> ~14%, pump 20 -> ~35%, pump 30 -> ~65%
  const x = Math.min(40, pumps);
  const chance = 1 - Math.exp(-x / 18);
  return Math.min(0.86, 0.02 + chance * 0.78);
}

function computeMultiplier(pumps) {
  // 1.0x then climbs smoothly.
  const x = pumps;
  return Math.max(1.0, 1 + (Math.pow(x, 1.18) / 8.5));
}

function vibrateForPump(pumps) {
  const ms = Math.min(70, 10 + pumps * 2);
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ------------------------------ Chain utils -------------------------------- */

async function req(method, params = []) {
  if (!eth) throw new Error("No Ethereum provider available from host.");
  return eth.request({ method, params });
}

async function ensureBaseChain() {
  const chainId = await req("eth_chainId");
  state.chainId = chainId;
  if (chainId === BASE_CHAIN_ID) return;
  try {
    await req("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID }]);
    state.chainId = BASE_CHAIN_ID;
  } catch (e) {
    throw new Error("Please switch to Base (0x2105) in your wallet to continue.");
  }
}

async function connectWallet() {
  state.isBusy = true;
  updateUI();
  try {
    if (!eth) throw new Error("Wallet is not available. Open in a Farcaster/Base Mini App host.");
    const accounts = await req("eth_requestAccounts");
    if (!accounts?.length) throw new Error("No accounts returned.");
    await ensureBaseChain();
    state.connected = true;
    state.address = accounts[0];
    showToast("Wallet connected.");
    await refreshLeaderboard();
  } finally {
    state.isBusy = false;
    updateUI();
  }
}

function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function bytes32FromString(s) {
  // bytes32 is right-padded with zeros
  const hex = stringToHex(s, { size: 32 });
  return hex;
}

function abiEncodeMintData({ score, mode }) {
  // packed into bytes: [uint256 score][uint8 mode][uint64 unixMsLow]
  // simple, stable, and cheap to decode offchain.
  const scoreHex = score.toString(16).padStart(64, "0");
  const modeHex = mode.toString(16).padStart(2, "0");
  const ts = Date.now();
  const tsHex = BigInt(ts).toString(16).padStart(16, "0");
  return ("0x" + scoreHex + modeHex + tsHex);
}

async function sendMintTx(score) {
  if (!state.connected || !state.address) throw new Error("Connect wallet first.");
  await ensureBaseChain();

  const action = bytes32FromString("MINT_HIGH_SCORE");
  const data = abiEncodeMintData({
    score,
    mode: state.lbMode === "daily" ? 1 : state.lbMode === "weekly" ? 2 : 3,
  });

  const callData = encodeFunctionData({
    abi: ABI,
    functionName: "logAction",
    args: [action, data],
  });

  const params = {
    version: "2.0.0",
    from: state.address,
    chainId: BASE_CHAIN_ID,
    atomicRequired: true,
    calls: [{
      to: CONTRACT,
      value: "0x0",
      data: callData
    }],
    capabilities: {
      dataSuffix
    }
  };

  // Prefer EIP-5792.
  try {
    const res = await req("wallet_sendCalls", [params]);
    return res;
  } catch (e) {
    // Fallback to eth_sendTransaction.
    const tx = {
      from: state.address,
      to: CONTRACT,
      value: "0x0",
      data: callData,
    };
    const res = await req("eth_sendTransaction", [tx]);
    return res;
  }
}

/* ------------------------------ Leaderboard -------------------------------- */

async function rpc(method, params = []) {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

function startOfDayMs(ts) {
  const d = new Date(ts);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function startOfWeekMs(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function decodeScoreFromData(hexData) {
  if (!hexData || hexData === "0x") return null;
  const clean = hexData.slice(2);
  if (clean.length < 64) return null;
  const score = Number(BigInt("0x" + clean.slice(0, 64)));
  const mode = clean.length >= 66 ? Number(BigInt("0x" + clean.slice(64, 66))) : null;
  return { score, mode };
}

async function refreshLeaderboard() {
  state.lbStatus = "Loading…";
  state.lbRows = [];
  updateUI();

  try {
    // Look back a limited number of blocks for speed.
    const latest = await rpc("eth_blockNumber");
    const latestN = Number(BigInt(latest));
    const fromBlock = Math.max(0, latestN - 50_000); // ~ a week+ depending on blocktime; adjust as needed

    const topic0 = keccak256(
      new TextEncoder().encode("ActionLogged(address,bytes32,uint256,bytes)")
    );
    const actionTopic = bytes32FromString("MINT_HIGH_SCORE");

    const logs = await rpc("eth_getLogs", [{
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: latest,
      address: CONTRACT,
      topics: [topic0, null, actionTopic],
    }]);

    const rows = [];
    for (const lg of logs) {
      try {
        const decoded = decodeEventLog({ abi: ABI, data: lg.data, topics: lg.topics });
        const user = decoded.args.user;
        const tsSec = Number(decoded.args.timestamp);
        const payload = decodeScoreFromData(decoded.args.data);
        if (!payload) continue;

        // time bucket filter
        const tsMs = tsSec * 1000;
        const now = Date.now();
        if (state.lbMode === "daily") {
          if (startOfDayMs(tsMs) !== startOfDayMs(now)) continue;
        } else if (state.lbMode === "weekly") {
          if (startOfWeekMs(tsMs) !== startOfWeekMs(now)) continue;
        }

        rows.push({
          user,
          score: payload.score,
          tsMs,
          tx: lg.transactionHash,
        });
      } catch {}
    }

    // keep best per address
    const best = new Map();
    for (const r of rows) {
      const prev = best.get(r.user);
      if (!prev || r.score > prev.score) best.set(r.user, r);
    }
    const sorted = [...best.values()].sort((a,b)=>b.score-a.score).slice(0, 25);
    state.lbRows = sorted;
    state.lbStatus = sorted.length ? "" : "No mints found in this period (yet).";
  } catch (e) {
    state.lbStatus = "Couldn't load leaderboard (RPC).";
  }

  updateUI();
}

/* ------------------------------- UI render --------------------------------- */

const topbar = el("div", { class: "card topbar" });

const brand = el("div", { class: "brand" }, [
  el("div", { class: "dot" }),
  el("div", {}, [
    el("div", { class: "h1" }, ["Base Pressure"]),
    el("div", { class: "sub" }, ["How big can you grow it before it bursts?"]),
  ]),
]);

const profilePill = el("div", { class: "pill" }, ["Not connected"]);
const connectBtn = el("button", { class: "btn soft", onClick: connectWallet }, ["Connect"]);

topbar.appendChild(brand);
topbar.appendChild(profilePill);
topbar.appendChild(connectBtn);

const main = el("div", { class: "main" });

const stats = el("div", { class: "card", style: { padding: "12px" } });
const statGrid = el("div", { class: "grid" });
const statA = el("div", {}, [el("div", { class: "k" }, ["TOTAL POINTS"]), el("div", { class: "v", id: "v_total" }, ["0"])]);
const statB = el("div", {}, [el("div", { class: "k" }, ["RUN (BANKABLE)"]), el("div", { class: "v", id: "v_run" }, ["0"])]);
const statC = el("div", {}, [el("div", { class: "k" }, ["MULTIPLIER"]), el("div", { class: "v", id: "v_mult" }, ["1.00x"])]);
const statD = el("div", {}, [el("div", { class: "k" }, ["POP CHANCE"]), el("div", { class: "v", id: "v_pop" }, ["0%"])]);
statGrid.appendChild(statA); statGrid.appendChild(statB); statGrid.appendChild(statC); statGrid.appendChild(statD);
stats.appendChild(statGrid);
stats.appendChild(el("div", { class: "small", id: "hint", style: { marginTop: "8px" } }, ["Connect wallet to play."]));

const stage = el("div", { class: "stage" });

const bubbleCard = el("div", { class: "card bubbleWrap" });
const bubble = el("div", { class: "bubble", id: "bubble" });
const rings = el("div", { class: "rings" }, [el("div", { class: "ring" })]);
const flash = el("div", { class: "flash", id: "flash" });
bubbleCard.appendChild(bubble);
bubbleCard.appendChild(rings);
bubbleCard.appendChild(flash);

const controls = el("div", { class: "btnRow" });
const pumpBtn = el("button", { class: "btn primary", id: "btn_pump" }, ["PUMP"]);
const bankBtn = el("button", { class: "btn soft", id: "btn_bank" }, ["BANK"]);
controls.appendChild(pumpBtn);
controls.appendChild(bankBtn);

const mintRow = el("div", { class: "btnRow", id: "mintRow", style: { display: "none" } });
const mintBtn = el("button", { class: "btn", id: "btn_mint" }, ["MINT HIGH SCORE"]);
mintRow.appendChild(mintBtn);

const lbCard = el("div", { class: "card", style: { minHeight: "0", display:"flex", flexDirection:"column" } });
const tabs = el("div", { class: "tabs" });
const tabDaily = el("div", { class: "tab", onClick: () => setMode("daily") }, ["Daily"]);
const tabWeekly = el("div", { class: "tab", onClick: () => setMode("weekly") }, ["Weekly"]);
const tabAll = el("div", { class: "tab", onClick: () => setMode("all") }, ["All-time"]);
tabs.appendChild(tabDaily); tabs.appendChild(tabWeekly); tabs.appendChild(tabAll);

const lb = el("div", { class: "lb" });
const lbStatus = el("div", { class: "small", id: "lbStatus" }, [""]);
const lbList = el("div", { class: "lbList", id: "lbList" }, []);
lb.appendChild(lbStatus);
lb.appendChild(lbList);

lbCard.appendChild(tabs);
lbCard.appendChild(lb);

stage.appendChild(bubbleCard);
stage.appendChild(controls);
stage.appendChild(mintRow);
stage.appendChild(lbCard);

main.appendChild(stats);
main.appendChild(stage);

app.appendChild(topbar);
app.appendChild(main);

function setMode(mode) {
  state.lbMode = mode;
  refreshLeaderboard();
  updateUI();
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  updateUI();
}

pumpBtn.addEventListener("click", async () => {
  if (!state.connected) {
    showToast("Connect wallet first.");
    return;
  }
  if (state.isBusy) return;

  // Start audio on first interaction.
  try { await audioCtx?.resume?.(); } catch {}

  state.pumps += 1;
  state.multiplier = computeMultiplier(state.pumps);
  state.popChance = computePopChance(state.pumps);

  // points increase by multiplier delta (arcade feel)
  const delta = Math.max(1, Math.round(10 * state.multiplier));
  state.runPoints += delta;

  vibrateForPump(state.pumps);
  pumpTone(state.pumps);

  // Random pop check
  const r = Math.random();
  if (r < state.popChance) {
    // POP
    popSound();
    if (navigator.vibrate) navigator.vibrate([30, 20, 80]);
    flash.classList.remove("on");
    // reflow to restart animation
    void flash.offsetWidth;
    flash.classList.add("on");

    showToast("💥 Burst! You lost this run.");
    state.runPoints = 0;
    state.pumps = 0;
    state.multiplier = 1.0;
    state.popChance = 0.0;
  }

  updateUI();
});

bankBtn.addEventListener("click", () => {
  if (!state.connected) { showToast("Connect wallet first."); return; }
  if (state.isBusy) return;

  if (state.runPoints <= 0) {
    showToast("Nothing to bank yet.");
    return;
  }

  state.totalPoints += state.runPoints;
  localStorage.setItem("bp_totalPoints", String(state.totalPoints));

  state.bestRun = Math.max(state.bestRun, state.runPoints);
  localStorage.setItem("bp_bestRun", String(state.bestRun));

  state.bestAllTime = Math.max(state.bestAllTime, state.totalPoints);
  localStorage.setItem("bp_bestAllTime", String(state.bestAllTime));

  // Mint becomes available if this bank is a personal best run.
  if (state.runPoints >= state.lastMintableScore) {
    state.lastMintableScore = state.runPoints;
    mintRow.style.display = "flex";
  }

  showToast(`Banked +${state.runPoints} points.`);
  resetRun();
});

mintBtn.addEventListener("click", async () => {
  if (!state.connected) { showToast("Connect wallet first."); return; }
  const score = state.lastMintableScore;
  if (!score) { showToast("No score to mint."); return; }

  setBusy(true);
  try {
    const txHashOrId = await sendMintTx(score);
    showToast("Mint submitted.");
    // Refresh leaderboard shortly after
    setTimeout(refreshLeaderboard, 1600);
  } catch (e) {
    showToast(e?.message || "Mint failed.");
  } finally {
    setBusy(false);
  }
});

function renderLeaderboard() {
  lbList.innerHTML = "";
  lbStatus.textContent = state.lbStatus || "";
  const rows = state.lbRows || [];
  rows.forEach((r, i) => {
    const n = el("div", { class: "row" }, [
      el("div", { class: "rank" }, [String(i + 1)]),
      el("div", { class: "addr" }, [
        el("div", { class: "top" }, [shortAddr(r.user)]),
        el("div", { class: "bot" }, [new Date(r.tsMs).toLocaleString()]),
      ]),
      el("div", { class: "score" }, [String(r.score)]),
    ]);
    lbList.appendChild(n);
  });
}

function updateUI() {
  const v_total = document.getElementById("v_total");
  const v_run = document.getElementById("v_run");
  const v_mult = document.getElementById("v_mult");
  const v_pop = document.getElementById("v_pop");
  const hint = document.getElementById("hint");

  v_total.textContent = String(state.totalPoints);
  v_run.textContent = String(state.runPoints);
  v_mult.textContent = `${state.multiplier.toFixed(2)}x`;
  v_pop.textContent = `${Math.round(state.popChance * 100)}%`;

  // bubble size (never offscreen)
  const base = 210; // px
  const max = Math.min(window.innerWidth * 0.78, window.innerHeight * 0.36, 320);
  const t = Math.min(1, state.pumps / 28);
  const size = base + (max - base) * (0.18 + 0.82 * t);
  bubble.style.width = `${size}px`;

  connectBtn.disabled = state.isBusy;
  pumpBtn.disabled = state.isBusy || !state.connected;
  bankBtn.disabled = state.isBusy || !state.connected;
  mintBtn.disabled = state.isBusy || !state.connected;

  connectBtn.textContent = state.connected ? "Connected" : "Connect";
  profilePill.textContent = state.connected ? `Wallet: ${shortAddr(state.address)}` : "Not connected";

  hint.textContent = state.connected
    ? "Pump to increase points & risk. Bank anytime to lock points. Mint to log onchain."
    : "Connect wallet to play.";

  // Tabs
  tabDaily.classList.toggle("active", state.lbMode === "daily");
  tabWeekly.classList.toggle("active", state.lbMode === "weekly");
  tabAll.classList.toggle("active", state.lbMode === "all");

  renderLeaderboard();
}

window.addEventListener("resize", updateUI);

/* ------------------------------ Boot sequence ------------------------------ */

(async () => {
  await initMiniApp();
  updateUI();
  // Important: hide splash as soon as UI is stable.
  try {
    await sdk.actions.ready();
  } catch {
    // If running in a normal browser, ignore.
  }
  // Load leaderboard once (it'll show empty until mints happen)
  refreshLeaderboard();
})();
