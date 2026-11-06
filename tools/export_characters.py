#!/usr/bin/env python3
"""Extract the first mission's HMD characters as an offline browser script.

The generated asset comes from the supplied game disc. The HMD parser belongs
 to the SF-pc-port contributors and is distributed under its MIT license.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

import archives_syphon as archives
import inspecter_disque_ps1 as disc

ROOT = Path(__file__).resolve().parent.parent


def make_script(characters: dict) -> str:
    objects = []
    for name, data in characters.items():
        fields = []
        for field, constructor in [('positions', 'Float32Array'), ('parts', 'Uint8Array'),
                                   ('uvs', 'Uint8Array'), ('cluts', 'Uint16Array'),
                                   ('tpages', 'Uint16Array')]:
            fields.append(field + ':new ' + constructor + '(' + json.dumps(data[field], separators=(',', ':')) + ')')
        fields.append('partNames:' + json.dumps(data['partNames'], separators=(',', ':')))
        objects.append(name + ':{' + ','.join(fields) + '}')
    return '// Original French PS1 HMD character geometry; decoded from the supplied disc.\nwindow.SF_CHARACTERS={' + ','.join(objects) + '};\n'


def export(image: Path, output: Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required.')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-hmd-') as name:
        tmp = Path(name)
        executable = tmp / 'export_hmd'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/export_hmd.cpp'), str(ROOT / 'references/sf-pc-port/src/assets/hmd_model.cpp'),
                        '-o', str(executable)], check=True, capture_output=True, text=True)
        fog_file = tmp / 'SUBWAY.FOG'
        disc.inspect(image, ('/FOG/SUBWAY.FOG', fog_file))
        fog = fog_file.read_bytes()
        dlf_path = tmp / 'DLF.RFF'
        archives.extract(fog, archives.parse_fog(fog), 'DLF.RFF', dlf_path)
        dlf = dlf_path.read_bytes()
        if len(dlf) < 8:
            raise ValueError('DLF.RFF header is incomplete.')
        start, end = struct.unpack_from('<II', dlf)
        if not (8 <= start < end <= len(dlf)):
            raise ValueError('DLF.RFF model archive range is invalid.')
        hog = dlf[start:end]
        entries = archives.parse_hog(hog)
        characters = {}
        for var_name, model_name in [('gabe', 'GABE.HMD'), ('terro', 'TERRO.HMD')]:
            path = tmp / model_name
            archives.extract(hog, entries, model_name, path)
            result = subprocess.run([str(executable), str(path)], check=True, capture_output=True, text=True)
            characters[var_name] = json.loads(result.stdout)
        with output.open('x', encoding='utf-8') as result:
            result.write(make_script(characters))
    print(f'Wrote {output}. Geometry only; original textures and animation are not included.')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='PS1 CUE or ISO image')
    parser.add_argument('output', type=Path, help='New JavaScript file to create')
    args = parser.parse_args()
    export(args.image, args.output)


if __name__ == '__main__':
    main()
