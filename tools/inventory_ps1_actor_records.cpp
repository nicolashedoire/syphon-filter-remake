// Inventory selected model records using the SF-pc-port MIT-licensed parser.
// A model reference does not establish actor identity or runtime activation.
#include "sf/assets/mission_objects.hpp"
#include <fstream>
#include <iostream>
#include <iterator>
#include <vector>
#include <stdexcept>
int main(int argc,char**argv){
 if(argc!=2) return 2;
 std::ifstream f(argv[1],std::ios::binary); if(!f) return 3;
 std::vector<char> b((std::istreambuf_iterator<char>(f)),{});
 auto t=sf::assets::MissionObjects::parse({reinterpret_cast<const std::byte*>(b.data()),b.size()});
 std::cout<<"index,definition,class,model,x,y,z,field_health,field_ai,path_offset,path_points,path_loops\n";
 for(size_t i=0;i<t.objects().size();i++){
  auto &o=t.objects()[i];auto &d=t.definition(o.type);
  if(d.primary_model=="TERRO.HMD"||d.primary_model=="CHEMO.HMD")
   std::cout<<i<<','<<o.type<<','<<d.class_id<<','<<d.primary_model<<','<<o.transform.x<<','<<o.transform.y<<','<<o.transform.z<<','<<o.health<<','<<o.ai_parameter<<','<<o.path_data_offset<<','<<o.patrol_path.size()<<','<<o.patrol_path_loops<<'\n';
 }
 std::cerr<<"objects="<<t.objects().size()<<" definitions="<<t.definitions().size()<<" rooms="<<t.roomCount()<<" player="<<t.playerIndex()<<'\n';
}
