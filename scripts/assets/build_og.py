#!/usr/bin/env python3
"""Images de partage (Open Graph 1200×630) et icônes du site, style « tableau noir ».

    npm run assets:og

Écrit public/og/<nom>.jpg, public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png,
public/icon-192.png, public/icon-512.png et public/icon-maskable-512.png.
Polices lues directement dans node_modules (@fontsource) : aucune police système requise.
Reproductible : le grain de craie est généré avec une graine fixe.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
FONTS = ROOT / "node_modules"
SKETCH = FONTS / "@fontsource/cabin-sketch/files/cabin-sketch-latin-700-normal.woff"
KALAM = FONTS / "@fontsource/kalam/files/kalam-latin-400-normal.woff"
KALAM_BOLD = FONTS / "@fontsource/kalam/files/kalam-latin-700-normal.woff"
INTER = FONTS / "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"

SLATE = (20, 21, 22)
SLATE_2 = (34, 35, 37)
CHALK = (237, 237, 230)
YELLOW = (242, 212, 92)
WOOD = (107, 85, 65)
WOOD_DARK = (74, 58, 43)

W, H = 1200, 630

VARIANTS = {
    "default": ("L’investissement immobilier,", "expliqué au tableau.", "Vidéos de 10 minutes · calculateurs · lexique", "house"),
    "episodes": ("Les épisodes :", "un sujet, un tableau.", "10 minutes, chiffré, sourcé et daté", "house"),
    "outils": ("Les calculateurs,", "formule à l’appui.", "Crédit · capacité d’emprunt · rendement · cash-flow", "bars"),
    "lexique": ("Le lexique", "de l’investisseur.", "Des définitions courtes, sourcées et mises à jour", "note"),
    "methode": ("Notre méthode,", "sans boîte noire.", "Formules, sources officielles, dates de mise à jour", "bars"),
    "credit": ("Mensualité de crédit", "et coût total.", "M = C × t ÷ (1 − (1 + t)^−n)", "bars"),
    "capacite": ("Capacité d’emprunt :", "la règle des 35 %.", "Revenus × 35 % − crédits en cours", "bars"),
    "rendement": ("Rendement locatif", "brut et net.", "Loyers annuels ÷ coût total × 100", "bars"),
    "cashflow": ("Cash-flow mensuel,", "avant impôt.", "Loyer encaissé − crédit − charges", "bars"),
}


def font(path: Path, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    loaded = ImageFont.truetype(str(path), size)
    if weight is not None:
        try:
            loaded.set_variation_by_axes([weight])
        except (OSError, ValueError):
            pass
    return loaded


def grain(size: tuple[int, int], seed: int, strength: int) -> Image.Image:
    """Bruit blanc doux (poussière de craie) en niveaux de gris."""
    random.seed(seed)
    noise = Image.effect_noise(size, 64).filter(ImageFilter.GaussianBlur(0.6))
    return noise.point(lambda value: max(0, value - 128) * strength // 128)


def board(size: tuple[int, int], seed: int = 7) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, SLATE)
    gradient = Image.linear_gradient("L").resize(size).point(lambda value: 255 - value)
    image = Image.composite(Image.new("RGB", size, SLATE_2), image, gradient)
    # Traces d'effacement (grandes taches claires très diffuses).
    smudges = Image.new("L", size, 0)
    draw = ImageDraw.Draw(smudges)
    random.seed(seed)
    for _ in range(7):
        cx, cy = random.randint(0, width), random.randint(0, height)
        rx, ry = random.randint(width // 6, width // 3), random.randint(height // 8, height // 4)
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=random.randint(10, 22))
    smudges = smudges.filter(ImageFilter.GaussianBlur(60))
    image = Image.composite(Image.new("RGB", size, CHALK), image, smudges)
    # Poussière de craie.
    dust = grain(size, seed, 34)
    image = Image.composite(Image.new("RGB", size, CHALK), image, dust)
    # Vignettage.
    vignette = Image.new("L", size, 0)
    ImageDraw.Draw(vignette).ellipse((-width * 0.25, -height * 0.35, width * 1.25, height * 1.35), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(120))
    return Image.composite(image, Image.new("RGB", size, (14, 18, 17)), vignette)


def chalky(layer: Image.Image, seed: int) -> Image.Image:
    """Donne un grain « craie » à un calque RGBA (trous aléatoires dans l'opacité)."""
    random.seed(seed)
    alpha = layer.getchannel("A")
    holes = Image.effect_noise(layer.size, 90).point(lambda value: 255 if value > 70 else 150)
    layer.putalpha(ImageChops.multiply(alpha, holes))
    return layer


def chalk_text(base: Image.Image, xy: tuple[int, int], text: str, typeface: ImageFont.FreeTypeFont, color: tuple[int, int, int], seed: int) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, text, font=typeface, fill=(*color, 255))
    base.alpha_composite(chalky(layer, seed))


def wobbly_line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], color: tuple[int, ...], width: int, seed: int) -> None:
    random.seed(seed)
    jittered = [(x + random.uniform(-1.4, 1.4), y + random.uniform(-1.4, 1.4)) for x, y in points]
    draw.line(jittered, fill=color, width=width, joint="curve")


def segment(a: tuple[float, float], b: tuple[float, float], steps: int = 12) -> list[tuple[float, float]]:
    return [(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps) for i in range(steps + 1)]


def drawing(base: Image.Image, kind: str, origin: tuple[int, int], scale: float, seed: int) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    ox, oy = origin

    def p(x: float, y: float) -> tuple[float, float]:
        return (ox + x * scale, oy + y * scale)

    white = (*CHALK, 235)
    yellow = (*YELLOW, 245)
    if kind == "house":
        for a, b in [((0, 120), (110, 30)), ((110, 30), (220, 120)), ((30, 100), (30, 230)), ((190, 100), (190, 230)), ((30, 230), (190, 230))]:
            wobbly_line(draw, segment(p(*a), p(*b)), white, int(7 * scale), seed)
        for a, b in [((85, 230), (85, 165)), ((85, 165), (135, 165)), ((135, 165), (135, 230))]:
            wobbly_line(draw, segment(p(*a), p(*b)), white, int(5 * scale), seed + 1)
        for x0 in (45, 150):
            for a, b in [((x0, 125), (x0 + 28, 125)), ((x0 + 28, 125), (x0 + 28, 150)), ((x0 + 28, 150), (x0, 150)), ((x0, 150), (x0, 125))]:
                wobbly_line(draw, segment(p(*a), p(*b), 4), white, int(4 * scale), seed + 2)
        curve = [p(-10 + t * 2.6, 262 - 6 * math.sin(t / 30)) for t in range(0, 100)]
        wobbly_line(draw, curve, yellow, int(7 * scale), seed + 3)
    elif kind == "bars":
        wobbly_line(draw, segment(p(0, 0), p(0, 240)), white, int(6 * scale), seed)
        wobbly_line(draw, segment(p(0, 240), p(250, 240)), white, int(6 * scale), seed + 1)
        for index, height in enumerate((60, 100, 135, 185)):
            x = 30 + index * 55
            for a, b in [((x, 240), (x, 240 - height)), ((x, 240 - height), (x + 34, 240 - height)), ((x + 34, 240 - height), (x + 34, 240))]:
                wobbly_line(draw, segment(p(*a), p(*b), 6), white, int(5 * scale), seed + index)
        arrow = [p(20 + t * 2.3, 170 - t * 1.45 - 10 * math.sin(t / 18)) for t in range(0, 100)]
        wobbly_line(draw, arrow, yellow, int(7 * scale), seed + 9)
        tip = arrow[-1]
        wobbly_line(draw, [tip, (tip[0] - 26 * scale, tip[1] + 2 * scale)], yellow, int(7 * scale), seed + 10)
        wobbly_line(draw, [tip, (tip[0] - 6 * scale, tip[1] + 26 * scale)], yellow, int(7 * scale), seed + 11)
    elif kind == "note":
        paper = Image.new("RGBA", (int(230 * scale), int(250 * scale)), (243, 235, 221, 255))
        pd = ImageDraw.Draw(paper)
        for line_y in range(114, 250, 34):
            pd.line([(18 * scale, line_y * scale), (212 * scale, line_y * scale)], fill=(150, 170, 190, 90), width=2)
        pd.text((22 * scale, 18 * scale), "LMNP", font=font(KALAM_BOLD, int(46 * scale)), fill=SLATE)
        pd.text((22 * scale, 74 * scale), "SCI · PTZ", font=font(KALAM, int(30 * scale)), fill=SLATE)
        pd.text((22 * scale, 108 * scale), "DPE · HCSF", font=font(KALAM, int(30 * scale)), fill=SLATE)
        pd.text((22 * scale, 142 * scale), "cash-flow", font=font(KALAM, int(30 * scale)), fill=SLATE)
        tape = Image.new("RGBA", (int(110 * scale), int(34 * scale)), (232, 220, 190, 200))
        paper = paper.rotate(4, expand=True, resample=Image.BICUBIC)
        shadow = Image.new("RGBA", paper.size, (0, 0, 0, 0))
        shadow.putalpha(paper.getchannel("A").point(lambda value: value // 3))
        layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)), (ox + 8, oy + 14))
        layer.alpha_composite(paper, (ox, oy))
        layer.alpha_composite(tape.rotate(-6, expand=True, resample=Image.BICUBIC), (ox + int(70 * scale), oy - int(14 * scale)))
        base.alpha_composite(layer)
        return
    base.alpha_composite(chalky(layer, seed + 50))


def frame(image: Image.Image, thickness: int = 18) -> Image.Image:
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for index in range(thickness):
        shade = tuple(int(WOOD_DARK[c] + (WOOD[c] - WOOD_DARK[c]) * (index / thickness)) for c in range(3))
        draw.rectangle((index, index, width - 1 - index, height - 1 - index), outline=shade)
    draw.rectangle((thickness, thickness, width - 1 - thickness, height - 1 - thickness), outline=(20, 24, 22), width=2)
    return image


def mark(size: int) -> Image.Image:
    """Logo : petit tableau, maison à la craie, trait jaune (dessiné à 4× puis réduit)."""
    big = size * 4
    unit = big / 40
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1.75 * unit, 1.75 * unit, 38.25 * unit, 38.25 * unit), radius=7 * unit, fill=SLATE_2, outline=(122, 97, 73), width=int(3.5 * unit))

    def poly(points: list[tuple[float, float]], color: tuple[int, int, int], width: float) -> None:
        draw.line([(x * unit, y * unit) for x, y in points], fill=color, width=int(width * unit), joint="curve")
        for x, y in (points[0], points[-1]):
            r = width * unit / 2
            draw.ellipse((x * unit - r, y * unit - r, x * unit + r, y * unit + r), fill=color)

    poly([(10.5, 20.5), (20, 12.2), (29.5, 20.5)], CHALK, 2.5)
    poly([(13.4, 18.6), (13.4, 27.5), (26.6, 27.5), (26.6, 18.6)], CHALK, 2.5)
    poly([(18, 27.5), (18, 23.1), (22, 23.1), (22, 27.5)], CHALK, 2)
    poly([(9, 32.4), (14, 31.4), (20, 31.0), (26, 31.2), (31, 31.8)], YELLOW, 2.6)
    return image.resize((size, size), Image.LANCZOS)


def build_og(name: str, title: str, highlight: str, subtitle: str, art: str, seed: int) -> None:
    image = board((W, H), seed).convert("RGBA")
    logo = mark(64)
    image.alpha_composite(logo, (64, 58))
    chalk_text(image, (146, 66), "Tableau Immo", font(SKETCH, 46), CHALK, seed + 1)
    title_font = font(SKETCH, 74 if len(title) < 24 else 66)
    chalk_text(image, (64, 205), title, title_font, CHALK, seed + 2)
    chalk_text(image, (64, 295), highlight, title_font, YELLOW, seed + 3)
    chalk_text(image, (68, 418), subtitle, font(KALAM, 36), (201, 205, 197), seed + 4)
    chalk_text(image, (68, 520), "tableau noir · chiffres · sources officielles", font(INTER, 24, 500), (158, 165, 159), seed + 5)
    title_end = 64 + max(title_font.getlength(title), title_font.getlength(highlight))
    art_x = int(max(880, title_end + 50))
    art_scale = min(1.05, (W - 70 - art_x) / 240)
    drawing(image, art, (art_x, 175) if art != "note" else (art_x, 150), art_scale, seed + 6)
    out = frame(image.convert("RGB"))
    out.save(PUBLIC / "og" / f"{name}.jpg", "JPEG", quality=86, optimize=True, progressive=True)


def build_icons() -> None:
    for size, name in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        mark(size).save(PUBLIC / name, optimize=True)
    maskable = Image.new("RGBA", (512, 512), (*SLATE, 255))
    maskable.alpha_composite(mark(360), (76, 76))
    maskable.save(PUBLIC / "icon-maskable-512.png", optimize=True)
    mark(256).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    (PUBLIC / "favicon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="1.75" y="1.75" width="36.5" height="36.5" rx="7" fill="#222325" stroke="#7a6149" stroke-width="3.5"/>
  <path d="M10.5 20.5 20 12.2l9.5 8.3" fill="none" stroke="#edede6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.4 18.6v8.9h13.2v-8.9" fill="none" stroke="#edede6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 27.5v-4.4h4v4.4" fill="none" stroke="#edede6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 32.4c5.6-1.6 15.1-1.9 22-.6" fill="none" stroke="#f2d45c" stroke-width="2.6" stroke-linecap="round"/>
</svg>
""",
        encoding="utf-8",
    )


FIXTURES = {
    "ep01-rendement-brut-ou-net": ("Épisode 1", "Rendement : brut", "ou net ?", "de 6 % à 4,5 %"),
    "ep02-lmnp-2026-ce-qui-change": ("Épisode 2", "LMNP 2026 :", "ce qui change", "18,6 %"),
}


def fixture_thumbnails() -> None:
    """Miniatures 1280×720 des épisodes de démonstration (tests/fixtures/episodes)."""
    for index, (folder, (kicker, line1, line2, number)) in enumerate(FIXTURES.items()):
        image = board((1280, 720), seed=101 + index).convert("RGBA")
        chalk_text(image, (80, 70), kicker, font(KALAM_BOLD, 54), YELLOW, 201 + index)
        chalk_text(image, (80, 190), line1, font(SKETCH, 104), CHALK, 301 + index)
        chalk_text(image, (80, 320), line2, font(SKETCH, 104), YELLOW, 401 + index)
        chalk_text(image, (84, 500), number, font(KALAM_BOLD, 96), CHALK, 501 + index)
        drawing(image, "bars", (930, 230), 1.15, 601 + index)
        out = ROOT / "tests" / "fixtures" / "episodes" / folder / "thumbnail.jpg"
        out.parent.mkdir(parents=True, exist_ok=True)
        frame(image.convert("RGB"), 14).save(out, "JPEG", quality=82, optimize=True, progressive=True)
        print(f"✓ {out.relative_to(ROOT)}")


def main() -> None:
    import sys

    if "--fixtures" in sys.argv:
        fixture_thumbnails()
        return
    (PUBLIC / "og").mkdir(parents=True, exist_ok=True)
    for index, (name, (title, highlight, subtitle, art)) in enumerate(VARIANTS.items()):
        build_og(name, title, highlight, subtitle, art, seed=11 + index * 7)
        print(f"✓ public/og/{name}.jpg")
    build_icons()
    print("✓ icônes : favicon.svg, favicon.ico, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png")


if __name__ == "__main__":
    main()
