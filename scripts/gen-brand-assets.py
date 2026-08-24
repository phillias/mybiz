#!/usr/bin/env python3
"""Generate deterministic brand raster assets for the public/ directory.

Outputs:
  public/og-image.png   1200x630 social share image (Open Graph / Twitter)
  public/favicon.ico    multi-size ICO (16..256) fallback icon

public/favicon.svg is hand-written (vector) and not generated here.

Design language mirrors the site chrome: deep-navy ink (#0b1f33), warm paper
cream (#f6f2ea), orange accent (#e56b2b), thin-line wireframe globe with
great-circle arcs — same composition as the homepage hero and wordmark.

Requires Pillow (pip install pillow). Fonts: Bricolage Grotesque and Schibsted
Grotesk (the site's Google Fonts), fetched from google/fonts on GitHub into a
temp cache when not present in the asset cache directory.

  python3 scripts/gen-brand-assets.py            # write into public/
  python3 scripts/gen-brand-assets.py --dry-run  # render to /tmp only
"""

import argparse
import os
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

INK = (11, 31, 51)  # #0b1f33
PAPER = (246, 242, 234)  # #f6f2ea
ACCENT = (229, 107, 43)  # #e56b2b
ACCENT_LIGHT = (245, 154, 92)  # #f59a5c

FONT_URLS = {
    "Bricolage.ttf": "https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf",
    "Schibsted.ttf": "https://github.com/google/fonts/raw/main/ofl/schibstedgrotesk/SchibstedGrotesk%5Bwght%5D.ttf",
}


def ensure_fonts(cache_dir: str) -> dict[str, str]:
    paths = {}
    for name, url in FONT_URLS.items():
        path = os.path.join(cache_dir, name)
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        paths[name] = path
    return paths


def font(paths: dict[str, str], name: str, size: int, wght: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(paths[name], size)
    # Variable-font axes: Bricolage is [opsz, wght, wdth]; Schibsted is [wght].
    axes = f.get_variation_axes()
    values = []
    for axis in axes:
        label = axis["name"].decode() if isinstance(axis["name"], bytes) else axis["name"]
        if "Weight" in label:
            values.append(wght)
        elif "Width" in label:
            values.append(100)
        else:  # Optical size -> max
            values.append(axis["maximum"])
    f.set_variation_by_axes(values)
    return f


def rgba(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*rgb, alpha)


def draw_tracked(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, f, fill, tracking: int) -> None:
    """Draw text with manual letterspacing (tracking in px)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking


def arc_through(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], start: float, end: float, fill, width: int) -> None:
    draw.arc(box, start=start, end=end, fill=fill, width=width)


def globe(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, line_w: int, alpha_scale: float = 1.0) -> None:
    """Wireframe globe: orange rim + cream meridians, mirroring the hero SVG."""
    rim = rgba(ACCENT, int(255 * alpha_scale))
    line = rgba(PAPER, int(255 * 0.62 * alpha_scale))
    line_soft = rgba(PAPER, int(255 * 0.34 * alpha_scale))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rim, width=line_w)
    draw.ellipse([cx - int(r * 0.46), cy - r, cx + int(r * 0.46), cy + r], outline=line, width=max(2, line_w // 2))
    draw.ellipse([cx - r, cy - int(r * 0.36), cx + r, cy + int(r * 0.36)], outline=line, width=max(2, line_w // 2))
    draw.ellipse([cx - r, cy - int(r * 0.72), cx + r, cy + int(r * 0.72)], outline=line_soft, width=max(2, line_w // 2))
    draw.line([cx - r, cy, cx + r, cy], fill=line, width=max(2, line_w // 2))


def render_og(paths: dict[str, str]) -> Image.Image:
    """1200x630 OG image, drawn at 2x and downscaled for anti-aliasing."""
    S = 2
    W, H = 1200 * S, 630 * S
    img = Image.new("RGBA", (W, H), rgba(INK, 255))
    draw = ImageDraw.Draw(img)

    # Subtle nautical-chart grid (matches .bg-grid on the homepage).
    grid = rgba(PAPER, 13)
    for gx in range(0, W, 100 * S):
        draw.line([(gx, 0), (gx, H)], fill=grid, width=2)
    for gy in range(0, H, 100 * S):
        draw.line([(0, gy), (W, gy)], fill=grid, width=2)

    # Globe, right of center.
    cx, cy, r = int(890 * S), int(300 * S), int(230 * S)
    globe(draw, cx, cy, r, 7 * S)

    # Great-circle arcs sweeping past the globe (matches .bg-arcs).
    arcs = rgba(ACCENT_LIGHT, 130)
    arc_through(draw, (cx - int(1.55 * r), cy - int(1.7 * r), cx + int(1.15 * r), cy + int(1.5 * r)), 205, 318, arcs, 4 * S)
    arc_through(draw, (cx - int(1.9 * r), cy - int(0.6 * r), cx + int(1.6 * r), cy + int(1.9 * r)), 188, 300, arcs, 4 * S)
    # Waypoints + traveler dot on the first arc.
    for (wx, wy) in [(cx - int(0.62 * r), cy - int(0.86 * r)), (cx + int(0.88 * r), cy + int(0.28 * r))]:
        draw.ellipse([wx - 7 * S, wy - 7 * S, wx + 7 * S, wy + 7 * S], fill=rgba(ACCENT, 255))
    tx, ty = cx - int(0.05 * r), cy - int(0.52 * r)
    draw.ellipse([tx - 6 * S, ty - 6 * S, tx + 6 * S, ty + 6 * S], fill=rgba(PAPER, 255))

    # Left column: eyebrow, wordmark, tagline.
    left = 88 * S
    eyebrow = font(paths, "Schibsted.ttf", 21 * S, 600)
    draw_tracked(draw, (left, 168 * S), "AI CONTENT & SEO · THE MODERN CIRCUMNAVIGATION", eyebrow, rgba(ACCENT_LIGHT, 255), int(3.5 * S))

    wordmark = font(paths, "Bricolage.ttf", 108 * S, 800)
    draw.text((left, 228 * S), "Phileas Fogg", font=wordmark, fill=rgba(PAPER, 255))

    tagline = font(paths, "Schibsted.ttf", 34 * S, 400)
    draw.text((left, 372 * S), "Content that goes around the world.", font=tagline, fill=rgba(PAPER, 199))

    domain = font(paths, "Schibsted.ttf", 25 * S, 500)
    draw.text((left, 542 * S), "codevex.app", font=domain, fill=rgba(PAPER, 128))

    return img.resize((1200, 630), Image.LANCZOS)


def render_favicon_master() -> Image.Image:
    """1024x1024 favicon master: navy rounded square + wordmark globe."""
    S = 2  # draw 2048, downscale
    size = 1024 * S
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * 0.225)
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=rgba(INK, 255))

    cx = cy = size // 2
    r = int(size * 0.335)
    rim = rgba(ACCENT, 255)
    line = rgba(PAPER, int(255 * 0.68))
    lw = int(size * 0.022)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rim, width=lw)
    draw.ellipse([cx - int(r * 0.46), cy - r, cx + int(r * 0.46), cy + r], outline=line, width=lw // 2)
    draw.ellipse([cx - r, cy - int(r * 0.36), cx + r, cy + int(r * 0.36)], outline=line, width=lw // 2)
    draw.line([cx - r, cy, cx + r, cy], fill=line, width=lw // 2)
    # Waypoint dot, top-right (same composition as the header wordmark).
    dot_r = int(size * 0.052)
    dx, dy = cx + int(r * 0.72), cy - int(r * 0.72)
    draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=rgba(PAPER, 255))

    return img.resize((1024, 1024), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="write outputs to a temp dir instead of public/")
    args = ap.parse_args()

    cache_dir = os.path.join(tempfile.gettempdir(), "mybiz-brand-fonts")
    os.makedirs(cache_dir, exist_ok=True)
    paths = ensure_fonts(cache_dir)

    og = render_og(paths)
    favicon_master = render_favicon_master()

    if args.dry_run:
        out = tempfile.mkdtemp(prefix="mybiz-brand-")
    else:
        out = "public"
    og_path = os.path.join(out, "og-image.png")
    og.convert("RGB").save(og_path, format="PNG", optimize=True)
    ico_path = os.path.join(out, "favicon.ico")
    favicon_master.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"wrote {og_path} ({os.path.getsize(og_path)} bytes)")
    print(f"wrote {ico_path} ({os.path.getsize(ico_path)} bytes)")


if __name__ == "__main__":
    main()
