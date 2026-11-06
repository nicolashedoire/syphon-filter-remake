#!/usr/bin/env python3
"""List and explicitly extract files from a PlayStation ISO 9660 disc image.

Supported formats: 2048-byte ISO or CUE/BIN with a MODE1/2048, MODE1/2352,
or MODE2/2352 Form 1 data track. Audio tracks, CHD/PBP files, Form 2 sectors,
and multisession discs are not supported.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

SECTOR = 2048
MAX_DIRECTORY = 32 * 1024 * 1024
MAX_ENTRIES = 100_000


class ImageError(Exception):
    """Unsupported format or truncated image."""


@dataclass(frozen=True)
class Track:
    path: Path
    size: int
    offset: int
    start: int = 0
    mode2: bool = False


def read_cue(path: Path) -> Track:
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except UnicodeDecodeError:
        lines = path.read_text(encoding="cp1252").splitlines()
    current_file = None
    current_mode = None
    chosen = None
    for line in lines:
        line = line.strip()
        file_match = re.match(r'^FILE\s+(?:"([^"]+)"|(\S+))\s+BINARY\s*$', line, re.I)
        if file_match:
            current_file = path.parent / (file_match.group(1) or file_match.group(2))
            current_mode = None
            continue
        track_match = re.match(r'^TRACK\s+\d+\s+(\S+)', line, re.I)
        if track_match:
            mode = track_match.group(1).upper()
            current_mode = mode if mode in {"MODE1/2048", "MODE1/2352", "MODE2/2352"} else None
            continue
        index_match = re.match(r'^INDEX\s+01\s+(\d+):(\d+):(\d+)\s*$', line, re.I)
        if index_match and current_mode and current_file is not None:
            minutes, seconds, frames = map(int, index_match.groups())
            if seconds >= 60 or frames >= 75:
                raise ImageError("INDEX 01 invalide dans le fichier CUE")
            size, offset, mode2 = {"MODE1/2048": (2048, 0, False), "MODE1/2352": (2352, 16, False), "MODE2/2352": (2352, 24, True)}[current_mode]
            chosen = Track(current_file, size, offset, (minutes * 60 * 75 + seconds * 75 + frames) * size, mode2)
            break
    if chosen is None:
        raise ImageError("Aucune piste de données prise en charge avec INDEX 01 dans le CUE")
    if not chosen.path.is_file():
        raise ImageError(f"Fichier BIN introuvable : {chosen.path}")
    return chosen


class Disc:
    def __init__(self, track: Track):
        self.track = track
        self.file = track.path.open("rb")
        self.length = track.path.stat().st_size

    def close(self):
        self.file.close()

    def sector(self, lba: int) -> bytes:
        if lba < 0:
            raise ImageError("Adresse de secteur négative")
        pos = self.track.start + lba * self.track.size
        if pos + self.track.size > self.length:
            raise ImageError(f"Image tronquée au secteur {lba}")
        self.file.seek(pos)
        raw = self.file.read(self.track.size)
        if len(raw) != self.track.size:
            raise ImageError(f"Lecture incomplète du secteur {lba}")
        if self.track.size == 2352:
            if raw[:12] != b'\x00' + b'\xff' * 10 + b'\x00':
                raise ImageError(f"Synchronisation invalide au secteur {lba}")
            if self.track.mode2:
                if raw[15] != 2 or raw[18] & 0x20:
                    raise ImageError(f"Secteur {lba} différent de Mode 2 Form 1")
            elif raw[15] != 1:
                raise ImageError(f"Secteur {lba} différent de Mode 1")
        return raw[self.track.offset:self.track.offset + SECTOR]

    def extent(self, lba: int, size: int) -> bytes:
        if size < 0 or size > MAX_DIRECTORY:
            raise ImageError("Répertoire ou SYSTEM.CNF trop volumineux")
        return b''.join(self.sector(lba + i) for i in range((size + SECTOR - 1) // SECTOR))[:size]


def parse_record(data: bytes, offset: int):
    length = data[offset]
    if length < 34 or offset + length > len(data):
        raise ImageError("Enregistrement ISO 9660 invalide")
    record = data[offset:offset + length]
    name_len = record[32]
    if 33 + name_len > length:
        raise ImageError("Nom ISO 9660 tronqué")
    lba = struct.unpack_from('<I', record, 2)[0]
    size = struct.unpack_from('<I', record, 10)[0]
    flags = record[25]
    name = record[33:33 + name_len]
    return lba, size, flags, name


def inspect(path: Path, extraction: tuple[str, Path] | None = None) -> dict:
    path = Path(path)
    if path.suffix.lower() == '.cue':
        track = read_cue(path)
    elif path.suffix.lower() == '.iso':
        track = Track(path, 2048, 0)
    else:
        raise ImageError("Choisissez un fichier .cue ou .iso (pas un BIN seul)")
    disc = Disc(track)
    try:
        pvd = disc.sector(16)
        if pvd[0] != 1 or pvd[1:6] != b'CD001' or pvd[6] != 1:
            raise ImageError("Descripteur primaire ISO 9660 introuvable")
        if struct.unpack_from('<H', pvd, 128)[0] != SECTOR:
            raise ImageError("Taille de bloc ISO différente de 2048 octets")
        root_lba, root_size, root_flags, _ = parse_record(pvd, 156)
        if not root_flags & 2:
            raise ImageError("La racine ISO n'est pas un répertoire")
        pending = [("", root_lba, root_size)]
        visited = set()
        files = []
        file_extents = {}
        system_cnf = None
        while pending:
            prefix, lba, size = pending.pop()
            if (lba, size) in visited:
                continue
            visited.add((lba, size))
            data = disc.extent(lba, size)
            offset = 0
            while offset < len(data):
                length = data[offset]
                if length == 0:
                    offset = ((offset // SECTOR) + 1) * SECTOR
                    continue
                if offset // SECTOR != (offset + length - 1) // SECTOR:
                    raise ImageError("Enregistrement de répertoire à cheval sur deux secteurs")
                entry_lba, entry_size, flags, raw_name = parse_record(data, offset)
                offset += length
                if raw_name in (b'\x00', b'\x01'):
                    continue
                name = raw_name.decode('ascii', errors='replace')
                name = re.sub(r';\d+$', '', name).rstrip('.')
                item_path = f'{prefix}/{name}'
                if flags & 0x80:
                    raise ImageError(f"Fichier multi-extent non pris en charge : {item_path}")
                if flags & 2:
                    pending.append((item_path, entry_lba, entry_size))
                else:
                    files.append({"chemin": item_path, "octets": entry_size})
                    file_extents[item_path.upper()] = (entry_lba, entry_size)
                    if item_path.upper() == '/SYSTEM.CNF':
                        system_cnf = disc.extent(entry_lba, entry_size).decode('ascii', errors='replace')
                if len(files) + len(pending) > MAX_ENTRIES:
                    raise ImageError("Trop d'entrées dans l'image")
        executable = None
        serial = None
        if system_cnf:
            boot = re.search(r'^\s*BOOT\s*=\s*cdrom\s*:\s*([^\r\n]+)', system_cnf, re.I | re.M)
            if boot:
                executable = boot.group(1).strip().replace('\\', '/').lstrip('/')
                serial_match = re.search(r'(SCES|SLES|SCUS|SLUS|SCPS|SLPS)[_\-]?(\d{3})[.\-_]?(\d{2})', executable, re.I)
                if serial_match:
                    serial = f'{serial_match.group(1).upper()}-{serial_match.group(2)}{serial_match.group(3)}'
        files.sort(key=lambda x: x['chemin'])
        if extraction is not None:
            source, destination = extraction
            source = '/' + source.replace('\\', '/').lstrip('/')
            source = re.sub(r';\d+$', '', source).upper()
            if source not in file_extents:
                raise ImageError(f"Fichier introuvable dans l'image : {source}")
            entry_lba, entry_size = file_extents[source]
            # Exclusive creation: never overwrite an existing file.
            # On a read error, remove only the file created here.
            created = False
            try:
                with Path(destination).open('xb') as output:
                    created = True
                    remaining = entry_size
                    sector_index = 0
                    while remaining:
                        block = disc.sector(entry_lba + sector_index)
                        n = min(SECTOR, remaining)
                        output.write(block[:n])
                        remaining -= n
                        sector_index += 1
            except Exception:
                if created:
                    Path(destination).unlink(missing_ok=True)
                raise
        return {"image": str(path), "piste": str(track.path), "format_secteur": track.size,
                "titre_volume": pvd[40:72].decode('ascii', errors='replace').strip(),
                "system_cnf": system_cnf, "executable": executable, "numero": serial,
                "edition_francaise_sces_01911": serial == 'SCES-01911', "fichiers": files}
    finally:
        disc.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Inspect a local PS1 disc image and explicitly extract a file.")
    parser.add_argument('image', type=Path, help="CUE image with its BIN, or a 2048-byte ISO image")
    parser.add_argument('--json', action='store_true', help="Display the result as JSON")
    parser.add_argument('--extraire', metavar='ISO_PATH', help="ISO file to extract, for example /SUBWAY.FOG")
    parser.add_argument('--vers', type=Path, metavar='DESTINATION', help="Local file to create; never overwrites an existing file")
    args = parser.parse_args(argv)
    if bool(args.extraire) != bool(args.vers):
        parser.error("--extraire et --vers doivent être utilisés ensemble")
    try:
        result = inspect(args.image, (args.extraire, args.vers) if args.extraire else None)
    except (ImageError, OSError) as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if args.extraire:
            print(f"Fichier extrait : {args.vers}")
        print(f"Volume : {result['titre_volume']}\nExécutable : {result['executable'] or 'non identifié'}\nNuméro : {result['numero'] or 'non identifié'}")
        print("Édition française SCES-01911 : " + ("oui" if result['edition_francaise_sces_01911'] else "non identifiée"))
        print(f"Fichiers ({len(result['fichiers'])}) :")
        for item in result['fichiers']:
            print(f"{item['octets']:>12}  {item['chemin']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
