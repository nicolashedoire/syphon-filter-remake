#!/usr/bin/env python3
"""Read-only comparison of candidate French records with community US labels.

Packed fields and index labels come from the US community project, not a
validated specification or dynamic trace of the French game. Inputs are never
modified. The output is a new, user-selected evidence file.
"""
import argparse,hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--exe',type=Path,required=True,help='Extracted French executable; read only')
parser.add_argument('--output',type=Path,required=True,help='New JSON file; existing files are not overwritten')
args=parser.parse_args(); exe=args.exe
source=root/'references/sf-pc-port/src/game/combat.cpp'
data=exe.read_bytes()
actual=hashlib.sha256(data).hexdigest()
expected='059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95'
if actual!=expected: raise SystemExit('Unexpected French executable digest')
# Names and proposed decoded values are transcribed from community combat.cpp.
ref=[('unarmed',15,0,0),('silenced_9mm',50,25,4),('pistol_9mm',50,25,12),('unused_357',15,0,0),('pistol_45',150,75,8),('g_18',50,25,1),('combat_shotgun',300,150,18),('shotgun',200,75,15),('pk_102',50,25,2),('m_16',50,25,2),('biz_2',75,35,2),('hk_5',50,25,2),('nightvision_rifle',90,90,20),('sniper_rifle',50,25,4),('taser',100,0,0),('flamethrower',50,50,2),('m_79',600,600,20),('k3g4',50,25,2),('virus_scanner',0,0,0),('fragmentation_grenade',600,0,15),('gas_grenade',600,0,15),('flashlight',0,0,0),('chopper_gun',75,75,2),('key_card',0,0,0),('c4_explosives',0,0,0),('viral_antigen',0,0,0)]
rows=[]
for i,(name,close,distant,cadence) in enumerate(ref):
 off=0xfd29c+i*0x20; rec=data[off:off+0x20]; word=struct.unpack_from('<I',rec,12)[0]
 fields=[(word>>6)&1023,(word>>16)&1023,(word>>26)&31]; compare=[close,distant,cadence]
 rows.append({'index':i,'community_us_label':name,'file_offset':hex(off),'runtime_address':hex(0x8000f800+off),'raw_record_hex':rec.hex(),'word_offset':hex(off+12),'word_le_hex':hex(word),'candidate_fields':fields,'community_us_fields':compare,'fields_match':fields==compare})
assert len(rows)==26 and all(r['fields_match'] for r in rows)
report={'executable_sha256':actual,'record_base_file_offset':hex(0xfd29c),'record_stride':hex(0x20),'community_reference_path':'references/sf-pc-port/src/game/combat.cpp','community_reference_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'limitations':'Candidate labels, index mapping, bit-field semantics and behavior are inferred from the community US port, not confirmed against French execution. Record boundaries inferred by 0x20 stride and sequential matching. Do not treat tick values as seconds.','rows':rows}
p=args.output
with p.open('x',encoding='utf-8') as out: json.dump(report,out,indent=2);out.write('\n')
print(f'{p}: {len(rows)} records, {sum(r["fields_match"] for r in rows)} matching candidate triplets')
