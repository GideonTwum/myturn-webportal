"""Build mobile app icons from the MyTurn Susu logo with safe padding and centering."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "apps" / "mobile-app" / "assets" / "logo-source.png"
OUT_DIR = ROOT / "apps" / "mobile-app" / "assets"
CANVAS = 1024
# App primary green — matches loading screen
GREEN = (0, 105, 72, 255)


def extract_white_logo(src: Image.Image) -> Image.Image:
    px = np.array(src.convert("RGBA"), dtype=np.int32)
    h, w = px.shape[:2]

    green = (
        (px[:, :, 1] > px[:, :, 0] + 20)
        & (px[:, :, 1] > px[:, :, 2] + 20)
        & (px[:, :, 1] > 60)
    )
    ys, xs = np.where(green)
    if len(xs) == 0:
        raise RuntimeError("No green circle found in source image")

    cy = float(ys.mean())
    cx = float(xs.mean())
    radius = float(np.sqrt((ys - cy) ** 2 + (xs - cx) ** 2).max())

    yy, xx = np.ogrid[:h, :w]
    disk = (yy - cy) ** 2 + (xx - cx) ** 2 <= (radius * 0.9) ** 2
    logo_mask = (
        disk
        & (px[:, :, 0] > 235)
        & (px[:, :, 1] > 235)
        & (px[:, :, 2] > 235)
    )

    layer = np.zeros((h, w, 4), dtype=np.uint8)
    layer[logo_mask] = (255, 255, 255, 255)
    logo = Image.fromarray(layer, "RGBA")
    bbox = logo.getbbox()
    if not bbox:
        raise RuntimeError("No white logo pixels found inside green circle")
    return logo.crop(bbox)


def paste_centered(canvas: Image.Image, logo: Image.Image, scale: float) -> None:
    target = int(CANVAS * scale)
    fitted = logo.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (CANVAS - fitted.width) // 2
    y = (CANVAS - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)


def build_assets(source: Path) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    logo = extract_white_logo(Image.open(source))

    icon = Image.new("RGBA", (CANVAS, CANVAS), GREEN)
    paste_centered(icon, logo, scale=0.54)
    icon.save(OUT_DIR / "icon.png")

    adaptive = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    paste_centered(adaptive, logo, scale=0.48)
    adaptive.save(OUT_DIR / "adaptive-icon.png")

    splash = Image.new("RGBA", (CANVAS, CANVAS), GREEN)
    paste_centered(splash, logo, scale=0.50)
    splash.save(OUT_DIR / "splash-icon.png")

    print(f"Source: {source}")
    print(f"Wrote icon.png, adaptive-icon.png, splash-icon.png -> {OUT_DIR}")


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    build_assets(src)
