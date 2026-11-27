"""Render the exact ZZXLAB wordmark as Windows application/install assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'installer' / 'branding'
root.mkdir(exist_ok=True)
font_path = 'C:/Windows/Fonts/seguisb.ttf'
font = ImageFont.truetype(font_path, 148)
image = Image.new('RGBA', (512, 512))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((4, 4, 508, 508), radius=108, fill='#161c19')
for text, y in [('ZZX', 65), ('LAB', 239)]:
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((512 - (box[2]-box[0]))/2 - box[0], y - box[1]), text, font=font, fill='#ffffff')
draw.rounded_rectangle((109, 424, 403, 437), radius=6, fill='#33bf5a')
image.save(root / 'ZZXLAB.png')
image.save(root / 'ZZXLAB.ico', sizes=[(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)])
small = image.resize((55,55),Image.Resampling.LANCZOS).convert('RGB');small.save(root / 'wizard-small.bmp')
banner = Image.new('RGB',(164,314),'#161c19');d=ImageDraw.Draw(banner)
for text,y in [('ZZX',40),('LAB',98)]:d.text((20,y),text,font=ImageFont.truetype(font_path,48),fill='white')
d.rectangle((22,169,140,172),fill='#33bf5a')
for text,y in [('AnkerMake',202),('PhotoHub',223),('0.8.7 PUBLIC BETA',280)]:d.text((22,y),text,font=ImageFont.truetype(font_path,13 if y<280 else 9),fill='white' if y<280 else '#66d584')
banner.save(root / 'wizard.bmp')
(root/'ZZXLAB.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="4" y="4" width="504" height="504" rx="108" fill="#161c19"/><g fill="white" font-family="Segoe UI, sans-serif" font-size="148" font-weight="600" text-anchor="middle"><text x="256" y="197">ZZX</text><text x="256" y="371">LAB</text></g><rect x="109" y="424" width="294" height="13" rx="6" fill="#33bf5a"/></svg>',encoding='utf8')
print('Built ZZXLAB icon sizes, vector source and installer artwork')
