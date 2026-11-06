#include "sf/assets/hmd_animation.hpp"
#include "sf/assets/hmd_model.hpp"
#include <vector>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
std::vector<std::byte> read(const char*p){std::ifstream f(p,std::ios::binary);if(!f)throw std::runtime_error("open");std::vector<char>b((std::istreambuf_iterator<char>(f)),{});return {reinterpret_cast<const std::byte*>(b.data()),reinterpret_cast<const std::byte*>(b.data()+b.size())};}
int main(int argc,char**argv){try{if(argc!=3)return 2;auto m=sf::assets::HmdModel::parse(read(argv[1]));auto c=sf::assets::HmdAnimationClip::parse(read(argv[2]),m.parts().size());int x=0,y=0,z=0; std::cout<<"part_count="<<m.parts().size()<<" frames="<<c.frames().size()<<" duration_field="<<int(c.duration())<<" has_root="<<c.hasRootMotion()<<" root_records="<<c.rootMotion().size()<<"\n";for(auto r:c.rootMotion()){x+=r.x;y+=r.y;z+=r.z;std::cout<<int(r.x)<<","<<int(r.y)<<","<<int(r.z)<<","<<int(r.reserved)<<"\n";}std::cout<<"sum_raw="<<x<<","<<y<<","<<z<<"\n";}catch(const std::exception&e){std::cerr<<e.what()<<"\n";return 1;}}
