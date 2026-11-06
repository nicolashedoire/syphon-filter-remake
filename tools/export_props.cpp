// Export PS1 mission props using SF-pc-port's MIT-licensed data parsers.
// Copyright (c) 2026 SyphonFilterPC contributors; see references/sf-pc-port/LICENSE.
#include "sf/assets/mission_objects.hpp"
#include "sf/assets/level_layout.hpp"
#include "sf/assets/hog_archive.hpp"
#include "sf/assets/gmd_model.hpp"
#include "sf/assets/emd_scene.hpp"
#include <algorithm>
#include <cstddef>
#include <fstream>
#include <iostream>
#include <iterator>
#include <set>
#include <string>
#include <vector>
using namespace sf::assets;
std::vector<std::byte> read(const char *path){std::ifstream f(path,std::ios::binary);if(!f)throw std::runtime_error("Cannot open input");std::vector<char>b((std::istreambuf_iterator<char>(f)),{});return {reinterpret_cast<std::byte*>(b.data()),reinterpret_cast<std::byte*>(b.data()+b.size())};}
int main(int argc,char**argv){try{
 if(argc!=5)throw std::runtime_error("Usage: export_props SUBWAY.BIN SUBWAY.DAT DLF.HOG VLF_MASK");
 auto m=MissionObjects::parse(read(argv[1]));auto l=LevelLayout::parse(read(argv[2]),m.roomCount());auto h=HogArchive::parse(read(argv[3]));const auto vlf=std::stoul(argv[4],nullptr,0);
 std::set<unsigned> ids;auto add=[&](int room){for(auto i:m.objectsInRoom(room))ids.insert(i);};add(l.initialRoom());for(auto r:l.visibility(l.initialRoom()).active_models)add(r);
 const std::set<std::string> skip={"CFIREA","CFIREB","CFIREC","GLIT","YLT","SMOKE","FIRE","FIREA","FIREB","FIREC","FIREY"};
 for(auto id:ids){if(id==m.playerIndex())continue;const auto& o=m.objects()[id];const auto& def=m.definition(o.type);std::string stem=def.primary_model;auto dot=stem.find('.');if(dot!=std::string::npos)stem.resize(dot);if(stem.empty()||skip.contains(stem))continue;
  auto resource=h.entries().end();for(const auto& ext:{".GMD",".EMD"}){resource=std::find_if(h.entries().begin(),h.entries().end(),[&](auto&e){return e.name==stem+ext;});if(resource!=h.entries().end())break;}if(resource==h.entries().end())continue;
  std::cout<<"O "<<id<<' '<<stem;for(auto room:m.roomsContainingObject(id))std::cout<<' '<<room;std::cout<<'\n';auto rows=[&](auto v,auto uv,unsigned page,unsigned clut,unsigned mode){const auto& t=o.transform;auto r=[&](int k){return (t.rotation[k*3]*double(v.x)+t.rotation[k*3+1]*double(v.y)+t.rotation[k*3+2]*double(v.z))/4096.;};std::cout<<"V "<<(t.x+r(0))/100.<<' '<<(t.y-r(1))/100.<<' '<<(t.z+r(2))/100.<<' '<<(unsigned)uv.u<<' '<<(unsigned)uv.v<<' '<<page<<' '<<clut<<' '<<mode<<'\n';};
  if(resource->name.ends_with(".GMD")){auto model=GmdModel::parse(h.file(resource->name));for(auto& tri:model.triangles()){if(!tri.flags||tri.degenerate)continue;for(int i=0;i<3;i++)rows(model.vertices().at(tri.vertex_indices[i]),tri.uv[i],tri.texture_page&31,tri.clut,tri.texture_page>>7);}}
  else {auto model=EmdScene::parse(h.file(resource->name));for(const auto& sec:model.sections())for(const auto& poly:sec.polygons){if(!poly.renderable||poly.degenerate||poly.duplicate)continue;auto source=resolveEmdTexturePageSource(poly.texture_page,model.texturePageMask(),vlf);auto page=source?*source:(poly.texture_page&31);for(int i:{0,1,2})rows(sec.vertices.at(poly.vertex_indices[i]),poly.uv[i],page,poly.clut,poly.texture_page>>7);if(poly.quad)for(int i:{1,3,2})rows(sec.vertices.at(poly.vertex_indices[i]),poly.uv[i],page,poly.clut,poly.texture_page>>7);}}
 }
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
