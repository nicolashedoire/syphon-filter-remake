#!/usr/bin/env python3
"""Export the French PS1 opening movies and first briefing for the HTML game.

Requires ffmpeg with psxstr, MDEC, XA, H.264 and AAC support. The source disc is
never modified. Output files must not exist already. The briefing strings are
read from the French disc's DLF.RFF in Windows-1252, not machine translated.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import archives_syphon as archives
import inspecter_disque_ps1 as iso

MOVIES = {'/SOL/INTRO.STR': 'intro-general.mp4', '/SOL/SUBWAY.STR': 'intro-georgia.mp4'}


def find_extents(disc: iso.Disc) -> dict[str, tuple[int, int]]:
    pvd = disc.sector(16)
    if pvd[0] != 1 or pvd[1:6] != b'CD001':
        raise ValueError('The disc has no ISO 9660 primary volume descriptor')
    root = iso.parse_record(pvd, 156)
    pending = [('', root[0], root[1])]
    visited = set()
    files = {}
    while pending:
        prefix, lba, size = pending.pop()
        if (lba, size) in visited:
            continue
        visited.add((lba, size))
        data = disc.extent(lba, size)
        cursor = 0
        while cursor < len(data):
            if data[cursor] == 0:
                cursor = (cursor // iso.SECTOR + 1) * iso.SECTOR
                continue
            entry_lba, entry_size, flags, name = iso.parse_record(data, cursor)
            cursor += data[cursor]
            if name in (b'\x00', b'\x01'):
                continue
            name = re.sub(r';\d+$', '', name.decode('ascii')).rstrip('.')
            path = (prefix + '/' + name).upper()
            if flags & 0x80:
                raise ValueError('Multi-extent files are not supported')
            if flags & 2:
                pending.append((path, entry_lba, entry_size))
            else:
                files[path] = (entry_lba, entry_size)
    return files


def extract_raw_movie(disc: iso.Disc, entry: tuple[int, int], out: Path) -> None:
    if disc.track.size != 2352 or not disc.track.mode2:
        raise ValueError('Movies require a raw MODE2/2352 BIN/CUE track')
    lba, size = entry
    count = (size + 2047) // 2048
    disc.file.seek(disc.track.start + lba * 2352)
    with out.open('xb') as target:
        for index in range(count):
            sector = disc.file.read(2352)
            if len(sector) != 2352 or sector[:12] != b'\0' + b'\xff' * 10 + b'\0' or sector[15] != 2:
                raise ValueError(f'Invalid or truncated raw video sector {lba + index}')
            target.write(sector)


def extract_briefing(fog_path: Path) -> dict:
    data = fog_path.read_bytes()
    entries = archives.parse_fog(data)
    entry = next((item for item in entries if item.name.upper() == 'DLF.RFF'), None)
    if not entry:
        raise ValueError('The Georgia Street archive has no DLF.RFF')
    dlf = data[entry.offset:entry.offset + entry.size]
    start = struct.unpack_from('<I', dlf, 20)[0] + 20
    if start >= len(dlf):
        raise ValueError('The briefing data offset is invalid')
    parts = [item.decode('cp1252', errors='replace').strip()
             for item in dlf[start:].split(b'\0') if item]
    if len(parts) < 12 or parts[3] != 'Georgia Street' or parts[4] != 'Washington DC':
        raise ValueError('The expected French Georgia Street briefing was not found')
    return {'mission': parts[3], 'location': parts[4], 'datetime': parts[2],
            'directives': [parts[1], parts[0]], 'objectives': parts[6:10],
            'parameters': parts[10:12]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cue', type=Path, help='French SCES-01911 BIN/CUE image')
    parser.add_argument('destination', type=Path, help='Existing directory for generated browser assets')
    args = parser.parse_args()
    try:
        if not shutil.which('ffmpeg'):
            raise RuntimeError('ffmpeg was not found')
        if not args.destination.is_dir():
            raise ValueError('The output directory must already exist')
        targets = [args.destination / n for n in (*MOVIES.values(), 'intro-briefing.js')]
        if any(path.exists() for path in targets):
            raise FileExistsError('At least one output file already exists')
        info = iso.inspect(args.cue)
        if not info['edition_francaise_sces_01911']:
            raise ValueError('Expected the original French SCES-01911 disc')
        with tempfile.TemporaryDirectory(prefix='syphon-intro-') as tmp:
            root = Path(tmp)
            fog = root / 'SUBWAY.FOG'
            iso.inspect(args.cue, ('/FOG/SUBWAY.FOG', fog))
            briefing = extract_briefing(fog)
            disc = iso.Disc(iso.read_cue(args.cue))
            try:
                extents = find_extents(disc)
                for source, name in MOVIES.items():
                    if source not in extents:
                        raise ValueError(f'Movie not found: {source}')
                    raw = root / (name + '.str')
                    extract_raw_movie(disc, extents[source], raw)
                    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-n', '-i', str(raw),
                                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                                    '-c:a', 'aac', '-ar', '44100', '-b:a', '160k', '-movflags', '+faststart',
                                    str(args.destination / name)], check=True)
                    print(f'Exported {source} to {args.destination / name}')
            finally:
                disc.close()
            target = args.destination / 'intro-briefing.js'
            with target.open('x', encoding='utf-8') as file:
                file.write('// French mission briefing extracted from the original PS1 disc.\nwindow.SF_BRIEFING = ')
                json.dump(briefing, file, ensure_ascii=False, indent=2)
                file.write(';\n')
            print(f'Exported French briefing to {target}')
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError, iso.ImageError, archives.ArchiveError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
