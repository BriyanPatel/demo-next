// Renders reel.html frame by frame in headless Chromium and muxes it with the
// synthesized soundtrack.
//
//   node render.mjs                       -> out/bliss-launch-reel-1920x1080.mp4
//   node render.mjs --w 1080 --h 1920     -> vertical 9:16 cut
//   node render.mjs --stills 1,4.2,8      -> PNG stills only (for review)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const W = +arg("w", 1920), H = +arg("h", 1080), FPS = +arg("fps", 60);
const FFMPEG = arg("ffmpeg", process.env.FFMPEG || "ffmpeg");
const stills = arg("stills", null);
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => { console.error("page error:", e.message); process.exit(1); });
await page.goto(pathToFileURL(join(here, "reel.html")).href + `?w=${W}&h=${H}`);
await page.evaluate(() => window.ready);

const grab = (t, type, q) => page.evaluate(([t, type, q]) => {
  window.render(t);
  return document.getElementById("c").toDataURL(type, q).split(",")[1];
}, [t, type, q]);

if (stills) {
  for (const s of stills.split(",")) {
    const t = +s;
    writeFileSync(join(out, `still-${W}x${H}-${t.toFixed(2)}.png`), Buffer.from(await grab(t, "image/png"), "base64"));
  }
  console.log("stills written to", out);
  await browser.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * FPS);
const file = join(out, `bliss-launch-reel-${W}x${H}.mp4`);
const ff = spawn(FFMPEG, [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-i", join(out, "reel-audio.wav"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-c:a", "aac", "-b:a", "256k",
  "-shortest", "-movflags", "+faststart", file,
], { stdio: ["pipe", "inherit", "inherit"] });

const started = Date.now();
for (let i = 0; i < frames; i++) {
  const buf = Buffer.from(await grab(i / FPS, "image/jpeg", 0.96), "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % FPS === 0) process.stdout.write(`\r${W}x${H} frame ${i}/${frames}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`\nwrote ${file}`);
