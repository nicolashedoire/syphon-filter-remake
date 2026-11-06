#!/usr/bin/env python3
"""Inspect class-53 object links in the verified French Georgia and metro BINs.

Class/field interpretations follow a community parser, and no runtime execution
or causal event is inferred. Input files are read-only; output must be new.
"""
import argparse,hashlib,json,struct
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--georgia',type=Path,required=True)
p.add_argument('--metro',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
if a.output.exists():raise FileExistsError(a.output)
expected={a.georgia:'424a31f2979a04e63f2213307394262b3bc38ec1d3a7fac6136f7e70d9d0d63a',a.metro:'6ff2eb523e8e3ecb3647fde603571768af4ff79a09fb4d2c0e0cc1135b983e2b'}
rows=[]
for path,digest in expected.items():
 b=path.read_bytes()
 if hashlib.sha256(b).hexdigest()!=digest:raise ValueError('Unexpected BIN SHA-256')
 u32=lambda off:struct.unpack_from('<I',b,off)[0]
 count,defs,doff,ooff=u32(8),u32(12),u32(16),u32(20)
 if doff+defs*20>len(b) or ooff+count*76>len(b):raise ValueError('Invalid table bounds')
 def definition(index):
  if not 0<=index<count:raise ValueError('Object index out of bounds')
  pos=ooff+index*76; typ=u32(pos)
  if typ>=defs:raise ValueError('Definition index out of bounds')
  off=doff+typ*20; p=u32(off+4);end=b.index(b'\0',p)
  return {'index':index,'record_offset':hex(pos),'definition':typ,'class':u32(off),'model':b[p:end].decode('ascii')}
 for i in range(count):
  actor=definition(i)
  if actor['class']!=53:continue
  pos=ooff+i*76;link16=struct.unpack_from('<h',b,pos+0x30)[0];link32=struct.unpack_from('<i',b,pos+0x30)[0]
  actor.update(link16=link16,link32=link32,linked=definition(link16) if 0<=link16<count else None)
  rows.append({'bin_sha256':digest,'actor':actor})
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x',encoding='utf8') as f:json.dump({'interpretation':'Class and links are data, not proof of runtime use, actor identity, event, or objective outcome.','rows':rows},f,indent=2);f.write('\n')
print(len(rows),'class-53 records; inspect linked targets')
