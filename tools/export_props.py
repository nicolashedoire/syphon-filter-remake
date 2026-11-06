#!/usr/bin/env python3
"""Build original Georgia Street static props for the offline WebGL prototype.

The supplied disc provides the game data. The parsers used here are from
SF-pc-port, available under MIT; the generated asset does not grant rights to it.
"""
from __future__ import annotations
import argparse, json, pathlib, shutil, struct, subprocess, tempfile
import archives_syphon as archives
import inspecter_disque_ps1 as disc

ROOT = pathlib.Path(__file__).resolve().parent.parent

def build(image: pathlib.Path, output: pathlib.Path) -> None:
    compiler = shutil.which('clang++') or shutil.which('c++')
    if not compiler: raise RuntimeError('A C++20 compiler is required')
    if output.exists(): raise FileExistsError(f'Output already exists: {output}')
    with tempfile.TemporaryDirectory(prefix='syphon-props-') as directory:
        tmp=pathlib.Path(directory)
        tool=tmp/'export_props'
        includes=ROOT/'references/sf-pc-port/include'; source=ROOT/'references/sf-pc-port/src/assets'
        subprocess.run([compiler,'-std=c++20','-O2','-I',str(includes),str(ROOT/'tools/export_props.cpp'),*[str(source/(f+'.cpp')) for f in ('mission_objects','level_layout','hog_archive','gmd_model','emd_scene')],'-o',str(tool)],check=True,capture_output=True,text=True)
        fog_file=tmp/'SUBWAY.FOG';disc.inspect(image,('/FOG/SUBWAY.FOG',fog_file));fog=fog_file.read_bytes();entries=archives.parse_fog(fog)
        for name in ('SUBWAY.BIN','SUBWAY.DAT','DLF.RFF','VLF.RFF'):archives.extract(fog,entries,name,tmp/name)
        dlf=(tmp/'DLF.RFF').read_bytes();start,end=struct.unpack_from('<II',dlf)
        if not(8<=start<end<=len(dlf)):raise ValueError('Invalid embedded object archive')
        hog=tmp/'DLF.HOG';hog.write_bytes(dlf[start:end]);mask=struct.unpack_from('<I',(tmp/'VLF.RFF').read_bytes())[0]
        result=subprocess.run([str(tool),str(tmp/'SUBWAY.BIN'),str(tmp/'SUBWAY.DAT'),str(hog),hex(mask)],check=True,capture_output=True,text=True)
        positions=[];uvs=[];pages=[];cluts=[];objects=[];active=None
        for line in result.stdout.splitlines():
            row=line.split()
            if row[0]=='O':
                if active is not None: active['count']=len(pages)-active['start']
                active={'id':int(row[1]),'name':row[2],'rooms':[int(x) for x in row[3:]],'start':len(pages),'count':0};objects.append(active)
            elif row[0]=='V' and len(row)==9:
                positions.extend(float(x) for x in row[1:4]);uvs.extend(int(x) for x in row[4:6]);pages.append(int(row[6]));cluts.append(int(row[7]));
                if int(row[8])!=1:raise ValueError('Unsupported PS1 texture mode')
            else: raise ValueError('Unexpected object export record')
        if active is not None:active['count']=len(pages)-active['start']
        if not positions or len(pages)%3:raise ValueError('No valid object triangles found')
        with output.open('x',encoding='utf-8') as out:
            out.write('// Original French PS1 static props in the starting area.\nwindow.SF_PROPS={')
            for name,constructor,value in [('positions','Float32Array',positions),('uvs','Uint8Array',uvs),('pages','Uint8Array',pages),('cluts','Uint16Array',cluts)]:out.write(name+':new '+constructor+'('+json.dumps(value,separators=(',',':'))+'),')
            out.write('objects:'+json.dumps(objects,separators=(',',':'))+'};\n')
    print(f'Wrote {output}: {len(objects)} objects, {len(pages)//3} triangles')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('image',type=pathlib.Path,help='French PS1 CUE or ISO image');p.add_argument('output',type=pathlib.Path,help='New JavaScript file to create');a=p.parse_args();build(a.image,a.output)
if __name__=='__main__':main()
