import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
files = sorted(glob.glob(os.path.join(sys.argv[1], '*.png')))
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 640
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
out = Image.new('RGB', (cols * tw, rows * (th + 26)), (20, 20, 20))
d = ImageDraw.Draw(out)
font = ImageFont.truetype(os.path.expanduser('~/Library/Fonts/PretendardVariable.ttf'), 18)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 26)
    out.paste(im, (x, y + 26))
    d.text((x + 6, y + 3), os.path.basename(f), fill=(230, 230, 230), font=font)
out.save(sys.argv[2])
print(sys.argv[2], out.size)
