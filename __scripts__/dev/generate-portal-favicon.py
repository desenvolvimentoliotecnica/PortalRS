#!/usr/bin/env python3
"""Gera favicon do Portal RH a partir da arte fornecida (fundo cinza -> transparente)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

SRC = Path(r"C:\Users\leonardo.mendes\Downloads\ChatGPT Image 30 de jun. de 2026, 08_21_40.png")
REPO = Path(__file__).resolve().parents[2]

OUT_NEXT_APP = REPO / "LioTecnica.Web.Next" / "src" / "app"
OUT_NEXT_PUBLIC = REPO / "LioTecnica.Web.Next" / "public"
OUT_VAGAS = REPO / "LioTecnica.PortalVagas.React" / "public"


def sample_background(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    points = [
        (2, 2),
        (w - 3, 2),
        (2, h - 3),
        (w - 3, h - 3),
        (w // 2, 2),
        (w // 2, h - 3),
    ]
    rs, gs, bs = [], [], []
    px = img.load()
    for x, y in points:
        r, g, b = px[x, y][:3]
        rs.append(r)
        gs.append(g)
        bs.append(b)
    return (
        sum(rs) // len(rs),
        sum(gs) // len(gs),
        sum(bs) // len(bs),
    )


def remove_background(img: Image.Image, bg: tuple[int, int, int], tolerance: int = 38) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    br, bg_c, bb = bg
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = abs(r - br) + abs(g - bg_c) + abs(b - bb)
            if dist <= tolerance:
                px[x, y] = (r, g, b, 0)
    return rgba


def crop_to_content(img: Image.Image, pad_ratio: float = 0.06) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    w = right - left
    h = bottom - top
    pad = int(max(w, h) * pad_ratio)
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    cropped = img.crop((left, top, right, bottom))
    side = max(cropped.width, cropped.height)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset = ((side - cropped.width) // 2, (side - cropped.height) // 2)
    square.paste(cropped, offset, cropped)
    return square


def save_ico(path: Path, img: Image.Image, sizes: tuple[int, ...] = (16, 32, 48, 64, 128, 256)) -> None:
    frames = [
        img.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
        for size in sizes
    ]
    # Pillow grava a partir do maior frame; sizes lista todas as resolucoes embutidas.
    frames[-1].save(
        path,
        format="ICO",
        sizes=[(size, size) for size in sizes],
        append_images=frames[:-1],
    )


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Arquivo de origem não encontrado: {SRC}")

    raw = Image.open(SRC)
    bg = sample_background(raw)
    print(f"Background amostrado: rgb{bg}")

    processed = crop_to_content(remove_background(raw, bg))
    master = processed.resize((512, 512), Image.Resampling.LANCZOS)
    icon_tab = master.resize((48, 48), Image.Resampling.LANCZOS)

    OUT_NEXT_APP.mkdir(parents=True, exist_ok=True)
    OUT_NEXT_PUBLIC.mkdir(parents=True, exist_ok=True)
    OUT_VAGAS.mkdir(parents=True, exist_ok=True)

    # Next.js prioriza app/favicon.ico sobre app/icon.png — ambos devem ser da arte nova.
    save_ico(OUT_NEXT_APP / "favicon.ico", master)
    save_ico(OUT_NEXT_PUBLIC / "favicon.ico", master)
    icon_tab.save(OUT_NEXT_APP / "icon.png", format="PNG", optimize=True)
    master.resize((180, 180), Image.Resampling.LANCZOS).save(
        OUT_NEXT_APP / "apple-icon.png", format="PNG", optimize=True
    )
    master.resize((192, 192), Image.Resampling.LANCZOS).save(
        OUT_VAGAS / "favicon.png", format="PNG", optimize=True
    )
    save_ico(OUT_VAGAS / "favicon.ico", master)

    old_svg = OUT_NEXT_APP / "icon.svg"
    if old_svg.exists():
        old_svg.unlink()
        print(f"Removido: {old_svg}")

    print("Favicons gerados com sucesso.")


if __name__ == "__main__":
    main()
