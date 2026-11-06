#!/usr/bin/env python3
"""Export the original French PS1 title movie and New Game sprite.

The source is a SCES-01911 CUE/BIN image. The MP4 has no audio so a browser can
loop it on the title screen without requiring an autoplay permission. Its RGB
and alpha sprite derives from NEW.TIM's green CLUT, matching the title-only
additive composition documented by SF-pc-port. Requires FFmpeg and Pillow.
"""
from __future__ import annotations
import argparse
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
import archives_syphon as archives
import export_intro
import inspecter_disque_ps1 as iso


def export_sprite(hog: bytes, target: Path) -> None:
    item = next((e for e in archives.parse_hog(hog) if e.name.upper() == 'NEW.TIM'), None)
    if not item:
        raise ValueError('NEW.TIM was not found in TITLEF.HOG')
    data = hog[item.offset:item.offset + item.size]
    if len(data) < 20 or struct.unpack_from('<II', data, 0) != (0x10, 0x09):
        raise ValueError('Expected an 8-bit indexed TIM with a palette')
    block_size, _, _, palette_width, palette_height = struct.unpack_from('<I4H', data, 8)
    if palette_width != 256 or palette_height != 1 or block_size < 524 or 8 + block_size + 12 > len(data):
        raise ValueError('Unexpected title sprite palette')
    palette = struct.unpack_from('<256H', data, 20)
    offset = 8 + block_size
    pixel_block, _, _, width_words, height = struct.unpack_from('<I4H', data, offset)
    width = width_words * 2
    size = width * height
    if pixel_block < 12 + size or offset + 12 + size > len(data):
        raise ValueError('Truncated title sprite pixels')
    pixels = data[offset + 12:offset + 12 + size]
    image = Image.new('RGBA', (width, height))
    image.putdata([(35, 255, 10, ((palette[i] >> 5) & 31) * 255 // 31) for i in pixels])
    image.save(target, format='PNG')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cue', type=Path, help='French SCES-01911 BIN/CUE image')
    parser.add_argument('destination', type=Path, help='Existing output directory')
    args = parser.parse_args()
    try:
        if not shutil.which('ffmpeg'):
            raise RuntimeError('ffmpeg was not found')
        if not args.destination.is_dir():
            raise ValueError('The output directory must already exist')
        if any((args.destination / x).exists() for x in ('title-screen.mp4', 'title-new.png')):
            raise FileExistsError('An output file already exists')
        if not iso.inspect(args.cue)['edition_francaise_sces_01911']:
            raise ValueError('Expected the French SCES-01911 disc')
        with tempfile.TemporaryDirectory(prefix='syphon-title-') as temporary:
            directory = Path(temporary)
            hog = directory / 'TITLEF.HOG'
            iso.inspect(args.cue, ('/COMMON/TITLEF.HOG', hog))
            export_sprite(hog.read_bytes(), args.destination / 'title-new.png')
            disc = iso.Disc(iso.read_cue(args.cue))
            try:
                entry = export_intro.find_extents(disc)['/SOL/TITLE.STR']
                raw = directory / 'TITLE.STR'
                export_intro.extract_raw_movie(disc, entry, raw)
            finally:
                disc.close()
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-n', '-i', str(raw),
                            '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                            '-movflags', '+faststart', str(args.destination / 'title-screen.mp4')], check=True)
        print('Exported the original title-screen movie and French New Game sprite.')
        return 0
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.CalledProcessError, iso.ImageError, archives.ArchiveError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
