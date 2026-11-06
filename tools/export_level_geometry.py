#!/usr/bin/env python3
"""Export one French-disc mission's original EMD world geometry as OBJ.

This is a geometry-only research tool: it does not export textures, actors,
collisions, scripts, objectives, audio, or a playable level. The existing CUE
and BIN are read without modification. The destination must not already exist.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import archives_syphon as archives
import inspecter_disque_ps1 as disc
from preparer_geometrie import fusionner

ROOT = Path(__file__).resolve().parent.parent
RESOURCE = re.compile(r'[A-Z0-9_]{1,8}\Z')
MODEL = re.compile(r'[A-Za-z0-9_-]+\.EMD\Z', re.IGNORECASE)


def validate_resource(value: str) -> str:
    value = value.upper()
    if not RESOURCE.fullmatch(value):
        raise ValueError('Resource must be a plain disc archive name of at most 8 characters')
    return value


def export_level(image: Path, resource: str, output: Path) -> dict:
    resource = validate_resource(resource)
    compiler = shutil.which('clang++') or shutil.which('c++')
    upstream = ROOT / 'references/sf-pc-port'
    if not compiler:
        raise RuntimeError('A C++20 compiler is required')
    if not (upstream / 'src/assets/emd_scene.cpp').is_file():
        raise RuntimeError('Initialize the sf-pc-port Git submodule first')
    info = disc.inspect(image)
    if not info['edition_francaise_sces_01911']:
        raise ValueError('Expected the French SCES-01911 disc')
    archive_path = f'/FOG/{resource}.FOG'
    if not any(item['chemin'].upper() == archive_path for item in info['fichiers']):
        raise ValueError(f'Mission archive not found on the disc: {archive_path}')
    # Exclusive creation avoids changing an existing destination.
    output.mkdir(parents=False, exist_ok=False)
    obj_dir = output / 'obj'
    obj_dir.mkdir()
    with tempfile.TemporaryDirectory(prefix='syphon-level-') as temp:
        tmp = Path(temp)
        binary = tmp / 'exporter-emd'
        subprocess.run([compiler, '-std=c++20', '-O2', '-I', str(upstream / 'include'),
                        str(ROOT / 'tools/exporter_emd_obj.cpp'),
                        str(upstream / 'src/assets/emd_scene.cpp'), '-o', str(binary)],
                       check=True, capture_output=True, text=True)
        fog = tmp / 'mission.fog'
        disc.inspect(image, (archive_path, fog))
        data = fog.read_bytes()
        entries = archives.parse_fog(data)
        hog = tmp / 'world.hog'
        archives.extract(data, entries, 'WLDEMD.HOG', hog)
        world = hog.read_bytes()
        models = [item for item in archives.parse_hog(world) if item.name.upper().endswith('.EMD')]
        if not models or any(not MODEL.fullmatch(item.name) for item in models):
            raise ValueError('The archive contains no usable EMD models')
        objects = []
        for index, model in enumerate(models):
            emd = tmp / f'{index:04}.emd'
            archives.extract(world, models, model.name, emd)
            obj = obj_dir / f'{Path(model.name).stem}.obj'
            subprocess.run([str(binary), str(emd), str(obj)], check=True,
                           capture_output=True, text=True)
            objects.append(obj)
        vertices, triangles = fusionner(objects, output / f'{resource.lower()}.obj')
    result = {'disc': 'SCES-01911', 'archive': archive_path, 'world': 'WLDEMD.HOG',
              'model_count': len(models), 'vertices': vertices, 'triangles': triangles,
              'scope': 'geometry only; no playable mission'}
    with (output / 'inventory.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path, help='French SCES-01911 CUE/BIN pair')
    parser.add_argument('resource', help='Mission resource name, e.g. SUBWAY2')
    parser.add_argument('output', type=Path, help='New output directory')
    args = parser.parse_args()
    try:
        result = export_level(args.image, args.resource, args.output)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError, disc.ImageError) as error:
        parser.exit(1, f'Export failed: {error}\n')
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
