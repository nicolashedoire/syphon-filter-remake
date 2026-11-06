#!/usr/bin/env python3
"""Read-only inventory of SCES-01911 raw XA/STR extents; does not alter the disc.
Video duration estimates use decoded frames / reported frame rate, not a runtime trace.
"""
import argparse, sys, hashlib, json, os, struct, subprocess, tempfile
from pathlib import Path
from collections import Counter
from fractions import Fraction
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import inspecter_disque_ps1 as iso
import export_intro
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cue', type=Path, default=ROOT/'game-disc/Syphon Filter (France).cue')
parser.add_argument('--output', type=Path, required=True, help='New JSON output file; existing files are not overwritten')
args=parser.parse_args(); CUE=args.cue; OUTPUT=args.output
if OUTPUT.exists(): raise FileExistsError(f'Output already exists: {OUTPUT}')
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
ffprobe_version=subprocess.run(['ffprobe','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]
track=iso.read_cue(CUE); disc=iso.Disc(track)
try:
 ext=export_intro.find_extents(disc)
 paths=sorted(k for k in ext if k.endswith(('.STR','.XA','.VH','.VB','.XH','.HOG')) and not k.startswith('/FOG/'))
 results=[]
 for n,path in enumerate(paths,1):
  lba,iso_size=ext[path]; count=(iso_size+2047)//2048
  raw_sector_media=path.endswith(('.STR','.XA'))
  result={'disc_path':path,'lba':lba,'iso_directory_bytes':iso_size,'sector_count':count}
  if raw_sector_media:
   sha=hashlib.sha256(); flags=Counter(); channels=Counter(); invalid=0; duplicated=0
   with tempfile.NamedTemporaryFile(suffix=Path(path).suffix,dir=OUTPUT.parent) as temp:
    disc.file.seek(track.start+lba*2352)
    for i in range(count):
     b=disc.file.read(2352)
     if len(b)!=2352: raise ValueError(f'truncated {path} LBA {lba+i}')
     if b[:12]!=b'\0'+b'\xff'*10+b'\0' or b[15]!=2: invalid+=1
     if b[16:20]!=b[20:24]: duplicated+=1
     submode=b[18]; flags[f'0x{submode:02x}']+=1
     if submode&0x04: channels[f'file={b[16]},channel={b[17]},coding=0x{b[19]:02x}']+=1
     sha.update(b);temp.write(b)
    temp.flush()
    p=subprocess.run(['ffprobe','-v','error','-count_frames','-show_entries','format=format_name,duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels,nb_read_frames,duration','-of','json',temp.name],capture_output=True,text=True,timeout=180)
    try: probe=json.loads(p.stdout)
    except json.JSONDecodeError: probe={}
    result.update(raw_extent_bytes=count*2352,raw_extent_sha256=sha.hexdigest(),raw_extent_definition='concatenated complete 2352-byte sectors for ceil(ISO directory size/2048) sectors; includes headers and padding',invalid_mode2_sectors=invalid,subheader_copy_mismatches=duplicated,submodes=dict(flags),audio_channel_sector_counts=dict(channels),ffprobe_exit_code=p.returncode,ffprobe_stderr=p.stderr[:2000],ffprobe=probe)
    if path in ('/CUT/MUSEUM.STR','/CUT/MUSEUM1.STR'):
     decoded={}
     for kind in ('v','a'):
      f=subprocess.run(['ffmpeg','-v','error','-i',temp.name,'-map',f'0:{kind}:0','-f','md5','-'],capture_output=True,text=True,timeout=180)
      decoded[kind]={'exit_code':f.returncode,'decoded_md5':f.stdout.strip(),'stderr':f.stderr[:1000]}
     result['decoded_stream_md5']=decoded
    for stream in probe.get('streams',[]):
     if stream.get('codec_type')=='video' and stream.get('nb_read_frames') and stream.get('r_frame_rate') not in (None,'0/0','0/1'):
      fps=Fraction(stream['r_frame_rate']); stream['estimated_video_duration_seconds']=round(int(stream['nb_read_frames'])/float(fps),3)
  else:
   # The generic ISO reader handles form 1 files; reject form 2 rather than mislabel the digest.
   sha=hashlib.sha256(); left=iso_size
   for i in range(count):
    b=disc.sector(lba+i); k=min(left,len(b)); sha.update(b[:k]); left-=k
   result['logical_payload_sha256']=sha.hexdigest()
   if path=='/COMMON/INGAMEF.XH':
    blob=disc.extent(lba,iso_size)
    result['embedded_path_ascii']=blob[4:20].split(b'\0')[0].decode('ascii')
    result['note']='Embedded reference observed; remaining fields not yet interpreted.'
  results.append(result)
  print(f'{n}/{len(paths)} {path} '+('ok' if result.get('ffprobe_exit_code',0)==0 else 'probe_failed'),flush=True)
 # Heuristic cross-check only: 36 uint32 little-endian words in XH at 0x80
 # happen to point to XA audio channel 0, when interpreted as sector offsets.
 xh_lba,xh_len=ext['/COMMON/INGAMEF.XH']; xh=disc.extent(xh_lba,xh_len)
 xa_lba,xa_len=ext['/XA/INGAMEF.XA']; xa_count=(xa_len+2047)//2048
 words=[]
 for offset in range(0x80,len(xh),4):
  if offset+4>len(xh): break
  value=struct.unpack_from('<I',xh,offset)[0]
  if value>=xa_count: continue
  disc.file.seek(track.start+(xa_lba+value)*2352); sector=disc.file.read(24)
  words.append({'xh_offset_hex':hex(offset),'value':value,'candidate_lba':xa_lba+value,'xa_file':sector[16],'xa_channel':sector[17],'xa_submode_hex':hex(sector[18]),'xa_audio_flag':bool(sector[18]&4)})
 payload={'version':1,'disc_serial':'SCES-01911','track_format':'MODE2/2352','ffprobe_version':ffprobe_version,'note':'ISO extent size and raw sector byte count are distinct; candidate movie-to-mission mappings are not verified. No language inferred from filenames.','media':results};payload['xh_candidate_sector_offsets']={'interpretation':'Hypothesis only: each observed little-endian word at XH offset >= 0x80 is treated as a sector offset within XA. All inspected words happen to land on XA audio channel 0. Runtime meaning, duplicate zeros and end boundary remain unverified.','words':words}
 with OUTPUT.open('x',encoding='utf-8') as out: json.dump(payload,out,indent=2);out.write('\n')
finally: disc.close()
