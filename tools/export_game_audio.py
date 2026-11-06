#!/usr/bin/env python3
"""Export title music from the French SCES-01911 disc as a browser MP3.

The retail Georgia Street music and sound banks have not yet been decoded. The
title soundtrack is used as a temporary background track, while the web game
synthesizes its provisional sound effects. This tool never modifies the disc.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
import export_intro
import inspecter_disque_ps1 as iso


def export(cue: Path, output: Path) -> None:
    if not shutil.which('ffmpeg'):
        raise RuntimeError('ffmpeg was not found')
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    if not iso.inspect(cue)['edition_francaise_sces_01911']:
        raise ValueError('Expected the French SCES-01911 disc')
    with tempfile.TemporaryDirectory(prefix='syphon-audio-') as temporary:
        raw = Path(temporary) / 'TITLE.STR'
        disc = iso.Disc(iso.read_cue(cue))
        try:
            export_intro.extract_raw_movie(disc, export_intro.find_extents(disc)['/SOL/TITLE.STR'], raw)
        finally:
            disc.close()
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-n','-i',str(raw),
                        '-vn','-map','0:a:0','-c:a','libmp3lame','-b:a','128k',str(output)],check=True)
    print(f'Exported original title soundtrack to {output}')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cue',type=Path,help='French PS1 CUE image')
    parser.add_argument('output',type=Path,help='New MP3 file to create')
    args=parser.parse_args()
    export(args.cue,args.output)
