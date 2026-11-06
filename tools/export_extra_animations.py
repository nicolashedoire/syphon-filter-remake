#!/usr/bin/env python3
"""Bake French PS1 sidearm and terrorist HMD poses for the browser prototype.

Uses the community SF-pc-port parsers and the same bind/pose conversion as
export_animations.py. Animation root motion is intentionally handled by the
gameplay code; these frames describe local character poses only.
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


CLIPS = {
    'gabe': [('aim', 'ST0.LWR', 'ST1AIM.UPR', 4, 7.5),
             ('reload', 'ST0.LWR', 'STRLD1B.UPR', 4, 7.5)],
    'terro': [('idle', 'ST0.LWR', 'ST02.UPR', 8, 3.75),
              ('walk', 'WK0.LWR', 'WK0.UPR', 1, 30),
              ('run', 'RN0.LWR', 'RN0.UPR', 1, 30)],
}


def export(image: Path, output: Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required.')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-extra-anim-') as directory:
        tmp = Path(directory)
        binary = tmp / 'export_anim'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/export_hmd_animation.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_model.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_animation.cpp'),
                        '-o', str(binary)], check=True, capture_output=True, text=True)
        info = disc.inspect(image)
        if info['numero'] != 'SCES-01911':
            raise ValueError('This exporter currently supports French SCES-01911 only.')
        fog_file, game_exe = tmp / 'SUBWAY.FOG', tmp / 'GAME.EXE'
        disc.inspect(image, ('/FOG/SUBWAY.FOG', fog_file))
        disc.inspect(image, ('/' + info['executable'].split(';')[0].lstrip('/'), game_exe))
        fog = fog_file.read_bytes()
        dlf_file = tmp / 'DLF.RFF'
        archives.extract(fog, archives.parse_fog(fog), 'DLF.RFF', dlf_file)
        dlf = dlf_file.read_bytes()
        start, end = struct.unpack_from('<II', dlf)
        if not (8 <= start < end <= len(dlf)):
            raise ValueError('Invalid DLF.RFF model archive range')
        models = dlf[start:end]
        model_entries = archives.parse_hog(models)
        animation_hog, entries = find_animation_hog(game_exe.read_bytes())
        available = {entry.name for entry in entries}
        names = {item for clips in CLIPS.values() for _, lower, upper, _, _ in clips for item in (lower, upper)}
        if not names <= available:
            raise ValueError('Required animation clips missing: ' + ', '.join(sorted(names - available)))
        for name in names:
            archives.extract(animation_hog, entries, name, tmp / name)
        exported = {}
        for character, clips in CLIPS.items():
            model_file = tmp / (character.upper() + '.HMD')
            archives.extract(models, model_entries, model_file.name, model_file)
            exported[character] = {}
            for name, lower, upper, stride, fps in clips:
                result = subprocess.run([str(binary), str(model_file), str(tmp / lower), str(tmp / upper), str(stride)],
                                        check=True, capture_output=True, text=True)
                exported[character][name] = (fps, json.loads(result.stdout)['frames'])
        with output.open('x', encoding='utf-8') as target:
            target.write('// French PS1 sidearm and terrorist animations; root motion omitted.\nwindow.SF_EXTRA_ANIMATIONS={')
            for i, (character, clips) in enumerate(exported.items()):
                if i:
                    target.write(',')
                target.write(character + ':{')
                for j, (name, (fps, frames)) in enumerate(clips.items()):
                    if j:
                        target.write(',')
                    target.write(name + ':{fps:' + str(fps) + ',frames:[')
                    target.write(','.join('new Float32Array(' + json.dumps(frame, separators=(',', ':')) + ')' for frame in frames))
                    target.write(']}')
                target.write('}')
            target.write('};\n')
    print(f'Wrote {output}: ' + ', '.join(f'{character}.{name}={len(frames)} poses'
          for character, clips in exported.items() for name, (_, frames) in clips.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French PS1 CUE/BIN image')
    parser.add_argument('output', type=Path, help='New output JavaScript file')
    args = parser.parse_args()
    export(args.image, args.output)


if __name__ == '__main__':
    main()
