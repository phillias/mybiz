# Hero background video — how it was made

The 8-second looping background video on the hero (`public/hero/`) is built from
free stock footage via the repo-local OpenMontage pipeline and a vendored static
ffmpeg. Everything below is reproducible from a clean clone.

## Source

- **Provider:** Wikimedia Commons (OpenMontage `WikimediaSource` adapter — keyless, no account)
- **File:** "Clouds at sunset (time lapse)" — `https://commons.wikimedia.org/wiki/File:Clouds_at_sunset_(time_lapse).webm`
- **Creator:** https://www.youtube.com/user/Editor
- **License:** CC BY 3.0 — https://creativecommons.org/licenses/by/3.0
- **Format:** 1920×1080 VP8 + Vorbis, 30.276 s, 30 fps
- **Why:** dusk cloud layer in the ink-navy → amber palette; slow organic motion
  crossfades into a seamless 8 s loop (a rotating night-earth candidate was
  rejected: an 8 s loop of a rotating globe requires one full rotation per 8 s,
  which reads too fast for the calm editorial hero, and the hero already anchors
  on the WebGL globe).

Search query used against the adapter (cascade `full` → `top2_or` → `single_best`):
`dusk clouds sunset aerial`.

## Repo-local tooling (never shipped)

Both are gitignored under `.tools/`:

- **OpenMontage** — `git clone https://github.com/calesthio/OpenMontage .tools/openmontage` (free path only; Python venv at `.tools/venv` with core deps).
- **ffmpeg 7.0.2 static** — vendored via npm `ffmpeg-static` in `.tools/ffmpeg/` (binary at `.tools/ffmpeg/ffmpeg`). No system install.

## Exact ffmpeg commands

Source: `.tools/clips/clouds_sunset_timelapse.webm` (Commons file pageid `24404260`).

```bash
FF=.tools/ffmpeg/ffmpeg
R=.tools/render
OUT=public/hero

# 1. Trim the navy-dusk window (scene darkens golden → navy through the clip).
"$FF" -y -v error -ss 20 -t 10 -i "$SRC" -an -vf "fps=30" \
  -c:v libx264 -crf 18 -preset veryfast "$R/win.mp4"

# 2. Slow to 0.7× for a calm drift; downscale to 1280×720; yuv420p; re-base PTS.
FILT="setpts=1.42857*PTS,scale=1280:720,format=yuv420p,fps=30,setpts=PTS-STARTPTS"
"$FF" -y -v error -i "$R/win.mp4" -an -vf "$FILT" \
  -c:v libx264 -crf 18 -preset veryfast "$R/win_slow.mp4"

# 3. Loop inputs: first 8 s + first 1.5 s.
"$FF" -y -v error -i "$R/win_slow.mp4" -t 8  -an -c:v libx264 -crf 18 -preset veryfast "$R/in1.mp4"
"$FF" -y -v error -i "$R/win_slow.mp4" -t 1.5 -an -c:v libx264 -crf 18 -preset veryfast "$R/in2.mp4"

# 4. Seamless 8.0 s loop: crossfade tail into head (offset 6.5, fade 1.5 s).
"$FF" -y -v error -i "$R/in1.mp4" -i "$R/in2.mp4" \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1.5:offset=6.5[v]" \
  -map "[v]" -r 30 "$R/loop8.mp4"

# 5. Web encodes.
"$FF" -y -v error -i "$R/loop8.mp4" -an -c:v libx264 -profile:v baseline -level 3.1 \
  -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart "$OUT/hero-bg.mp4"
"$FF" -y -v error -i "$R/loop8.mp4" -an -c:v libvpx-vp9 -crf 38 -b:v 0 -pix_fmt yuv420p \
  -deadline good -cpu-used 2 "$OUT/hero-bg.webm"

# 6. Poster frame (mid-loop, away from the dissolve).
"$FF" -y -v error -ss 4 -i "$R/loop8.mp4" -frames:v 1 -vf "scale=1280:720" -q:v 2 "$OUT/hero-bg-poster.jpg"
```

Seam verification: frame diff at the loop join (t=0 vs t=7.9) ≈ 6.3, below the
clip's own 8 s natural drift (≈ 15.7), so the dissolve is imperceptible.

## Shipped assets (`public/hero/`)

| Asset | Codec | Size |
|---|---|---|
| `hero-bg.mp4` | H.264 Constrained Baseline, 1280×720, 30 fps, ~8.03 s | ~408 KB |
| `hero-bg.webm` | VP9, 1280×720, 30 fps | ~140 KB |
| `hero-bg-poster.jpg` | JPEG 1280×720 | ~39 KB |

The page serves the WebM first with the MP4 as fallback, `preload="metadata"`,
and shows the poster until playback starts.
