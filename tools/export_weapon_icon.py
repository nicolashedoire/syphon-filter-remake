#!/usr/bin/env python3
"""Extract the original two-part 9mm HUD icon from French SCES_019.11."""
import argparse
from pathlib import Path
import struct
from PIL import Image
import archives_syphon as archives


def find_interface(data):
    needle = b'PISTOL1A.TIM\0'
    pos = data.find(needle, 0x10000)
    if pos < 0:
        raise ValueError('Pistol icon names not found')
    for offset in range(max(0, pos - 100000), pos):
        _, count, _, names, payload = struct.unpack_from('<IIIII', data, offset)
        if not (1 < count < 1500 and 20 + 4*count <= names < payload < 100000
                and offset + names <= pos < offset + payload):
            continue
        hog = data[offset:]
        try:
            entries = archives.parse_hog(hog)
        except archives.ArchiveError:
            continue
        by_name = {entry.name.upper(): entry for entry in entries}
        if 'PISTOL1A.TIM' in by_name and 'PISTOL1B.TIM' in by_name:
            return hog, by_name
    raise ValueError('Could not locate validated INTERFACE archive')


def decode_tim(data):
    if struct.unpack_from('<II', data) != (0x10, 9):
        raise ValueError('Unexpected TIM format')
    size, _, _, palette_width, palette_height = struct.unpack_from('<I4H', data, 8)
    if palette_width != 256 or palette_height != 1 or size < 524:
        raise ValueError('Unexpected TIM palette')
    palette = struct.unpack_from('<256H', data, 20)
    start = 8 + size
    block, _, _, width_words, height = struct.unpack_from('<I4H', data, start)
    width = width_words * 2
    pixels = data[start+12:start+12+width*height]
    if block < 12 + width*height or len(pixels) != width*height:
        raise ValueError('Truncated TIM pixels')
    colors = [((v&31)*255//31, ((v>>5)&31)*255//31, ((v>>10)&31)*255//31,
               0 if v == 0 else 255) for v in palette]
    image = Image.new('RGBA', (width, height))
    image.putdata([colors[i] for i in pixels])
    return image


def export(exe, output):
    hog, entries = find_interface(exe.read_bytes())
    images = []
    for name in ('PISTOL1A.TIM', 'PISTOL1B.TIM'):
        entry = entries[name]
        images.append(decode_tim(hog[entry.offset:entry.offset+entry.size]))
    if any(image.size != (32, 19) for image in images):
        raise ValueError('Unexpected pistol icon dimensions')
    image = Image.new('RGBA', (64, 19), (0, 0, 0, 0))
    image.paste(images[0], (0, 0))
    image.paste(images[1], (32, 0))
    with output.open('xb') as target:
        image.save(target, 'PNG')
    print(f'Original 9mm HUD icon exported to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    export(args.executable, args.output)
