#!/usr/bin/env python3
"""Export selected French-disc Georgia Street actors and their authored routes."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import archives_syphon as archives
import inspecter_disque_ps1 as disc

ROOT = Path(__file__).resolve().parent.parent

def export(image: Path, output: Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler:
        raise RuntimeError('A C++20 compiler is required.')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-actors-') as name:
        tmp = Path(name)
        executable = tmp / 'export_mission_actors'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/export_mission_actors.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/mission_objects.cpp'),
                        '-o', str(executable)], check=True, capture_output=True, text=True)
        fog_file = tmp / 'SUBWAY.FOG'
        disc.inspect(image, ('/FOG/SUBWAY.FOG', fog_file))
        fog = fog_file.read_bytes()
        binary = tmp / 'SUBWAY.BIN'
        archives.extract(fog, archives.parse_fog(fog), 'SUBWAY.BIN', binary)
        result = subprocess.run([str(executable), str(binary)], check=True, capture_output=True, text=True)
        actors = json.loads(result.stdout)
        script = '// Selected actor records from the French PS1 SUBWAY.BIN; native integer coordinates.\n'
        script += 'window.SF_OPENING_ACTORS=' + json.dumps(actors, separators=(',', ':')) + ';\n'
        with output.open('x', encoding='utf-8') as out:
            out.write(script)
    print(f'Wrote {output}: {len(actors)} authored actor records.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French PS1 CUE or ISO image')
    parser.add_argument('output', type=Path, help='New JavaScript file to create')
    args = parser.parse_args()
    export(args.image, args.output)
