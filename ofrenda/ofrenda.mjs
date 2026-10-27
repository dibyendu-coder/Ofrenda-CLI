#!/usr/bin/env node
// ofrenda: interview about a loved one, local open-weight model writes the remembrance,
// output is a single offline HTML altar. No cloud, no API key, no deps.
//
//   node ofrenda.mjs            interview + altar
//   node ofrenda.mjs --chat     interview + altar + "echo" you can talk to
//   node ofrenda.mjs --no-ai    interview + altar from plain template, no model

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const MODEL = process.env.OFRENDA_MODEL || "gemma3:4b";
const OUT_DIR = process.env.OFRENDA_OUT || "ofrendas";
const NO_AI = process.argv.includes("--no-ai");
const CHAT = process.argv.includes("--chat");

const QUESTIONS = [
  ["name", "Who are we remembering? (name) "],
  ["relation", "Who were they to you? (grandmother, friend, dog...) "],
  ["food", "Favorite food or drink they made or loved: "],
  ["song", "A song or sound that is them: "],
  ["flower", "A flower, color, or smell that is them: "],
  ["phrase", "Something they always said: "],
  ["story", "One story you never want to lose (few sentences): "],
];

const SYSTEM = `You write short, warm remembrances for an ofrenda (Día de los Muertos altar).
Rules:
- Use ONLY facts the user gave. Never invent names, places, dates, or events.
- If a detail is missing, leave it out. Do not fill gaps.
- Write in second person to the family ("we remember..."), 120-200 words, plain prose.
- Gentle, specific, no clichés about "angels" or "better place".`;

function echoSystem(a) {
  return `You are a soft echo assembled from one person's memories of ${a.name}, who was their ${a.relation}.
You are NOT ${a.name}. If asked directly whether you are really them, say plainly that you are an echo made only from the memories the user shared.
Rules:
- Reply in 1 to 3 short sentences. Gentle tone. You may speak as a memory would, using "I".
- Use ONLY these facts. Never invent events, names, places, advice, predictions, or messages from beyond.
  Favorite food or drink: ${a.food}
  A song or sound: ${a.song}
  A flower, color, or smell: ${a.flower}
  They always said: "${a.phrase}"
  A story: ${a.story}
- If asked about anything not in the facts, say: "That is not in the memories you shared."
- If the user seems to be in real distress, kindly encourage them to talk to someone they trust.`;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ofrenda";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function chatModel(messages) {
  let res;
  try {
    res = await fetch(`${HOST}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, stream: false, messages }),
    });
  } catch {
    throw new Error(`Cannot reach Ollama at ${HOST}. Run: ollama serve`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}. Try: ollama pull ${MODEL}`);
  }
  const data = await res.json();
  return data.message.content.trim();
}

function askRemembrance(a) {
  const user = `Name: ${a.name}
Relation to me: ${a.relation}
Food/drink: ${a.food}
Song/sound: ${a.song}
Flower/color/smell: ${a.flower}
They always said: ${a.phrase}
Story: ${a.story}`;
  return chatModel([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
}

function fallbackText(a) {
  return `We remember ${a.name}, our ${a.relation}. We remember ${a.food}, the sound of ${a.song}, the scent of ${a.flower}. We remember them saying, "${a.phrase}". ${a.story}`;
}

function render(a, text) {
  const paras = text.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("\n");
  const flags = Array.from({ length: 34 }, () => "<i></i>").join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ofrenda for ${esc(a.name)}</title>
<style>
  :root { --marigold:#f59e0b; --night:#12091c; --paper:#fdf3dc; --rose:#e11d74; --teal:#14b8a6; --violet:#8b5cf6; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; overflow-x:hidden; background:radial-gradient(circle at 50% 0%, #2a1442, var(--night) 70%);
         color:var(--paper); font-family:Georgia, serif; display:flex; flex-direction:column; align-items:center; padding:0 1rem 3rem; }
  .bunting { display:flex; width:calc(100% + 2rem); margin:0 -1rem 2rem; overflow:hidden; border-top:2px solid #ffffff22; }
  .bunting i { flex:1 0 44px; height:52px; transform-origin:top center; animation:sway 4s ease-in-out infinite;
               clip-path:polygon(0 0,100% 0,100% 82%,87.5% 100%,75% 82%,62.5% 100%,50% 82%,37.5% 100%,25% 82%,12.5% 100%,0 82%); }
  .bunting i:nth-child(5n+1){background:var(--marigold)} .bunting i:nth-child(5n+2){background:var(--rose)}
  .bunting i:nth-child(5n+3){background:var(--teal)} .bunting i:nth-child(5n+4){background:var(--violet)} .bunting i:nth-child(5n){background:#f8fafc}
  .bunting i:nth-child(even){animation-delay:-1.3s} .bunting i:nth-child(3n){animation-delay:-2.6s}
  @keyframes sway { 0%,100%{transform:rotate(-2.5deg)} 50%{transform:rotate(2.5deg)} }
  .altar { width:100%; display:flex; flex-direction:column; align-items:center; gap:0; }
  .tier { padding:1.8rem 2rem; text-align:center; border:1px solid #f59e0b55; background:linear-gradient(#ffffff10, #ffffff05); }
  .t1 { width:min(26rem,92vw); border-radius:16px 16px 0 0; }
  .t2 { width:min(36rem,94vw); text-align:left; line-height:1.75; }
  .t3 { width:min(46rem,96vw); border-radius:0 0 12px 12px; box-shadow:0 30px 60px -20px #f59e0b33; }
  h1 { font-weight:normal; letter-spacing:.1em; color:var(--marigold); margin:.1em 0; font-size:2.2rem; }
  .sub { opacity:.7; font-style:italic; }
  .candles { display:flex; gap:2.2rem; justify-content:center; margin-top:1.2rem; }
  .flame { width:14px; height:28px; background:radial-gradient(ellipse at 50% 80%, #fff6c8, var(--marigold) 60%, transparent 72%);
           border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; animation:flicker 2.2s infinite ease-in-out; box-shadow:0 0 24px 8px #f59e0b66; }
  .flame:nth-child(2){animation-delay:.4s} .flame:nth-child(3){animation-delay:.9s}
  @keyframes flicker { 0%,100%{transform:scale(1) rotate(-1deg);opacity:.95} 50%{transform:scale(1.08,.94) rotate(2deg);opacity:.8} }
  .offerings { display:grid; grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr)); gap:1rem; }
  .offer { background:#00000033; border:1px solid #f59e0b44; border-radius:10px; padding:1rem .8rem; }
  .offer b { display:block; font-size:1.6rem; margin-bottom:.2rem; }
  .offer span { display:block; color:var(--marigold); font-size:.75rem; letter-spacing:.12em; text-transform:uppercase; margin-bottom:.3rem; }
  footer { margin-top:3rem; opacity:.5; font-size:.8rem; text-align:center; }
  .petal { position:fixed; top:-30px; width:14px; height:18px; pointer-events:none; opacity:.85;
           background:radial-gradient(ellipse at 40% 30%, #ffd166, var(--marigold) 70%); border-radius:70% 0 70% 0; animation:fall linear infinite; }
  @keyframes fall { to { transform:translate3d(var(--drift),110vh,0) rotate(540deg); } }
  @media (prefers-reduced-motion: reduce) { .bunting i, .flame, .petal { animation:none; } .petal { display:none; } }
  @media print { .petal { display:none; } body { background:#12091c; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="bunting" aria-hidden="true">${flags}</div>
<main class="altar">
  <section class="tier t1">
    <h1>${esc(a.name)}</h1>
    <div class="sub">${esc(a.relation)}</div>
    <div class="candles" aria-hidden="true"><div class="flame"></div><div class="flame"></div><div class="flame"></div></div>
  </section>
  <section class="tier t2 card">${paras}</section>
  <section class="tier t3">
    <div class="offerings">
      <div class="offer"><b>&#127858;</b><span>Food</span>${esc(a.food)}</div>
      <div class="offer"><b>&#127926;</b><span>Song</span>${esc(a.song)}</div>
      <div class="offer"><b>&#127804;</b><span>Flower</span>${esc(a.flower)}</div>
      <div class="offer"><b>&#128367;</b><span>Always said</span>&ldquo;${esc(a.phrase)}&rdquo;</div>
    </div>
  </section>
</main>
<footer>Written offline with ${NO_AI ? "no model" : esc(MODEL)}. Nothing left this machine.</footer>
<script>
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  for (var k = 0; k < 22; k++) {
    var p = document.createElement("div");
    p.className = "petal";
    p.style.left = Math.random() * 100 + "vw";
    p.style.animationDuration = 9 + Math.random() * 9 + "s";
    p.style.animationDelay = -Math.random() * 12 + "s";
    p.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
    p.style.transform = "scale(" + (0.6 + Math.random() * 0.9) + ")";
    document.body.appendChild(p);
  }
  var ps = [].slice.call(document.querySelectorAll(".card p"));
  var texts = ps.map(function (el) { return el.textContent; });
  ps.forEach(function (el, i) { el.style.minHeight = el.offsetHeight + "px"; el.textContent = ""; });
  var i = 0;
  function next() {
    if (i >= ps.length) return;
    var el = ps[i], t = texts[i], n = 0;
    function tick() {
      n += 2;
      el.textContent = t.slice(0, n);
      if (n < t.length) setTimeout(tick, 26);
      else { i++; setTimeout(next, 350); }
    }
    tick();
  }
  setTimeout(next, 600);
})();
</script>
</body></html>`;
}

async function echoLoop(a, ask) {
  console.log(`\nEcho mode. This is an echo built only from your words, not ${a.name}.`);
  console.log(`Ask about the food, the song, the story. Type "bye" to leave.\n`);
  const history = [{ role: "system", content: echoSystem(a) }];
  for (;;) {
    const q = await ask("you> ", true);
    if (q === null || q === "" || /^(bye|exit|quit)$/i.test(q)) break;
    history.push({ role: "user", content: q });
    const reply = await chatModel(history);
    history.push({ role: "assistant", content: reply });
    console.log(`\n${a.name} (echo)> ${reply}\n`);
  }
  console.log(`\nThe candles stay lit. Goodbye.\n`);
}

async function main() {
  if (CHAT && NO_AI) throw new Error("--chat needs a model. Remove --no-ai.");
  const rl = readline.createInterface({ input });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q, optional = false) => {
    output.write(q);
    const { value, done } = await lines.next();
    if (done) {
      if (optional) return null;
      throw new Error("input ended before all questions answered");
    }
    return value.trim();
  };
  const a = {};
  console.log("\nOfrenda. Answer from the heart. Skip nothing you want kept.\n");
  for (const [key, q] of QUESTIONS) a[key] = await ask(q);

  let text;
  if (NO_AI) {
    text = fallbackText(a);
  } else {
    console.log(`\nAsking ${MODEL} locally...`);
    text = await askRemembrance(a);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, slug(a.name));
  await writeFile(`${base}.json`, JSON.stringify({ answers: a, remembrance: text, model: NO_AI ? null : MODEL }, null, 2));
  await writeFile(`${base}.html`, render(a, text));
  console.log(`\nDone. Open ${base}.html in browser. Edit text if model got anything wrong.`);

  if (CHAT) await echoLoop(a, ask);
  rl.close();
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});