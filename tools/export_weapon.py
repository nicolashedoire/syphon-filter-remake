#!/usr/bin/env python3
"""Export the French disc's GLOKSIL.GMD and texture pages to a standalone JS asset.

Input is an extracted SUBWAY.FOG. Requires Pillow, a C++20 compiler and the
MIT-licensed SF-pc-port parser; the generated asset needs no runtime libraries.
"""
import argparse
import base64
import io
import json
from pathlib import Path
import struct
import subprocess
import tempfile

from PIL import Image
from texture_build import files, PAGE_SIZE, ROOT


def export(fog_path, output):
    fog = files(fog_path.read_bytes(), 'fog')
    dlf = fog['DLF.RFF']
    start, end = struct.unpack_from('<II', dlf)
    if not 8 <= start < end <= len(dlf):
        raise ValueError('Invalid DLF.RFF model archive')
    model = files(dlf[start:end], 'hog')['GLOKSIL.GMD']
    with tempfile.TemporaryDirectory(prefix='syphon-weapon-') as folder:
        folder = Path(folder)
        model_path = folder / 'GLOKSIL.GMD'
        binary = folder / 'export_weapon'
        model_path.write_bytes(model)
        subprocess.run(['c++', '-std=c++20', '-O2', '-I', str(ROOT/'references/sf-pc-port/include'),
                        str(ROOT/'tools/export_weapon.cpp'),
                        str(ROOT/'references/sf-pc-port/src/assets/gmd_model.cpp'), '-o', str(binary)], check=True)
        data = subprocess.run([str(binary), str(model_path)], check=True, capture_output=True, text=True).stdout
    rows = [tuple(map(int, line.split())) for line in data.splitlines()]
    if len(rows) != 96 or any(len(row) != 8 or row[7] != 1 for row in rows):
        raise ValueError('Unexpected weapon model or texture format')
    bank = files(fog['VRAM.HOG'], 'hog')
    vlf = fog['VLF.RFF']
    mask = struct.unpack_from('<I', vlf)[0]
    cluts = vlf[mask.bit_count()*PAGE_SIZE:mask.bit_count()*PAGE_SIZE+16384]
    if len(cluts) != 16384:
        raise ValueError('Invalid level CLUT data')
    materials = sorted({(row[5], row[6]) for row in rows})
    if len(materials) != 4:
        raise ValueError('Unexpected weapon material count')
    width, height = 256, 512
    atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    placement = {}
    for n, (page, clut) in enumerate(materials):
        if mask & (1 << page):
            offset = (mask & ((1 << page) - 1)).bit_count() * PAGE_SIZE
            texture = vlf[offset:offset+PAGE_SIZE]
        else:
            texture = bank[f'TP{page:02}.BIN']
        if len(texture) != PAGE_SIZE or (clut & 63)*16 != 768 or not 480 <= clut >> 6 < 512:
            raise ValueError('Unsupported texture or palette')
        pal_start = (((clut >> 6)-480)*256)*2
        palette = struct.unpack_from('<256H', cluts, pal_start)
        rgba = [((c&31)*255//31, ((c>>5)&31)*255//31, ((c>>10)&31)*255//31,
                 0 if c == 0 else 255) for c in palette]
        tile = Image.new('RGBA', (128, 256))
        tile.putdata([rgba[v] for v in texture])
        x, y = (n%2)*128, (n//2)*256
        atlas.paste(tile, (x, y))
        placement[(page, clut)] = (x, y)
    positions, uvs = [], []
    for x, y, z, u, v, page, clut, _ in rows:
        # Native GMD is local to the right hand: +Y runs towards the muzzle.
        # Export grip near origin, muzzle along -Z, positive Y up.
        positions.extend((x/100, -z/100, -y/100))
        px, py = placement[(page, clut)]
        uvs.extend((round((px+min(u,127)+.5)/width, 7), round((py+v+.5)/height, 7)))
    stream = io.BytesIO()
    atlas.save(stream, format='PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')
    with output.open('x', encoding='utf8') as out:
        out.write('// GLOKSIL.GMD: original French PS1 handgun geometry and texture pages.\n')
        out.write('window.SF_WEAPON={positions:new Float32Array(')
        json.dump(positions, out, separators=(',', ':'))
        out.write('),uvs:new Float32Array(')
        json.dump(uvs, out, separators=(',', ':'))
        out.write('),atlas:')
        json.dump(uri, out)
        out.write(',triangleCount:32,grip:[0,0,0],muzzle:[0,0,-0.33]};\n')
    print(f'Exported {len(rows)//3} weapon triangles to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fog', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    export(args.fog, args.output)
