#!/usr/bin/env python3
"""Read candidate selector table; static bytes are not proof of gameplay."""
import argparse,hashlib,json,struct
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('exe',type=Path);p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
if a.output.exists():raise FileExistsError(a.output)
b=a.exe.read_bytes();d=hashlib.sha256(b).hexdigest()
if d!='059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95':raise ValueError('Unexpected executable')
if b[:8]!=b'PS-X EXE':raise ValueError('Invalid executable')
base=struct.unpack_from('<I',b,0x18)[0];size=struct.unpack_from('<I',b,0x1c)[0]
def load(a,n):
 pos=a-base+0x800
 if pos<0x800 or pos+n>min(len(b),0x800+size):raise ValueError('Out-of-range address '+hex(a))
 return b[pos:pos+n]
rows=[]
for subtype in range(12):
 address=0x8010d2f8+subtype*48+5*8
 ptr,n,spare,mask=struct.unpack('<IBBH',load(address,8))
 if ptr and n==0:raise ValueError('Zero divisor at '+hex(address))
 vals=list(struct.unpack('<'+'h'*n,load(ptr,n*2))) if ptr else []
 rows.append(dict(subtype=subtype,entry_address=hex(address),pointer=hex(ptr),count=n,flag_byte=spare,mask=mask,values=vals))
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x',encoding='utf8') as f:json.dump({'executable_sha256':d,'description':'Assumed initial table contents, subtype range 0–11 and selector 5, not gameplay behavior','entries':rows},f,indent=2);f.write('\n')
