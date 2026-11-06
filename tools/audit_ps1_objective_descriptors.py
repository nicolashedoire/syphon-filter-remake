#!/usr/bin/env python3
"""Identify candidate pointer-table structures and encoded JALs in French PS1 overlays.

All structures, address mappings and calls are static candidates: none proves
runtime loading, execution, objective ordering or condition semantics.
"""
from collections import defaultdict
from pathlib import Path
import argparse,csv,hashlib,json,re,struct,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import inspecter_disque_ps1 as iso, export_intro
EXPECTED='c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72'
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--cue',type=Path,default=ROOT/'game-disc/Syphon Filter (France).cue')
p.add_argument('--catalog',type=Path,default=ROOT/'docs/ps1-briefing-candidates.csv')
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
if a.output.exists():raise FileExistsError(a.output)
with a.catalog.open(encoding='utf8',newline='') as f: names=sorted({r['briefing_overlay'] for r in csv.DictReader(f)})
if len(names)!=13:raise ValueError('Expected 13 distinct candidate overlays')
track=iso.read_cue(a.cue)
with track.path.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
if digest!=EXPECTED:raise ValueError('Unexpected disc BIN SHA-256')
disc=iso.Disc(track);out=[]
try:
 ext=export_intro.find_extents(disc)
 for name in names:
  lba,n=ext['/BIN/'+name];b=disc.extent(lba,n)
  strings={m.start() for m in re.finditer(rb'[\x20-\x7e\xa0-\xff]{8,}',b[:min(len(b),0x1500)]) if m.start()%4==0 and m.group()[-1:]!=b' '}
  bybase=defaultdict(lambda:defaultdict(list))
  for pos in range(0,len(b)-3,4):
   word=struct.unpack_from('<I',b,pos)[0]
   if not 0x80140000<=word<0x80160000:continue
   for off in strings:
    base=word-off
    if not base&3 and 0x80140000<=base<0x80150000:bybase[base][off].append(pos)
  if not bybase:raise ValueError('No pointer candidate for '+name)
  base,found=max(bybase.items(),key=lambda item:len(item[1]))
  def decode(count,pointer):
   off=pointer-base
   if off<0 or off+count*4>len(b) or off%4:return None
   texts=[]
   for i in range(count):
    location=struct.unpack_from('<I',b,off+4*i)[0]-base
    if location<0 or location>=len(b):return None
    end=b.find(b'\0',location)
    if end<0 or end-location>1024:return None
    text=b[location:end].decode('cp1252',errors='replace')
    if not all(c.isprintable() or c in '\n\r\t' for c in text):return None
    texts.append(text)
   return texts
  arrays=[]
  for off in range(0,len(b)-16,4):
   count1,ptr1,count2,ptr2=struct.unpack_from('<4I',b,off)
   if not(1<=count1<=25 and 0<=count2<=25):continue
   first=decode(count1,ptr1);second=decode(count2,ptr2) if count2 else []
   if first and second is not None and all(first):arrays.append({'offset':hex(off),'count_a':count1,'count_b':count2})
  op=0x0c000000|((0x800928d8>>2)&0x03ffffff)
  calls=[hex(i) for i in range(0,len(b)-3,4) if struct.unpack_from('<I',b,i)[0]==op]
  out.append({'overlay':name,'overlay_sha256':hashlib.sha256(b).hexdigest(),'candidate_base':hex(base),'distinct_string_starts':len(found),'candidate_descriptors':arrays,'jal_word_offsets':calls})
  print(name,'candidate descriptors',len(arrays),'candidate calls',len(calls),flush=True)
finally:disc.close()
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x',encoding='utf8') as f:
 json.dump({'disc_sha256':digest,'limitations':'Heuristic candidates only; overlapping arrays, data mistaken for code, runtime loading and behavior remain unverified.','overlays':out},f,indent=2);f.write('\n')
