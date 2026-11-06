#!/usr/bin/env python3
"""Export SUBWAY2 terrain, UVs, textures and visibility from the French disc.

Requires Pillow, a C++20 compiler and the initialized sf-pc-port submodule.
The generated data is not a playable mission: objects, actors and mission
logic are not included. The CUE/BIN is opened read-only.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

from PIL import Image
import inspecter_disque_ps1 as disc
from texture_build import files, PAGE_SIZE

ROOT = Path(__file__).resolve().parent.parent


def export(image: Path, output: Path) -> dict:
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required')
    if not (ROOT / 'references/sf-pc-port/src/assets/emd_scene.cpp').is_file():
        raise RuntimeError('Initialize the sf-pc-port submodule')
    info = disc.inspect(image)
    if not info['edition_francaise_sces_01911']:
        raise ValueError('Expected the French SCES-01911 disc')
    with tempfile.TemporaryDirectory(prefix='syphon-subway2-web-') as name:
        temp = Path(name)
        archive = temp / 'SUBWAY2.FOG'
        disc.inspect(image, ('/FOG/SUBWAY2.FOG', archive))
        fog = files(archive.read_bytes(), 'fog')
        models = files(fog['WLDEMD.HOG'], 'hog')
        bank = files(fog['VRAM.HOG'], 'hog')
        vlf = fog['VLF.RFF']
        mask = struct.unpack_from('<I', vlf)[0]
        cluts = vlf[mask.bit_count()*PAGE_SIZE:mask.bit_count()*PAGE_SIZE+16384]
        if len(cluts) != 16384:
            raise ValueError('Unexpected palette data size')
        binary = temp / 'texture-dump'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT/'references/sf-pc-port/include'),
                        str(ROOT/'tools/texture_dump_emd.cpp'),
                        str(ROOT/'references/sf-pc-port/src/assets/emd_scene.cpp'), '-o', str(binary)],
                       check=True, capture_output=True, text=True)
        model = temp / 'model.emd'
        rows, rooms = [], []
        for model_name, raw in models.items():
            if not model_name.endswith('.EMD'):
                continue
            model.write_bytes(raw)
            text = subprocess.run([str(binary), str(model), str(mask)], check=True,
                                  capture_output=True, text=True).stdout
            model_rows = [tuple(map(int, line.split())) for line in text.splitlines()]
            coords = [(r[0]/100, -r[1]/100, r[2]/100) for r in model_rows]
            minimum = [min((c[i] for c in coords), default=0) for i in range(3)]
            maximum = [max((c[i] for c in coords), default=0) for i in range(3)]
            rooms.append({'start': len(rows), 'count': len(model_rows), 'name': model_name,
                          'min': minimum, 'max': maximum})
            rows.extend(model_rows)
        materials = sorted({(r[5], r[6], r[7], r[8] >> 7) for r in rows})
        if not materials or len(materials) > 64 or any(bank_id != 0 or mode != 1 for _, bank_id, _, mode in materials):
            raise ValueError('Unexpected SUBWAY2 texture mode or bank')
        width, height = 1024, 2048
        atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        placement = {}
        for index, (page, bank_id, clut, mode) in enumerate(materials):
            if mask & (1 << page):
                previous = (mask & ((1 << page) - 1)).bit_count()
                texture = vlf[previous*PAGE_SIZE:(previous+1)*PAGE_SIZE]
            else:
                texture = bank[f'TP{page:02}.BIN']
            clut_x, clut_y = (clut & 63)*16, clut >> 6
            if len(texture) != PAGE_SIZE or clut_x != 768 or not 480 <= clut_y < 512:
                raise ValueError('Unsupported texture page or CLUT')
            start = ((clut_y-480)*256 + clut_x-768)*2
            palette = struct.unpack_from('<256H', cluts, start)
            rgba = [((c&31)*255//31, ((c>>5)&31)*255//31, ((c>>10)&31)*255//31,
                     0 if c == 0 else 255) for c in palette]
            tile = Image.new('RGBA', (128, 256))
            tile.putdata([rgba[value] for value in texture])
            x, y = (index % 8)*128, (index // 8)*256
            atlas.paste(tile, (x, y))
            placement[(page, bank_id, clut, mode)] = (x, y)
        png = io.BytesIO()
        atlas.save(png, format='PNG', optimize=True)
        positions, uvs = [], []
        for x, y, z, u, v, page, bank_id, clut, tpage in rows:
            positions.extend((x/100, -y/100, z/100))
            px, py = placement[(page, bank_id, clut, tpage >> 7)]
            uvs.extend(((px+min(u,127)+.5)/width, (py+min(v,255)+.5)/height))
        layout = fog['SUBWAY2.DAT']
        count, initial = struct.unpack_from('<II', layout, 0x88)
        if count != len(rooms) or initial >= count or len(layout) < 0x90+count*15:
            raise ValueError('Invalid mission visibility layout')
        visibility = []
        for i in range(count):
            visible = []
            for value in layout[0x90+i*15:0x90+(i+1)*15]:
                if value in (0xfe, 0xff):
                    break
                if value >= count:
                    raise ValueError('Invalid visibility entry')
                visible.append(value)
            visibility.append(visible)
        material_map = {f'{page}:{bank_id}:{clut}':[x, y]
                        for (page, bank_id, clut, _), (x, y) in placement.items()}
        with output.open('x', encoding='utf-8') as stream:
            stream.write('// French PS1 SUBWAY2 terrain only; not a playable mission.\nwindow.SF_SUBWAY2_TERRAIN={positions:new Float32Array(')
            json.dump(positions, stream, separators=(',', ':'))
            stream.write('),uvs:new Float32Array(')
            json.dump(uvs, stream, separators=(',', ':'))
            stream.write('),atlas:')
            json.dump('data:image/png;base64,'+base64.b64encode(png.getvalue()).decode('ascii'), stream)
            for key, value in [('rooms', rooms), ('visibility', visibility), ('initialRoom', initial),
                               ('initialRooms', [initial]+visibility[initial]), ('materials', material_map)]:
                stream.write(','+key+':')
                json.dump(value, stream, separators=(',', ':'))
            stream.write('};\n')
    return {'triangles': len(rows)//3, 'rooms': len(rooms), 'materials': len(materials),
            'initialRoom': initial, 'output': str(output)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French SCES-01911 CUE/BIN pair')
    parser.add_argument('output', type=Path, help='New JavaScript output file')
    args = parser.parse_args()
    try:
        print(json.dumps(export(args.image, args.output), indent=2))
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.CalledProcessError, disc.ImageError) as error:
        parser.exit(1, f'Export failed: {error}\n')


if __name__ == '__main__':
    main()
