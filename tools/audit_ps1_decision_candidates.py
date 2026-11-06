#!/usr/bin/env python3
"""Find candidate lb/lbu offset 0x4a and nearby immediate comparisons.

Scans all PS-X EXE payload bytes as possible MIPS instructions; matches are not
proof of executable code, function identity, gameplay, or semantic equivalence.
"""
import argparse, hashlib, json, struct
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('exe',type=Path)
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
if a.output.exists():raise FileExistsError(a.output)
b=a.exe.read_bytes(); digest=hashlib.sha256(b).hexdigest()
if digest!='059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95':raise ValueError('Unexpected PS-X executable')
if b[:8]!=b'PS-X EXE':raise ValueError('Wrong format')
base=struct.unpack_from('<I',b,0x18)[0];length=struct.unpack_from('<I',b,0x1c)[0]
if length%4 or len(b)<0x800+length:raise ValueError('Invalid executable payload')
w=struct.unpack_from('<%dI'%(length//4),b,0x800);hits=[]
for i,x in enumerate(w):
 if (x>>26) not in (0x20,0x24) or (x & 0xffff)!=0x4a:continue
 near=[]
 for j in range(max(0,i-48),min(len(w),i+49)):
  v=w[j];op=v>>26;imm=v&0xffff
  if op in (0x09,0x0a,0x0b,0x0c,0x0d) and imm in (0x3c,0x3d,0x3e):near.append({'address':hex(base+4*j),'word':hex(v)})
 if near:hits.append({'address':hex(base+4*i),'word':hex(x),'comparisons':near})
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x') as f:json.dump({'input_sha256':digest,'base':hex(base),'window_instructions':48,'matches':hits},f,indent=2);f.write('\n')
print(len(hits),'candidate matches (code and data not separated)')
