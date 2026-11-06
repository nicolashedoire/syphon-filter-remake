// Convert a Syphon Filter HMD into local-space mesh data without textures.
// The HMD parser is from SF-pc-port, Copyright 2026 SyphonFilterPC contributors,
// MIT License; see references/sf-pc-port/LICENSE.
#include "sf/assets/hmd_model.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>
using Matrix=std::array<double,9>; using Vec=std::array<double,3>;
struct Pose {Matrix r; Vec t;};
Vec rotate(const Matrix&r,const Vec&v){return {r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]};}
Vec add(const Vec&a,const Vec&b){return {a[0]+b[0],a[1]+b[1],a[2]+b[2]};}
Pose localPose(const sf::assets::HmdPart&p){Pose x{};for(int i=0;i<3;i++)for(int j=0;j<3;j++)x.r[i*3+j]=p.local_transform.rotation[j*3+i]/4096.0;Vec tr{double(p.local_transform.translation[0]),double(p.local_transform.translation[1]),double(p.local_transform.translation[2])};x.t=rotate(x.r,tr);for(auto&v:x.t)v=-v;return x;}
Pose combine(const Pose&a,const Pose&b){Pose c{};for(int i=0;i<3;i++)for(int j=0;j<3;j++)for(int k=0;k<3;k++)c.r[i*3+j]+=a.r[i*3+k]*b.r[k*3+j];c.t=add(rotate(a.r,b.t),a.t);return c;}
int main(int argc,char**argv){try{if(argc!=2)throw std::runtime_error("Usage: export_hmd input.hmd > output.json");std::ifstream f(argv[1],std::ios::binary|std::ios::ate);if(!f)throw std::runtime_error("Cannot open input");auto size=f.tellg();if(size<0||size>10*1024*1024)throw std::runtime_error("Invalid input size");std::vector<std::byte>bytes((size_t)size);f.seekg(0);if(!f.read((char*)bytes.data(),size))throw std::runtime_error("Cannot read input");const auto model=sf::assets::HmdModel::parse(bytes);std::vector<Pose>poses(model.parts().size());std::vector<bool>done(poses.size());size_t count=0;while(count<poses.size()){bool progress=false;for(size_t i=0;i<poses.size();i++){if(done[i])continue;const auto&part=model.parts()[i];if(part.parent>=0&&!done.at((size_t)part.parent))continue;auto loc=localPose(part);poses[i]=part.parent<0?loc:combine(poses[(size_t)part.parent],loc);done[i]=true;++count;progress=true;}if(!progress)throw std::runtime_error("Invalid hierarchy");}
std::vector<Vec>vertices;vertices.reserve(model.vertices().size());double ground=-std::numeric_limits<double>::infinity();for(size_t i=0;i<model.vertices().size();i++){auto v=model.vertices()[i];Vec p{double(v.x),double(v.y),double(v.z)};auto&pose=poses.at(model.vertexParts().at(i));p=add(rotate(pose.r,p),pose.t);vertices.push_back(p);}for(const auto&t:model.triangles())for(auto i:t.vertex_indices)ground=std::max(ground,vertices.at(i)[1]);
std::cout<<std::fixed<<std::setprecision(5)<<"{\"positions\":[";bool first=true;for(const auto&t:model.triangles())for(auto i:t.vertex_indices){const auto&p=vertices.at(i);for(double v:{p[0]/100.0,(ground-p[1])/100.0,p[2]/100.0}){if(!first)std::cout<<',';std::cout<<v;first=false;}}std::cout<<"],\"parts\":[";first=true;for(const auto&t:model.triangles())for(auto i:t.vertex_indices){if(!first)std::cout<<',';std::cout<<model.vertexParts().at(i);first=false;}std::cout<<"],\"uvs\":[";first=true;for(const auto&t:model.triangles())for(auto uv:t.uv){if(!first)std::cout<<',';std::cout<<(unsigned)uv.u<<','<<(unsigned)uv.v;first=false;}std::cout<<"],\"cluts\":[";first=true;for(const auto&t:model.triangles())for(int i=0;i<3;i++){if(!first)std::cout<<',';std::cout<<t.clut;first=false;}std::cout<<"],\"tpages\":[";first=true;for(const auto&t:model.triangles())for(int i=0;i<3;i++){if(!first)std::cout<<',';std::cout<<t.texture_page;first=false;}std::cout<<"],\"partNames\":[";first=true;for(const auto&p:model.parts()){if(!first)std::cout<<',';std::cout<<'"'<<p.name<<'"';first=false;}std::cout<<"]}\n";
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}return 0;}
