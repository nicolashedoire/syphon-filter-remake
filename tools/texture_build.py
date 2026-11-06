#!/usr/bin/env python3
"""Convert PS1 EMD level geometry and authored 8-bit textures to a browser asset.

Uses the EMD parser from SF-pc-port (MIT). Supply a locally extracted SUBWAY.FOG.
Pillow and a C++20 compiler are required for generation, not for the browser.
"""
from __future__ import annotations
import argparse, base64, collections, io, json, pathlib, struct, subprocess, sys, tempfile
from PIL import Image
import archives_syphon as archives

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE_SIZE = 64 * 256 * 2

def files(data: bytes, fmt: str) -> dict[str, bytes]:
    entries = archives.parse_fog(data) if fmt == 'fog' else archives.parse_hog(data)
    return {e.name.upper(): data[e.offset:e.offset + e.size] for e in entries}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('fog', type=pathlib.Path, help='Extracted French SUBWAY.FOG')
    ap.add_argument('output', type=pathlib.Path, help='Output JavaScript file')
    args = ap.parse_args()
    fog = files(args.fog.read_bytes(), 'fog')
    models = files(fog['WLDEMD.HOG'], 'hog')
    banks = [files(fog['VRAM.HOG'], 'hog'), files(fog['VRAM1.HOG'], 'hog')]
    vlf = fog['VLF.RFF']; mask = struct.unpack_from('<I',vlf)[0]
    count = mask.bit_count(); cluts = [vlf[count * PAGE_SIZE:count * PAGE_SIZE + 16384], banks[1]['ZCLUT.BIN']]
    if len(cluts[0]) != 16384 or len(cluts[1]) != 16384: raise ValueError('Unexpected CLUT size')
    rows = []
    rooms = []
    with tempfile.TemporaryDirectory() as d:
        directory = pathlib.Path(d); binary = directory/'dump'; model = directory/'model.emd'
        subprocess.run(['c++','-std=c++20','-O2','-I',str(ROOT/'references/sf-pc-port/include'),str(ROOT/'tools/texture_dump_emd.cpp'),str(ROOT/'references/sf-pc-port/src/assets/emd_scene.cpp'),'-o',str(binary)],check=True)
        for name, data in models.items():
            if not name.endswith('.EMD'): continue
            model.write_bytes(data)
            out=subprocess.run([str(binary),str(model),str(mask)],check=True,text=True,capture_output=True).stdout
            model_rows = [tuple(map(int,line.split())) for line in out.splitlines()]
            coords = [(round(r[0]/100,2),round(-r[1]/100,2),round(r[2]/100,2)) for r in model_rows]
            if coords:
                minimum=[min(c[k] for c in coords) for k in range(3)]
                maximum=[max(c[k] for c in coords) for k in range(3)]
            else:
                minimum=maximum=[0,0,0]
            rooms.append({'start':len(rows),'count':len(model_rows),'name':name,'min':minimum,'max':maximum})
            rows.extend(model_rows)
    materials=sorted({(r[5],r[6],r[7],r[8]>>7) for r in rows} | {(15,0,0x7fb0,1),(30,0,0x7ab0,1),(14,0,0x7ab0,1),(9,0,31216,1),(10,0,31536,1),(8,0,31280,1),(6,0,31152,1)})
    if any(m[3]!=1 or m[1] not in (0,1) for m in materials): raise ValueError('Unsupported texture mode or bank')
    if len(materials)>64: raise ValueError('The texture atlas exceeds 64 slots')
    width,height=1024,2048; atlas=Image.new('RGBA',(width,height),(0,0,0,255)); placement={}
    for n,(page,bank,clut,mode) in enumerate(materials):
        if mask & (1<<page):
            preceding=(mask & ((1<<page)-1)).bit_count(); texture=vlf[preceding*PAGE_SIZE:(preceding+1)*PAGE_SIZE]
        else: texture=banks[bank][f'TP{page:02}.BIN']
        if len(texture)!=PAGE_SIZE: raise ValueError('Unexpected page size')
        clut_x=(clut&63)*16;clut_y=clut>>6
        if clut_x!=768 or not 480<=clut_y<512: raise ValueError(f'Unsupported CLUT {clut:04x}')
        start=((clut_y-480)*256+clut_x-768)*2
        palette=struct.unpack_from('<256H',cluts[bank],start)
        rgba=[]
        for c in palette:
            rgba.append(((c&31)*255//31,((c>>5)&31)*255//31,((c>>10)&31)*255//31,0 if c==0 else 255))
        tile=Image.new('RGBA',(128,256));tile.putdata([rgba[value] for value in texture])
        x=(n%8)*128;y=(n//8)*256;atlas.paste(tile,(x,y));placement[(page,bank,clut,mode)]=(x,y)
    stream=io.BytesIO();atlas.save(stream,format='PNG',optimize=True)
    uri='data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode('ascii')
    positions=[];uvs=[]
    for x,y,z,u,v,page,bank,clut,tpage in rows:
        positions.extend((round(x/100,2),round(-y/100,2),round(z/100,2)))
        px,py=placement[(page,bank,clut,tpage>>7)]
        uvs.extend((round((px+min(u,127)+.5)/width,7),round((py+min(v,255)+.5)/height,7)))
    layout=fog['SUBWAY.DAT']; model_count,initial=struct.unpack_from('<II',layout,0x88)
    if model_count!=len(rooms) or initial>=model_count: raise ValueError('Unexpected level layout')
    visibility=[]
    for i in range(model_count):
        entries=[]
        for value in layout[0x90+i*15:0x90+(i+1)*15]:
            if value in (0xfe,0xff): break
            if value>=model_count: raise ValueError('Invalid visibility entry')
            entries.append(value)
        visibility.append(entries)
    initial_rooms=[initial]+visibility[initial]
    material_map={f'{page}:{bank}:{clut}':[x,y] for (page,bank,clut,mode),(x,y) in placement.items()}
    with args.output.open('x',encoding='utf-8') as out:
        out.write('// Authored PS1 terrain UVs and textures; generated locally from the French disc.\n')
        out.write('window.SF_TEXTURED_SCENE={positions:new Float32Array(')
        json.dump(positions,out,separators=(',',':'));out.write('),uvs:new Float32Array(')
        json.dump(uvs,out,separators=(',',':'));out.write('),atlas:')
        json.dump(uri,out);out.write(',rooms:')
        json.dump(rooms,out,separators=(',',':'));out.write(',visibility:')
        json.dump(visibility,out,separators=(',',':'));out.write(',initialRooms:')
        json.dump(initial_rooms,out,separators=(',',':'));out.write(',materials:')
        json.dump(material_map,out,separators=(',',':'));out.write('};\n')
    print(f'{len(rows)//3} triangles, {len(materials)} materials, atlas {width}x{height}; {args.output}')

if __name__=='__main__': main()
