"""
Generate a Chhattisgarh Government Seal emblem PNG for the gazette PDF.
Creates a 400x400 transparent-background emblem with:
- Green circular border with rice/wheat decorations
- Ashoka Lion Capital in center (text placeholder)
- "छत्तीसगढ़ शासन" text
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

SIZE = 400
CENTER = SIZE // 2
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Colors
GREEN = (19, 136, 8)
DARK_GREEN = (0, 100, 0)
GOLD = (180, 140, 20)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

# === OUTER RING (green) ===
draw.ellipse([10, 10, SIZE-10, SIZE-10], outline=DARK_GREEN, width=6)
draw.ellipse([18, 18, SIZE-18, SIZE-18], outline=GREEN, width=3)

# === DECORATIVE DOTS around circle (wheat grain style) ===
num_dots = 36
for i in range(num_dots):
    angle = 2 * math.pi * i / num_dots
    r = SIZE // 2 - 14
    x = CENTER + r * math.cos(angle)
    y = CENTER + r * math.sin(angle)
    draw.ellipse([x-3, y-3, x+3, y+3], fill=GREEN)

# === INNER CIRCLE ===
inner_r = 140
draw.ellipse([CENTER-inner_r, CENTER-inner_r, CENTER+inner_r, CENTER+inner_r],
             outline=DARK_GREEN, width=2)

# === ASHOKA PILLAR SYMBOL (drawn programmatically) ===
# Base platform
draw.rectangle([CENTER-40, CENTER+20, CENTER+40, CENTER+30], fill=DARK_GREEN)
draw.rectangle([CENTER-35, CENTER+10, CENTER+35, CENTER+20], fill=DARK_GREEN)
# Pillar shaft
draw.rectangle([CENTER-15, CENTER-40, CENTER+15, CENTER+10], fill=DARK_GREEN)
# Capital top (dome)
draw.ellipse([CENTER-25, CENTER-60, CENTER+25, CENTER-35], fill=DARK_GREEN)
# Lions (simplified - three peaks)
for dx in [-18, 0, 18]:
    draw.polygon([
        (CENTER+dx-8, CENTER-55),
        (CENTER+dx, CENTER-75),
        (CENTER+dx+8, CENTER-55)
    ], fill=DARK_GREEN)
# Ashoka Chakra (circle with spokes)
chakra_cx, chakra_cy = CENTER, CENTER - 28
chakra_r = 10
draw.ellipse([chakra_cx-chakra_r, chakra_cy-chakra_r,
              chakra_cx+chakra_r, chakra_cy+chakra_r],
             outline=GOLD, width=2)
for i in range(24):
    angle = 2 * math.pi * i / 24
    x1 = chakra_cx + (chakra_r-2) * math.cos(angle)
    y1 = chakra_cy + (chakra_r-2) * math.sin(angle)
    draw.line([(chakra_cx, chakra_cy), (x1, y1)], fill=GOLD, width=1)

# === TEXT: "सत्यमेव जयते" below pillar ===
try:
    hindi_font_small = ImageFont.truetype("C:/Windows/Fonts/Nirmala.ttf", 18)
    hindi_font_large = ImageFont.truetype("C:/Windows/Fonts/NirmalaB.ttf", 26)
    hindi_font_med = ImageFont.truetype("C:/Windows/Fonts/Nirmala.ttf", 20)
except:
    hindi_font_small = ImageFont.load_default()
    hindi_font_large = hindi_font_small
    hindi_font_med = hindi_font_small

# "सत्यमेव जयते" under the emblem
text_sy = "सत्यमेव जयते"
bbox = draw.textbbox((0,0), text_sy, font=hindi_font_small)
tw = bbox[2] - bbox[0]
draw.text((CENTER - tw//2, CENTER + 35), text_sy, fill=DARK_GREEN, font=hindi_font_small)

# === CURVED TEXT: "छत्तीसगढ़" (top arc) and "शासन" (bottom arc) ===
# Top arc: छत्तीसगढ़
top_text = "छत्तीसगढ़"
arc_r = inner_r + 20
start_angle = -math.pi/2 - 0.45  # start from roughly top-left
for i, ch in enumerate(top_text):
    angle = start_angle + i * 0.12
    x = CENTER + arc_r * math.cos(angle)
    y = CENTER + arc_r * math.sin(angle)
    draw.text((x-8, y-10), ch, fill=DARK_GREEN, font=hindi_font_large)

# Bottom arc: शासन
bot_text = "शासन"
start_angle_b = math.pi/2 - 0.18
for i, ch in enumerate(bot_text):
    angle = start_angle_b + i * 0.12
    x = CENTER + arc_r * math.cos(angle)
    y = CENTER + arc_r * math.sin(angle)
    draw.text((x-8, y-10), ch, fill=DARK_GREEN, font=hindi_font_large)

# Save
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'emblem.png')
img.save(out_path, 'PNG')
print(f"Emblem saved: {out_path} ({os.path.getsize(out_path)} bytes)")
