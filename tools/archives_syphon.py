#!/usr/bin/env python3
"""Inventorier ou extraire un fichier d'une archive locale FOG/HOG de Syphon Filter.

Adapté des descriptions et vérifications des parseurs de SF-pc-port,
https://github.com/Madxbio97/SF-pc-port (licence MIT, voir son fichier LICENSE).
Les fichiers produits restent sur votre machine ; aucune donnée du jeu n'est incluse.
Prend en charge le format FOG à secteurs de 2048 octets et HOG v1 du premier jeu.
La taille de la dernière entrée HOG inclut l'éventuel remplissage de fin d'archive.
"""
from __future__ import annotations

import argparse
import struct
import sys
from dataclasses import dataclass
from pathlib import Path


class ArchiveError(ValueError):
    pass


@dataclass(frozen=True)
class Entry:
    name: str
    offset: int
    size: int


def read32(data: bytes, offset: int) -> int:
    if offset < 0 or offset + 4 > len(data):
        raise ArchiveError("Entier tronqué dans l'archive")
    return struct.unpack_from('<I', data, offset)[0]


def name_ascii(raw: bytes) -> str:
    try:
        name = raw.decode('ascii')
    except UnicodeDecodeError as exc:
        raise ArchiveError("Nom non ASCII") from exc
    if not name or any(ord(c) < 0x20 or ord(c) > 0x7e for c in name):
        raise ArchiveError("Nom de fichier invalide")
    # Les noms restent des étiquettes et ne sont jamais interprétés comme chemins.
    return name


def parse_fog(data: bytes) -> list[Entry]:
    sector = 2048
    if len(data) < sector:
        raise ArchiveError("En-tête FOG tronqué")
    declared = read32(data, 4)
    available = len(data) // sector
    if read32(data, 8) or read32(data, 12):
        raise ArchiveError("Champs réservés FOG invalides")
    truncated_tail = declared == available + 1
    if declared <= 1 or (declared > available and not truncated_tail):
        raise ArchiveError("Taille déclarée FOG invalide")
    entries: list[Entry] = []
    names: set[str] = set()
    maximum_end = 1
    for pos in range(16, sector - 24 + 1, 24):
        if data[pos] in (0, 0xcd):
            break
        name = name_ascii(data[pos:pos + 16].split(b'\0', 1)[0])
        start = read32(data, pos + 16)
        count = read32(data, pos + 20)
        if count == 0:  # Marqueurs de banques absentes dans certains disques PAL.
            continue
        end = start + count
        if start < 1 or end > available:
            raise ArchiveError(f"Étendue FOG invalide : {name}")
        if name.upper() in names:
            raise ArchiveError(f"Nom FOG en double : {name}")
        if any(start * sector < e.offset + e.size and e.offset < end * sector for e in entries):
            raise ArchiveError("Les fichiers FOG se chevauchent")
        names.add(name.upper())
        entries.append(Entry(name, start * sector, count * sector))
        maximum_end = max(maximum_end, end)
    complete = (maximum_end == declared or
                (maximum_end == declared + 1 and maximum_end == available) or
                (maximum_end == available and truncated_tail))
    if not entries or not complete:
        raise ArchiveError("Table FOG incomplète")
    return entries


def parse_hog(data: bytes) -> list[Entry]:
    if len(data) < 20:
        raise ArchiveError("En-tête HOG tronqué")
    count = read32(data, 4)
    names_offset = read32(data, 12)
    data_offset = read32(data, 16)
    if not count or count > (len(data) - 20) // 4:
        raise ArchiveError("Nombre de fichiers HOG invalide")
    if 20 + 4 * count > names_offset or names_offset >= data_offset or data_offset > len(data):
        raise ArchiveError("Table HOG invalide")
    offsets = [read32(data, 20 + i * 4) for i in range(count)]
    if offsets[0] != 0 or any(offset >= len(data) - data_offset for offset in offsets):
        raise ArchiveError("Position HOG invalide")
    if any(a > b for a, b in zip(offsets, offsets[1:])):
        raise ArchiveError("Positions HOG non croissantes")
    names = []
    cursor = names_offset
    for _ in range(count):
        end = data.find(b'\0', cursor, data_offset)
        if end < 0:
            raise ArchiveError("Table des noms HOG tronquée")
        names.append(name_ascii(data[cursor:end]))
        cursor = end + 1
    if len({name.upper() for name in names}) != len(names):
        raise ArchiveError("Nom HOG en double")
    return [Entry(name, data_offset + offsets[i],
                  (data_offset + offsets[i + 1] if i + 1 < count else len(data)) - (data_offset + offsets[i]))
            for i, name in enumerate(names)]


def extract(data: bytes, entries: list[Entry], name: str, destination: Path) -> None:
    matches = [entry for entry in entries if entry.name.upper() == name.upper()]
    if len(matches) != 1:
        raise ArchiveError(f"Fichier introuvable dans l'archive : {name}")
    entry = matches[0]
    # Écriture exclusive : ne pas écraser un fichier utilisateur, y compris l'archive source.
    with destination.open('xb') as out:
        out.write(data[entry.offset:entry.offset + entry.size])


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('format', choices=['fog', 'hog'], help='Format de l’archive')
    parser.add_argument('archive', type=Path, help='Fichier archive local')
    parser.add_argument('--extraire', metavar='NOM', help='Nom exact du fichier à extraire')
    parser.add_argument('--vers', type=Path, metavar='DESTINATION', help='Chemin de sortie explicite, sans écrasement')
    args = parser.parse_args(argv)
    if bool(args.extraire) != bool(args.vers):
        parser.error('--extraire et --vers doivent être utilisés ensemble')
    try:
        data = args.archive.read_bytes()
        entries = parse_fog(data) if args.format == 'fog' else parse_hog(data)
        if args.extraire:
            extract(data, entries, args.extraire, args.vers)
            print(f"Fichier extrait : {args.vers}")
        else:
            for entry in entries:
                print(f'{entry.size:>12}  {entry.name}')
    except (ArchiveError, OSError) as exc:
        print(f'Erreur : {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
