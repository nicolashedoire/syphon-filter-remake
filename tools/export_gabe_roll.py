#!/usr/bin/env python3
"""Export French PS1 STROL0.HAN as grounded Gabe poses for the browser.

This keeps the original animation while the browser handles movement and
collision. The original engine's root motion is not reconstructed.
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
from export_animations import ROOT, find_animation_hog


def export(image: Path, output: Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-gabe-roll-') as directory:
        tmp = Path(directory)
        binary = tmp / 'export_anim'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/export_hmd_animation.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_model.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_animation.cpp'),
                        '-o', str(binary)], check=True, capture_output=True, text=True)
        info = disc.inspect(image)
        if info['numero'] != 'SCES-01911':
            raise ValueError('This exporter requires the French SCES-01911 release')
        fog_file, exe_file = tmp / 'SUBWAY.FOG', tmp / 'GAME.EXE'
        disc.inspect(image, ('/FOG/SUBWAY.FOG', fog_file))
        disc.inspect(image, ('/' + info['executable'].split(';')[0].lstrip('/'), exe_file))
        fog = fog_file.read_bytes()
        dlf_file = tmp / 'DLF.RFF'
        archives.extract(fog, archives.parse_fog(fog), 'DLF.RFF', dlf_file)
        dlf = dlf_file.read_bytes()
        start, end = struct.unpack_from('<II', dlf)
        if not (8 <= start < end <= len(dlf)):
            raise ValueError('Invalid DLF.RFF model archive')
        models = dlf[start:end]
        model_file = tmp / 'GABE.HMD'
        archives.extract(models, archives.parse_hog(models), 'GABE.HMD', model_file)
        animation_hog, entries = find_animation_hog(exe_file.read_bytes())
        clip = tmp / 'STROL0.HAN'
        archives.extract(animation_hog, entries, 'STROL0.HAN', clip)
        result = subprocess.run([str(binary), str(model_file), str(clip), str(clip), '1'],
                                check=True, capture_output=True, text=True)
        frames = json.loads(result.stdout)['frames']
        if not frames:
            raise ValueError('Gabe roll animation has no frames')
        with output.open('x', encoding='utf-8') as target:
            target.write('// French PS1 STROL0.HAN baked on GABE.HMD; poses grounded per frame.\n')
            target.write('window.SF_GABE_ROLL={fps:30,frames:[')
            target.write(','.join('new Float32Array(' + json.dumps(frame, separators=(',', ':')) + ')' for frame in frames))
            target.write(']};\n')
        print(f'Wrote {output}: {len(frames)} Gabe roll poses')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French PS1 CUE/BIN image')
    parser.add_argument('output', type=Path, help='New output JavaScript file')
    args = parser.parse_args()
    export(args.image, args.output)


if __name__ == '__main__':
    main()
