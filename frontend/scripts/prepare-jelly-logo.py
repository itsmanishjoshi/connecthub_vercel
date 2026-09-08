from collections import deque
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "public"
source = root / "jelly - logo.png"
dest = root / "jelly-logo.png"
if not source.exists():
    raise SystemExit(0)

image = Image.open(source).convert("RGBA")
width, height = image.size
pixels = image.load()


def is_background(color):
    red, green, blue, alpha = color
    return alpha < 12 or (red < 36 and green < 36 and blue < 36)


seen = [[False] * width for _ in range(height)]
queue = deque()
for x in range(width):
    queue.append((x, 0))
    queue.append((x, height - 1))
for y in range(height):
    queue.append((0, y))
    queue.append((width - 1, y))

while queue:
    x, y = queue.popleft()
    if x < 0 or y < 0 or x >= width or y >= height or seen[y][x]:
        continue
    seen[y][x] = True
    if not is_background(pixels[x, y]):
        continue
    pixels[x, y] = (0, 0, 0, 0)
    queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

# Clear near-black fringe that touches already-transparent pixels (not the eyes).
neighbors = ((1, 0), (-1, 0), (0, 1), (0, -1))
fringe = []
for y in range(height):
    for x in range(width):
        red, green, blue, alpha = pixels[x, y]
        if alpha == 0 or red >= 36 or green >= 36 or blue >= 36:
            continue
        if any(
            0 <= x + dx < width
            and 0 <= y + dy < height
            and pixels[x + dx, y + dy][3] == 0
            for dx, dy in neighbors
        ):
            fringe.append((x, y))
for x, y in fringe:
    pixels[x, y] = (0, 0, 0, 0)

bbox = image.getbbox()
if bbox:
    left, top, right, bottom = bbox
    pad = max(8, int(max(right - left, bottom - top) * 0.04))
    crop = (
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    )
    image = image.crop(crop)

image.save(dest, "PNG")
