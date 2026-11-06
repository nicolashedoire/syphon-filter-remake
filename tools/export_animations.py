#!/usr/bin/env python3
"""Bake original French PS1 HMD animation poses for the offline HTML game.

The French release embeds the character animation HOG in SCES_019.11 rather
than exposing it as a separate file. Root motion is deliberately omitted:
the browser gameplay owns actor movement. HMD parsers are from SF-pc-port (MIT).
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
REQUIRED = {'ST0.LWR', 'ST02.UPR', 'WK0.LWR', 'WK0.UPR', 'RN0.LWR', 'RN0.UPR'}


def find_animation_hog(exe: bytes) -> tuple[bytes, list]:
    """Find the embedded HOG by its animation names and validated directory."""
    candidates = []
    for offset in range(0, len(exe) - 20, 4):
        _, count, table, names, payload = struct.unpack_from('<IIIII', exe, offset)
        if table != 20 or not 10 < count < 1000 or names != 20 + count * 4:
            continue
        if not (names < payload < 100000 and offset + payload < len(exe)):
            continue
        names_data = exe[offset + names:offset + payload]
        if not all(name.encode() + b'\0' in names_data for name in REQUIRED):
            continue
        data = exe[offset:]
        try:
            entries = archives.parse_hog(data)
        except archives.ArchiveError:
            continue
        if REQUIRED <= {entry.name for entry in entries}:
            candidates.append((data, entries))
    if len(candidates) != 1:
        raise ValueError(f'Expected one embedded animation HOG, found {len(candidates)}')
    return candidates[0]


def export(image: Path, output: Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required.')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-anim-') as directory:
        tmp = Path(directory)
        executable = tmp / 'export_anim'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/export_hmd_animation.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_model.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/hmd_animation.cpp'),
                        '-o', str(executable)], check=True, capture_output=True, text=True)
        info = disc.inspect(image)
        if info['numero'] != 'SCES-01911':
            raise ValueError('This exporter currently supports French SCES-01911 only.')
        fog_file, game_exe = tmp / 'SUBWAY.FOG', tmp / 'GAME.EXE'
        disc.inspect(image, ('/FOG/SUBWAY.FOG', fog_file))
        executable_name = '/' + info['executable'].split(';')[0].lstrip('/')
        disc.inspect(image, (executable_name, game_exe))
        fog = fog_file.read_bytes()
        dlf_file = tmp / 'DLF.RFF'
        archives.extract(fog, archives.parse_fog(fog), 'DLF.RFF', dlf_file)
        dlf = dlf_file.read_bytes()
        if len(dlf) < 8:
            raise ValueError('Invalid DLF.RFF header')
        start, end = struct.unpack_from('<II', dlf)
        if not (8 <= start < end <= len(dlf)):
            raise ValueError('Invalid DLF.RFF model archive range')
        hog = dlf[start:end]
        model_file = tmp / 'GABE.HMD'
        archives.extract(hog, archives.parse_hog(hog), 'GABE.HMD', model_file)
        animation_hog, entries = find_animation_hog(game_exe.read_bytes())
        for name in REQUIRED:
            archives.extract(animation_hog, entries, name, tmp / name)
        clips = {}
        for name, lower, upper, stride, fps in [
            ('idle', 'ST0.LWR', 'ST02.UPR', 4, 7.5),
            ('walk', 'WK0.LWR', 'WK0.UPR', 1, 30),
            ('run', 'RN0.LWR', 'RN0.UPR', 1, 30),
        ]:
            result = subprocess.run([str(executable), str(model_file), str(tmp / lower), str(tmp / upper), str(stride)],
                                    check=True, capture_output=True, text=True)
            clips[name] = (fps, json.loads(result.stdout)['frames'])
        with output.open('x', encoding='utf-8') as target:
            target.write('// Original French PS1 character animations; root motion omitted.\nwindow.SF_ANIMATIONS={gabe:{')
            for i, (name, (fps, frames)) in enumerate(clips.items()):
                if i:
                    target.write(',')
                target.write(name + ':{fps:' + str(fps) + ',frames:[')
                target.write(','.join('new Float32Array(' + json.dumps(frame, separators=(',', ':')) + ')' for frame in frames))
                target.write(']}')
            target.write('}};\n')
    print(f'Wrote {output}: ' + ', '.join(f'{name}={len(frames)} poses' for name, (_, frames) in clips.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French PS1 CUE/BIN image')
    parser.add_argument('output', type=Path, help='New output JavaScript file')
    args = parser.parse_args()
    export(args.image, args.output)


if __name__ == '__main__':
    main()
