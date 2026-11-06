#!/usr/bin/env python3
"""Prepare raw Georgia Street 3D geometry locally from a PS1 disc image.

The generated geometry comes from the supplied image and remains on the local
machine. Textures, objects, characters, and animations are excluded. A new
output directory is required: no existing files are overwritten.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import archives_syphon as archives
import inspecter_disque_ps1 as disque

ROOT = Path(__file__).resolve().parent.parent
NOM_MODELE = re.compile(r"[A-Za-z0-9_-]+\.EMD\Z", re.IGNORECASE)


def fusionner(fichiers: list[Path], destination: Path) -> tuple[int, int]:
    """Merge the exporter OBJ files, which use positive absolute indices."""
    decalage = 0
    triangles = 0
    with destination.open("x", encoding="ascii", newline="\n") as sortie:
        sortie.write("# Decors PS1 bruts de Georgia Street, sans textures\n")
        for fichier in fichiers:
            sommets = 0
            sortie.write(f"o {fichier.stem}\n")
            with fichier.open(encoding="ascii") as source:
                for ligne in source:
                    if ligne.startswith("v "):
                        sortie.write(ligne)
                        sommets += 1
                    elif ligne.startswith("f "):
                        indices = ligne.split()[1:]
                        if len(indices) != 3 or any(not i.isdigit() or int(i) < 1 for i in indices):
                            raise ValueError(f"Face OBJ non prise en charge dans {fichier.name}")
                        if any(int(i) > sommets for i in indices):
                            raise ValueError(f"Indice OBJ hors limites dans {fichier.name}")
                        sortie.write("f " + " ".join(str(int(i) + decalage) for i in indices) + "\n")
                        triangles += 1
            decalage += sommets
    return decalage, triangles


def preparer(image: Path, destination: Path) -> tuple[int, int, int]:
    compilateur = shutil.which("clang++") or shutil.which("c++")
    if not compilateur:
        raise RuntimeError("Un compilateur C++20 est nécessaire (clang++ ou c++).")
    en_tetes = ROOT / "references/sf-pc-port/include"
    source_amont = ROOT / "references/sf-pc-port/src/assets/emd_scene.cpp"
    if not en_tetes.is_dir() or not source_amont.is_file():
        raise RuntimeError("Sources SF-pc-port absentes ; lancez git submodule update --init --recursive.")
    if not image.is_file():
        raise FileNotFoundError(f"Image introuvable : {image}")
    # Create exclusively before writing: never touch an existing directory.
    destination.mkdir(parents=False, exist_ok=False)
    sortie_obj = destination / "obj"
    sortie_obj.mkdir()
    with tempfile.TemporaryDirectory(prefix="syphon-geometrie-") as tmp:
        temporaire = Path(tmp)
        outil = temporaire / "exporter_emd_obj"
        commande = [compilateur, "-std=c++20", "-O2", "-I", str(en_tetes),
                    str(ROOT / "tools/exporter_emd_obj.cpp"), str(source_amont), "-o", str(outil)]
        subprocess.run(commande, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        fog = temporaire / "SUBWAY.FOG"
        info = disque.inspect(image, ("/FOG/SUBWAY.FOG", fog))
        print(f"Disque : {info['numero'] or 'non identifié'}", flush=True)
        donnees_fog = fog.read_bytes()
        contenu_fog = archives.parse_fog(donnees_fog)
        hog = temporaire / "WLDEMD.HOG"
        archives.extract(donnees_fog, contenu_fog, "WLDEMD.HOG", hog)
        donnees_hog = hog.read_bytes()
        contenus = [e for e in archives.parse_hog(donnees_hog) if e.name.upper().endswith(".EMD")]
        if not contenus:
            raise ValueError("Aucun modèle EMD dans WLDEMD.HOG.")
        if any(not NOM_MODELE.fullmatch(e.name) for e in contenus):
            raise ValueError("Nom de modèle EMD non pris en charge dans l'archive.")
        fichiers = []
        for n, entree in enumerate(contenus, 1):
            emd = temporaire / f"{n:04}.emd"
            archives.extract(donnees_hog, contenus, entree.name, emd)
            obj = sortie_obj / f"{Path(entree.name).stem}.obj"
            subprocess.run([str(outil), str(emd), str(obj)], check=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            fichiers.append(obj)
        sommets, triangles = fusionner(fichiers, destination / "georgia-street.obj")
    return len(fichiers), sommets, triangles


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="CUE file with its BIN, or a 2048-byte ISO image")
    parser.add_argument("destination", type=Path, help="New directory to create for the OBJ files")
    args = parser.parse_args(argv)
    try:
        nb, sommets, triangles = preparer(args.image, args.destination)
    except subprocess.CalledProcessError as exc:
        print(f"Erreur d'outil : {exc.stderr or exc}", file=sys.stderr)
        print(f"Si créé, le dossier partiel reste disponible : {args.destination}", file=sys.stderr)
        return 1
    except (archives.ArchiveError, disque.ImageError, ValueError, RuntimeError, OSError) as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        print(f"Si créé, le dossier partiel reste disponible : {args.destination}", file=sys.stderr)
        return 1
    print(f"{nb} modèles exportés : {sommets} sommets, {triangles} triangles.")
    print(f"Ouvrir visualiseur/index.html et choisir {args.destination / 'georgia-street.obj'}")
    print("Géométrie uniquement : pas de textures, objets animés ni gameplay.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
