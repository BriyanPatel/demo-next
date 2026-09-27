# Bliss Web Solution: 30s launch reel

The whole reel is built from code: a canvas animation plus a synthesized soundtrack. There is no stock footage and there are no samples, so every frame and sound can be edited and rebuilt.

| File | What it does |
| --- | --- |
| `reel.js` / `reel.html` | Canvas animation. Every frame is `render(t)`, so the output is fully deterministic. |
| `sfx.py` | 120 BPM music bed plus all sound design (typing, riser, booms, whooshes, counter ticks, pings), timed to the visual cues. |
| `render.mjs` | Steps the animation frame by frame in headless Chromium and muxes it with the audio using ffmpeg (H.264 + AAC). |
| `fonts/` | Space Grotesk, Inter and JetBrains Mono (OFL), from Fontsource. |

## Storyboard (120 BPM, cuts on the beat)

| Time | Scene | Sound |
| --- | --- | --- |
| 0.0–2.5 | Terminal types `> init bliss.launch()`, a loading bar fills, the screen collapses like a CRT | key clicks, riser, glitch |
| 2.5–6.0 | **BLISS / WEB SOLUTION** wordmark slams in with a shockwave and particles, then the tagline | sub boom, shimmer, beat drops |
| 6.0–10.0 | Counters: 14+ years · 1,400+ projects · 800+ clients · 98% success | whooshes, rising ticks, dings |
| 10.0–13.0 | Platform slam: Magento · Shopify · BigCommerce · WordPress · Laravel · Headless | an impact on every beat |
| 13.0–17.0 | Three service cards: E-Commerce · Web & Mobile Apps · Digital Marketing | swooshes, pops, arp enters |
| 17.0–21.5 | A site builds live: Design → Develop → Launch (LIVE) → Grow (revenue chart) | scribble, typing, chimes, gliss |
| 21.5–25.5 | Wireframe globe with pins for USA, Canada, UK and Australia, plus partner badges | sonar pings |
| 25.5–30.0 | Implosion into the final logo, "Let's build what's next.", then blisswebsolution.com | reverse swell, big boom, bells |

## Rebuild

```bash
pip install numpy scipy imageio-ffmpeg
python3 sfx.py                                   # -> out/reel-audio.wav
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node render.mjs --w 1920 --h 1080 --fps 60       # 16:9
node render.mjs --w 1080 --h 1920 --fps 60       # 9:16 for Reels / Shorts
node render.mjs --stills 3,8,12                  # quick PNG stills for review
```

To preview live with sound, serve this folder (for example `npx serve .`) and open `reel.html?play=1`, then click.

To change the copy, stats or colours, edit the constants near the top of each scene in `reel.js` (`STATS`, `PLAT`, `CARDS`, `PINS`, `C`). If you move a cue in time, move the matching `place(...)` call in `sfx.py` as well.
