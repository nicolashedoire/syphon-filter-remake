#!/usr/bin/env python3
"""Audit object-class records from 20 French disc archives without modifying inputs.

Class/model/path semantics are derived from a community parser and do not prove
hostility, spawn timing, or gameplay. Output must be a new JSON file.
"""
import argparse, csv, hashlib, json, shutil, struct, subprocess, sys, tempfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import inspecter_disque_ps1 as disc
import archives_syphon as arch
import export_intro

EXPECTED = 'c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cue', type=Path, default=ROOT/'game-disc/Syphon Filter (France).cue')
parser.add_argument('--catalog', type=Path, default=ROOT/'docs/ps1-briefing-candidates.csv')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.output.exists(): raise FileExistsError(args.output)
with args.catalog.open(encoding='utf8', newline='') as f: resources = [r['resource'] for r in csv.DictReader(f)]
if len(resources) != 20 or len(set(resources)) != 20: raise ValueError('Expected 20 unique resources')
track = disc.read_cue(args.cue)
with track.path.open('rb') as f: digest = hashlib.file_digest(f,'sha256').hexdigest()
if digest != EXPECTED: raise ValueError('Unexpected disc hash')
compiler = shutil.which('clang++') or shutil.which('c++')
if not compiler: raise RuntimeError('C++20 compiler required')
args.output.parent.mkdir(parents=True,exist_ok=True)
results=[]
with tempfile.TemporaryDirectory(prefix='ps1-actor-audit-',dir=args.output.parent) as directory:
 tmp=Path(directory);exe=tmp/'inventory';payload_path=tmp/'level.bin'
 subprocess.run([compiler,'-std=c++20','-O2','-I',str(ROOT/'references/sf-pc-port/include'),str(ROOT/'tools/inventory_ps1_objects_all.cpp'),str(ROOT/'references/sf-pc-port/src/assets/mission_objects.cpp'),'-o',str(exe)],check=True)
 image=disc.Disc(track)
 try:
  ext=export_intro.find_extents(image)
  for name in resources:
   lba,size=ext['/FOG/'+name+'.FOG'];fog=image.extent(lba,size)
   entry=next(e for e in arch.parse_fog(fog) if e.name.upper()==name+'.BIN')
   data=fog[entry.offset:entry.offset+entry.size];payload_path.write_bytes(data)
   proc=subprocess.run([str(exe),str(payload_path)],capture_output=True,text=True,check=True)
   objects=list(csv.DictReader(proc.stdout.splitlines()));class1=[o for o in objects if o['class']=='1']
   u32=lambda offset:struct.unpack_from('<I',data,offset)[0]
   nobj,ndef,doff,ooff=(u32(8),u32(12),u32(16),u32(20))
   if nobj!=len(objects) or doff+ndef*20>len(data) or ooff+nobj*76>len(data): raise ValueError('Invalid tables '+name)
   raw_counts=Counter();selector_counts=Counter();selector_oob=[]
   for i in range(nobj):
    typ=u32(ooff+i*76)
    if typ>=ndef: raise ValueError('Invalid object definition '+name)
    if u32(doff+typ*20)==1:
     pos=u32(doff+typ*20+4);end=data.index(b'\0',pos);raw_counts[data[pos:end].decode('ascii')]+=1
     attrs=u32(ooff+i*76+0x24);low=attrs & 0xff;bits=attrs & 0x3000
     selector=low if low else 19 if bits==0x1000 else 20 if bits==0x2000 else 0
     selector_counts[selector]+=1
     if selector>=26:selector_oob.append({'source':i,'selector':selector,'attributes':hex(attrs)})
   if raw_counts!=Counter(o['model'] for o in class1): raise ValueError('Independent check mismatch '+name)
   results.append({'resource':name,'bin_sha256':hashlib.sha256(data).hexdigest(),'object_records':len(objects),'class1_records':len(class1),'class1_nonempty_path':sum(int(o['path_points'])>0 for o in class1),'class1_loops':sum(o['path_loops']=='1' for o in class1),'class1_models':dict(sorted(raw_counts.items())),'candidate_selector_counts':dict(sorted(selector_counts.items())),'candidate_selector_outside_26':selector_oob,'independent_raw_class1_crosscheck':'matched'})
   print(name, 'ok',flush=True)
 finally: image.close()
report={'disc_bin_sha256':digest,'format_version':1,'limitations':'Class, models and paths are authored records, not verified enemies, spawn counts or runtime behavior. Path semantics derive from a community parser; selector calculation is hypothetical and not proved active for these records.','levels':results}
with args.output.open('x',encoding='utf8') as f:json.dump(report,f,indent=2);f.write('\n')
