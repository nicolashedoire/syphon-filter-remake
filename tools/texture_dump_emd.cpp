// Extract authored positions, UVs and materials using the SF-pc-port MIT EMD parser.
// Copyright (c) 2026 SyphonFilterPC contributors; see references/sf-pc-port/LICENSE.
#include "sf/assets/emd_scene.hpp"
#include <cstddef>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <vector>
#include <cstdint>
int main(int argc,char**argv){
  if(argc!=3){std::cerr<<"Usage: texture_dump_emd model.emd vlf-mask\n";return 2;}
  try {
    std::ifstream in(argv[1],std::ios::binary);if(!in)throw std::runtime_error("Cannot open EMD");
    std::vector<char> raw((std::istreambuf_iterator<char>(in)),{});
    const auto* p=reinterpret_cast<const std::byte*>(raw.data());
    auto scene=sf::assets::EmdScene::parse(std::span<const std::byte>(p,raw.size()));
    auto mask=static_cast<std::uint32_t>(std::stoul(argv[2],nullptr,0));
    for(const auto&section:scene.sections())for(const auto&poly:section.polygons){
      if(!poly.renderable||poly.degenerate||poly.duplicate)continue;
      auto source=sf::assets::resolveEmdTexturePageSource(poly.texture_page,scene.texturePageMask(),mask);
      const int sourcePage=source?*source:(poly.texture_page&31);
      auto emit=[&](int i){ const auto&v=section.vertices[poly.vertex_indices[i]];const auto&uv=poly.uv[i];
        std::cout<<v.x<<' '<<v.y<<' '<<v.z<<' '<<int(uv.u)<<' '<<int(uv.v)<<' '<<sourcePage<<' '<<int(scene.textureBank())<<' '<<poly.clut<<' '<<poly.texture_page<<'\n'; };
      emit(0);emit(1);emit(2);if(poly.quad){emit(1);emit(3);emit(2);}
    }
  }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}
}
