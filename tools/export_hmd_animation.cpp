// Bake HMD animation positions. Parsing uses SF-pc-port (MIT), see its LICENSE.
#include "sf/assets/hmd_model.hpp"
#include "sf/assets/hmd_animation.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <numbers>
#include <stdexcept>
#include <vector>
using Matrix=std::array<double,9>;using Vec=std::array<double,3>;
struct Pose{Matrix r;Vec t;};
Vec rotate(const Matrix&r,const Vec&v){return {r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]};}
Vec add(const Vec&a,const Vec&b){return {a[0]+b[0],a[1]+b[1],a[2]+b[2]};}
Pose bind(const sf::assets::HmdPart&p){Pose x{};for(int i=0;i<3;i++)for(int j=0;j<3;j++)x.r[i*3+j]=p.local_transform.rotation[j*3+i]/4096.0;Vec tr{double(p.local_transform.translation[0]),double(p.local_transform.translation[1]),double(p.local_transform.translation[2])};x.t=rotate(x.r,tr);for(auto&v:x.t)v=-v;return x;}
Pose animated(const sf::assets::HmdAnimationTransform &t){const auto rad=[](int x){return x*2.0*std::numbers::pi/4096.0;};double x=rad(t.rotation[0]),y=rad(t.rotation[1]),z=rad(t.rotation[2]),sx=std::sin(x),cx=std::cos(x),sy=std::sin(y),cy=std::cos(y),sz=std::sin(z),cz=std::cos(z);return {{cy*cz+sy*sx*sz,sy*sx*cz-cy*sz,sy*cx,sz*cx,cz*cx,-sx,cy*sx*sz-sy*cz,sy*sz+cy*sx*cz,cy*cx},{double(t.translation[0]),double(t.translation[1]),double(t.translation[2])}};}
Pose combine(const Pose&a,const Pose&b){Pose c{};for(int i=0;i<3;i++)for(int j=0;j<3;j++)for(int k=0;k<3;k++)c.r[i*3+j]+=a.r[i*3+k]*b.r[k*3+j];c.t=add(rotate(a.r,b.t),a.t);return c;}
std::vector<std::byte> read(const char*path){std::ifstream f(path,std::ios::binary|std::ios::ate);if(!f)throw std::runtime_error("Cannot open input");auto n=f.tellg();if(n<1||n>10*1024*1024)throw std::runtime_error("Invalid input size");std::vector<std::byte>b((size_t)n);f.seekg(0);if(!f.read((char*)b.data(),n))throw std::runtime_error("Cannot read input");return b;}
int main(int argc,char**argv){try{if(argc!=5)throw std::runtime_error("Usage: export_hmd_animation model.hmd lower.lwr upper.upr stride");auto model=sf::assets::HmdModel::parse(read(argv[1]));auto lo=sf::assets::HmdAnimationClip::parse(read(argv[2]),model.parts().size());auto up=sf::assets::HmdAnimationClip::parse(read(argv[3]),model.parts().size());int stride=std::stoi(argv[4]);if(stride<1)throw std::runtime_error("Invalid stride");size_t duration=std::max(lo.frames().size(),up.frames().size());std::cout<<std::fixed<<std::setprecision(4)<<"{\"frames\":[";bool firstFrame=true;
for(size_t tick=0;tick<duration;tick+=(size_t)stride){const auto &lf=lo.poseAtTick(tick),&uf=up.poseAtTick(tick);std::vector<Pose>poses(model.parts().size());std::vector<bool>done(poses.size());size_t count=0;while(count<poses.size()){bool progress=false;for(size_t i=0;i<poses.size();i++){if(done[i])continue;const auto&p=model.parts()[i];if(p.parent>=0&&!done.at((size_t)p.parent))continue;const auto mask=uint16_t(1u<<i);Pose loc;if(uf.valid_parts&mask)loc=animated(uf.transforms[i]);else if(lf.valid_parts&mask)loc=animated(lf.transforms[i]);else loc=bind(p);poses[i]=p.parent<0?loc:combine(poses[(size_t)p.parent],loc);done[i]=true;count++;progress=true;}if(!progress)throw std::runtime_error("Unresolvable HMD hierarchy");}
std::vector<Vec>verts;verts.reserve(model.vertices().size());for(size_t i=0;i<model.vertices().size();i++){auto v=model.vertices()[i];auto &p=poses.at(model.vertexParts().at(i));verts.push_back(add(rotate(p.r,Vec{double(v.x),double(v.y),double(v.z)}),p.t));}double ground=-std::numeric_limits<double>::infinity();for(const auto&t:model.triangles())for(auto i:t.vertex_indices)ground=std::max(ground,verts.at(i)[1]);if(!firstFrame)std::cout<<',';firstFrame=false;std::cout<<'[';bool first=true;for(const auto&t:model.triangles())for(auto i:t.vertex_indices){const auto&p=verts.at(i);for(double v:{p[0]/100.0,(ground-p[1])/100.0,p[2]/100.0}){if(!first)std::cout<<',';first=false;std::cout<<(std::abs(v)<0.00005?0.0:v);}}std::cout<<']';}
std::cout<<"]}\n";
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}return 0;}
