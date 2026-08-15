#!/usr/bin/env python3
"""Render social-preview and raster app icons from Proplet's brand palette."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def gradient(size: tuple[int, int], start: tuple[int, int, int], end: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            ratio = (x / max(1, width - 1) + y / max(1, height - 1)) / 2
            pixels[x, y] = tuple(round(a + (b - a) * ratio) for a, b in zip(start, end))
    return image


def centered_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, text_font: ImageFont.FreeTypeFont, fill: str) -> None:
    box = draw.textbbox((0, 0), text, font=text_font)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2 - box[1]), text, font=text_font, fill=fill)


def brand_icon(size: int, destination: str) -> None:
    scale = size / 512
    image = gradient((size, size), (101, 86, 223), (139, 117, 244)).convert("RGBA")
    mask = Image.new("L", (size, size))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(142 * scale), fill=255)
    image.putalpha(mask)
    draw = ImageDraw.Draw(image)
    letter_font = font(max(12, round(285 * scale)), bold=True)
    centered_text(draw, (round(252 * scale), round(270 * scale)), "P", letter_font, "#FFFFFF")
    dot_radius = max(2, round(45 * scale))
    draw.ellipse((round(391 * scale) - dot_radius, round(116 * scale) - dot_radius, round(391 * scale) + dot_radius, round(116 * scale) + dot_radius), fill="#FFD66B")
    image.save(PUBLIC / destination, optimize=True)


def social_card() -> None:
    image = gradient((1200, 630), (249, 246, 255), (237, 232, 255)).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((920, -110, 1300, 270), fill=(220, 212, 255, 145))
    draw.ellipse((-100, 420, 310, 830), fill=(207, 239, 228, 190))
    draw.polygon(((0, 505), (205, 447), (430, 526), (650, 445), (875, 456), (1200, 393), (1200, 630), (0, 630)), fill=(255, 255, 255, 105))

    shadow = Image.new("RGBA", image.size)
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((116, 130, 390, 404), radius=82, fill=(73, 59, 130, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    image.alpha_composite(shadow)

    logo = gradient((274, 274), (101, 86, 223), (139, 117, 244)).convert("RGBA")
    logo_mask = Image.new("L", logo.size)
    ImageDraw.Draw(logo_mask).rounded_rectangle((0, 0, 273, 273), radius=82, fill=255)
    logo.putalpha(logo_mask)
    logo_draw = ImageDraw.Draw(logo)
    centered_text(logo_draw, (137, 145), "P", font(190, bold=True), "#FFFFFF")
    logo_draw.ellipse((190, 10, 258, 78), fill="#FFD66B", outline="#F9F6FF", width=9)
    image.alpha_composite(logo, (112, 121))
    draw = ImageDraw.Draw(image, "RGBA")

    draw.text((106, 432), "Proplet", font=font(79, bold=True), fill="#25243A", stroke_width=0)
    draw.text((111, 526), "Česká slovní hra, která umí", font=font(25, bold=True), fill="#68647A")
    draw.text((111, 562), "příjemně zamotat hlavu.", font=font(29, bold=True), fill="#5D4ED0")

    board_shadow = Image.new("RGBA", image.size)
    ImageDraw.Draw(board_shadow).rounded_rectangle((646, 82, 1106, 542), radius=62, fill=(73, 59, 130, 55))
    image.alpha_composite(board_shadow.filter(ImageFilter.GaussianBlur(16)))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle((646, 82, 1106, 542), radius=62, fill="#FFFEFD", outline="#E4DDF0", width=3)

    ox, oy, cell, gap = 680, 116, 68, 12
    centers: list[list[tuple[int, int]]] = []
    for row in range(5):
        centers.append([])
        for column in range(5):
            x, y = ox + column * (cell + gap), oy + row * (cell + gap)
            draw.rounded_rectangle((x, y, x + cell, y + cell), radius=18, fill="#FFFFFF", outline="#DCD5E8", width=2)
            centers[row].append((x + cell // 2, y + cell // 2))

    paths = [
        ([(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (2, 3), (3, 3), (3, 4)], "#8B7CF5"),
        ([(1, 0), (2, 0), (2, 1), (3, 1), (3, 2), (4, 2), (4, 3)], "#55CFA7"),
        ([(0, 3), (0, 4), (1, 4), (1, 3), (2, 3)], "#FF816F"),
    ]
    for route, color in paths:
        draw.line([centers[row][column] for row, column in route], fill=color + "99", width=24, joint="curve")

    letters = ("PROSL", "LETOV", "ETENI", "MOZEK", "HRAJ!")
    letter_font = font(31, bold=True)
    for row, word in enumerate(letters):
        for column, letter in enumerate(word):
            centered_text(draw, centers[row][column], letter, letter_font, "#25243A")

    draw.rounded_rectangle((1000, 555, 1144, 609), radius=27, fill="#FFD66B")
    centered_text(draw, (1072, 582), "HRAJ →", font(22, bold=True), "#554516")
    image.convert("RGB").save(PUBLIC / "share-card.png", quality=92, optimize=True)


if __name__ == "__main__":
    social_card()
    brand_icon(512, "icon-512.png")
    brand_icon(192, "icon-192.png")
    brand_icon(180, "apple-touch-icon.png")
    brand_icon(32, "favicon-32.png")
    print("brand assets: OK")
