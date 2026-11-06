#!/usr/bin/env python3
"""Cross-check candidate French mission briefing labels and DLF/overlay bytes.

Reads the local CUE/BIN without modifying it. The 20 resource and standalone
briefing-overlay pairs are hypotheses from the community US mission catalog.
Exact bytes and string presence never establish runtime selection or objective
triggers. Writes a new JSON report and refuses to overwrite any file.
"""
from __future__ import annotations
import argparse,csv,hashlib,json,re,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import inspecter_disque_ps1 as iso, archives_syphon as ar, export_intro
EXPECTED='c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cue',type=Path,default=ROOT/'game-disc/Syphon Filter (France).cue')
parser.add_argument('--catalog',type=Path,default=ROOT/'docs/ps1-briefing-candidates.csv')
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args()
if args.output.exists():raise FileExistsError(args.output)
with args.catalog.open(encoding='utf8',newline='') as f: catalog=list(csv.DictReader(f))
if len(catalog)!=20 or len({r['resource'] for r in catalog})!=20:raise ValueError('Expected 20 unique catalog resources')
track=iso.read_cue(args.cue)
with track.path.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
if digest!=EXPECTED:raise ValueError('Unexpected disc BIN SHA-256')
disc=iso.Disc(track); result=[]
try:
 extents=export_intro.find_extents(disc)
 overlay_names=sorted({row['briefing_overlay'] for row in catalog}); overlays={}
 for name in overlay_names:
  lba,size=extents['/BIN/'+name]; data=disc.extent(lba,size)
  if len(data)<0x54:raise ValueError('Truncated overlay '+name)
  overlays[name]=data
 for row in catalog:
  resource=row['resource']; fogpath=f'/FOG/{resource}.FOG'; lba,size=extents[fogpath]; fog=disc.extent(lba,size)
  dlfentry=next(e for e in ar.parse_fog(fog) if e.name.upper()=='DLF.RFF');dlf=fog[dlfentry.offset:dlfentry.offset+dlfentry.size]
  begin=struct.unpack_from('<I',dlf,20)[0]+24;end=struct.unpack_from('<I',dlf,0)[0]
  if not 0<=begin<end<=len(dlf):raise ValueError('Invalid DLF bounds '+resource)
  text=dlf[begin:end]
  dates=[{'date':m.group().decode('ascii'),'dlf_offset':hex(begin+m.start())} for m in re.finditer(rb'\d\d/\d\d \d\dh\d\d',text)]
  candidate_date=row['date_text'];title=row['next_string_candidate'].strip();title_bytes=title.encode('cp1252')
  matching=[]
  for name,overlay in overlays.items():
   start=dlf.find(overlay[0x14:0x54]);run=0
   if start>=0:
    while start+run<len(dlf) and 0x14+run<len(overlay) and dlf[start+run]==overlay[0x14+run]:run+=1
    matching.append({'overlay':name,'overlay_sha256':hashlib.sha256(overlay).hexdigest(),'overlay_offset':'0x14','dlf_offset':hex(start),'equal_run_bytes':run})
  result.append({'resource':resource,'fog_path':fogpath,'fog_lba':lba,'fog_iso_bytes':size,'dlf_entry_offset':hex(dlfentry.offset),'dlf_sector_padded_size':dlfentry.size,'dlf_sha256':hashlib.sha256(dlf).hexdigest(),'dlf_candidate_text_start':hex(begin),'dlf_candidate_text_end':hex(end),'candidate_briefing_overlay':row['briefing_overlay'],'candidate_overlay_date_offset':row['date_offset'],'candidate_date':candidate_date,'candidate_title':title,'candidate_date_dlf_offsets':[v['dlf_offset'] for v in dates if v['date']==candidate_date],'candidate_title_present':title_bytes in text,'all_dlf_date_anchors':dates,'exact_overlay_runs':matching})
finally:disc.close()
args.output.parent.mkdir(parents=True,exist_ok=True)
report={'disc_bin_sha256':digest,'format_version':1,'limit':'Source-level comparison only; US catalog mappings, DLF code/data interpretation, runtime selection and objective triggers are not proved. Overlay matches start at 0x14 and cover only the longest initial equal byte run.','rows':result}
with args.output.open('x',encoding='utf8') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
print(f"{len(result)} resources; {sum(bool(r['candidate_date_dlf_offsets']) for r in result)} contain candidate date; {sum(bool(r['exact_overlay_runs']) for r in result)} have at least one exact overlay run")
