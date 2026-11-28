"""Encode the user-provided original ZZXlab wordmark as Windows/install assets.

The source artwork is checked in; this export only fits/encodes it and lays out
installer labels. It never redraws the logo with an unrelated system font.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'installer' / 'branding'
source = Image.open(root / 'ZZXLAB-wordmark.png').convert('RGBA')
if source.getchannel('A').getextrema() != (0, 255):
    raise ValueError('Expected the approved transparent wordmark')
art = source.crop(source.getbbox())

def fit_wordmark(size, width_fraction=.93):
    canvas = Image.new('RGBA', size)
    scaled = art.copy()
    scaled.thumbnail((round(size[0]*width_fraction), round(size[1]*width_fraction)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, ((size[0]-scaled.width)//2, (size[1]-scaled.height)//2))
    return canvas

icon = fit_wordmark((512, 512))
icon.save(root / 'ZZXLAB.png')
icon.save(root / 'ZZXLAB.ico', sizes=[(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)])
small = Image.new('RGB', (55,55), '#101010')
small.paste(fit_wordmark((55,55)), (0,0), fit_wordmark((55,55)))
small.save(root / 'wizard-small.bmp')
banner = Image.new('RGB', (164,314), '#101010')
mark = fit_wordmark((164,110), .88)
banner.paste(mark, (0,22), mark)
draw = ImageDraw.Draw(banner)
font = 'C:/Windows/Fonts/seguisb.ttf'
for text,y,size,color in [('AnkerMake',170,14,'white'),('PhotoHub',194,18,'white'),('0.8.7.4 BETA',284,10,'#ffff00')]:
    draw.text((15,y),text,font=ImageFont.truetype(font,size),fill=color)
banner.save(root / 'wizard.bmp')
(root/'ZZXLAB.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>ZZXlab original handwritten yellow and cyan wordmark</title><image href="ZZXLAB.png" width="512" height="512"/></svg>\n',encoding='utf8')
digest=hashlib.sha256((root/'ZZXLAB.ico').read_bytes()).hexdigest()
name='ZZXlab-'+digest[:12]+'.ico'
(root/name).write_bytes((root/'ZZXLAB.ico').read_bytes())
(root/'brand-icon.json').write_text(json.dumps({'brand':'ZZXlab','file':name,'sha256':digest,'sourceSha256':hashlib.sha256((root/'ZZXLAB-wordmark.png').read_bytes()).hexdigest()},indent=2)+'\n',encoding='utf8')
(root/'brand-assets.iss').write_text('#define BrandIconName "'+name+'"\n',encoding='utf8')
print('Encoded approved wordmark: PNG, ICO (9 sizes), SVG wrapper and wizard BMP assets')
