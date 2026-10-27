#!/usr/bin/env node
// ofrenda: interview about a loved one, local open-weight model writes the remembrance,
// output is a single offline HTML page. No cloud, no API key, no deps.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const MODEL = process.env.OFRENDA_MODEL || "gemma3:4b";
const OUT_DIR = process.env.OFRENDA_OUT || "ofrendas";
const NO_AI = process.argv.includes("--no-ai");

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

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ofrenda";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function askModel(a) {
  const user = `Name: ${a.name}
Relation to me: ${a.relation}
Food/drink: ${a.food}
Song/sound: ${a.song}
Flower/color/smell: ${a.flower}
They always said: ${a.phrase}
Story: ${a.story}`;
  let res;
  try {
    res = await fetch(`${HOST}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
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

function fallbackText(a) {
  return `We remember ${a.name}, our ${a.relation}. We remember ${a.food}, the sound of ${a.song}, the scent of ${a.flower}. We remember them saying, "${a.phrase}". ${a.story}`;
}

function render(a, text) {
  const paras = text.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ofrenda for ${esc(a.name)}</title>
<style>
  :root { --marigold:#f59e0b; --night:#12091c; --paper:#fdf3dc; }
  body { margin:0; min-height:100vh; background:radial-gradient(circle at 50% 0%, #2a1442, var(--night) 70%);
         color:var(--paper); font-family:Georgia, serif; display:flex; flex-direction:column; align-items:center; padding:3rem 1rem; }
  h1 { font-weight:normal; letter-spacing:.08em; color:var(--marigold); margin:.2em 0; text-align:center; }
  .sub { opacity:.7; font-style:italic; margin-bottom:2rem; }
  .candles { display:flex; gap:2rem; margin:1rem 0 2rem; }
  .flame { width:14px; height:28px; background:radial-gradient(ellipse at 50% 80%, #fff6c8, var(--marigold) 60%, transparent 72%);
           border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; animation:flicker 2.2s infinite ease-in-out; box-shadow:0 0 24px 8px #f59e0b66; }
  .flame:nth-child(2){animation-delay:.4s} .flame:nth-child(3){animation-delay:.9s}
  @keyframes flicker { 0%,100%{transform:scale(1) rotate(-1deg);opacity:.95} 50%{transform:scale(1.08,.94) rotate(2deg);opacity:.8} }
  .card { max-width:34rem; line-height:1.7; background:#ffffff0d; border:1px solid #f59e0b55; border-radius:12px; padding:1.5rem 2rem; }
  dl { max-width:34rem; width:100%; display:grid; grid-template-columns:auto 1fr; gap:.4rem 1rem; margin-top:2rem; }
  dt { color:var(--marigold); } dd { margin:0; }
  footer { margin-top:3rem; opacity:.5; font-size:.8rem; }
</style></head><body>
<h1>${esc(a.name)}</h1>
<div class="sub">${esc(a.relation)}</div>
<div class="candles"><div class="flame"></div><div class="flame"></div><div class="flame"></div></div>
<div class="card">${paras}</div>
<dl>
  <dt>Food</dt><dd>${esc(a.food)}</dd>
  <dt>Song</dt><dd>${esc(a.song)}</dd>
  <dt>Flower</dt><dd>${esc(a.flower)}</dd>
  <dt>Always said</dt><dd>&ldquo;${esc(a.phrase)}&rdquo;</dd>
</dl>
<footer>Written offline with ${NO_AI ? "no model" : esc(MODEL)}. Nothing left this machine.</footer>
</body></html>`;
}

async function main() {
  const rl = readline.createInterface({ input });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q) => {
    output.write(q);
    const { value, done } = await lines.next();
    if (done) throw new Error("input ended before all questions answered");
    return value.trim();
  };
  const a = {};
  console.log("\nOfrenda. Answer from the heart. Skip nothing you want kept.\n");
  for (const [key, q] of QUESTIONS) a[key] = await ask(q);
  rl.close();

  let text;
  if (NO_AI) {
    text = fallbackText(a);
  } else {
    console.log(`\nAsking ${MODEL} locally...`);
    text = await askModel(a);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, slug(a.name));
  await writeFile(`${base}.json`, JSON.stringify({ answers: a, remembrance: text, model: NO_AI ? null : MODEL }, null, 2));
  await writeFile(`${base}.html`, render(a, text));
  console.log(`\nDone. Open ${base}.html in browser. Edit text if model got anything wrong.\n`);
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});