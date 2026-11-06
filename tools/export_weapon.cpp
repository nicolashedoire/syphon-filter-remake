// Export original PS1 weapon GMD using SF-pc-port's MIT-licensed parser.
// Copyright (c) 2026 SyphonFilterPC contributors; see references/sf-pc-port/LICENSE.
#include "sf/assets/gmd_model.hpp"
#include <cstddef>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <vector>
int main(int argc, char **argv) {
 try {
  if(argc != 2) throw std::runtime_error("Usage: export_weapon weapon.gmd");
  std::ifstream in(argv[1], std::ios::binary);
  if(!in) throw std::runtime_error("Could not open weapon model");
  std::vector<char> raw((std::istreambuf_iterator<char>(in)),{});
  std::vector<std::byte> bytes(reinterpret_cast<std::byte*>(raw.data()),reinterpret_cast<std::byte*>(raw.data()+raw.size()));
  auto model=sf::assets::GmdModel::parse(bytes);
  for(const auto &triangle:model.triangles()){
   if(!triangle.flags || triangle.degenerate) continue;
   for(int i=0;i<3;i++){
    const auto &v=model.vertices().at(triangle.vertex_indices[i]);
    const auto &uv=triangle.uv[i];
    std::cout<<v.x<<' '<<v.y<<' '<<v.z<<' '<<unsigned(uv.u)<<' '<<unsigned(uv.v)<<' '<<(triangle.texture_page&31)<<' '<<triangle.clut<<' '<<(triangle.texture_page>>7)<<'\n';
   }
  }
 }catch(const std::exception &e){std::cerr<<e.what()<<'\n';return 1;}
}
