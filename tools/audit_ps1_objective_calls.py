#!/usr/bin/env python3
"""Bounded aligned JAL scan in verified French PS1 exe and candidate overlays.

Raw instruction encodings may also occur in data and do not prove execution.
The overlay base is a static hypothesis.
"""
import argparse,csv,hashlib,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import inspecter_disque_ps1 as iso,export_intro
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--exe',type=Path,required=True)
p.add_argument('--cue',type=Path,default=ROOT/'game-disc/Syphon Filter (France).cue')
p.add_argument('--catalog',type=Path,default=ROOT/'docs/ps1-briefing-candidates.csv')
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
if a.output.exists():raise FileExistsError(a.output)
exe=a.exe.read_bytes()
if hashlib.sha256(exe).hexdigest()!='059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95':raise ValueError('Unexpected executable SHA-256')
image=iso.read_cue(a.cue)
with image.path.open('rb') as f:
 if hashlib.file_digest(f,'sha256').hexdigest()!='c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72':raise ValueError('Unexpected disc SHA-256')
with a.catalog.open(newline='',encoding='utf8') as f:names=sorted({r['briefing_overlay'] for r in csv.DictReader(f)})
if len(names)!=13:raise ValueError('Expected 13 distinct candidate overlays')
targets=[0x80067408,0x800672f4,0x80018190,0x800928d8]
def scan(name,b,base):
 out=[]
 for target in targets:
  op=0x0c000000|((target>>2)&0x3ffffff)
  offsets=[hex(i) for i in range(0,len(b)-3,4) if struct.unpack_from('<I',b,i)[0]==op]
  out.append({'target':hex(target),'raw_word_offsets':offsets})
 return {'name':name,'sha256':hashlib.sha256(b).hexdigest(),'assumed_base':hex(base),'calls':out}
result=[scan('SCES_019.11 payload',exe[0x800:],0x80010000)]
disc=iso.Disc(image)
try:
 ext=export_intro.find_extents(disc)
 for name in names:
  l,n=ext['/BIN/'+name];result.append(scan(name,disc.extent(l,n),0x80146d10))
finally:disc.close()
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x',encoding='utf8') as f:json.dump({'warning':'Raw aligned words may be data; high PC bits and overlay mapping are assumptions. No runtime execution proven.','entries':result},f,indent=2);f.write('\n')
for row in result:
 found=[(x['target'],len(x['raw_word_offsets'])) for x in row['calls'] if x['raw_word_offsets']]
 print(row['name'],found)
