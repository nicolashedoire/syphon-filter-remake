// Export selected Georgia Street actor records using SF-pc-port's MIT parser.
// Copyright (c) 2026 SyphonFilterPC contributors; see references/sf-pc-port/LICENSE.
#include "sf/assets/mission_objects.hpp"
#include <array>
#include <cstddef>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <vector>

int main(int argc, char** argv) {
  try {
    if (argc != 2) throw std::runtime_error("Usage: export_mission_actors SUBWAY.BIN");
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) throw std::runtime_error("Cannot open mission object table");
    std::vector<char> bytes((std::istreambuf_iterator<char>(input)), {});
    auto table = sf::assets::MissionObjects::parse(
        {reinterpret_cast<const std::byte*>(bytes.data()), bytes.size()});
    constexpr std::array<unsigned, 3> ids{172, 173, 184};
    std::cout << '[';
    bool first = true;
    for (auto id : ids) {
      if (id >= table.objects().size()) throw std::runtime_error("Missing mission actor");
      const auto& actor = table.objects()[id];
      const auto& def = table.definition(actor.type);
      const auto expected = id == 184 ? "TERRO.HMD" : "CHEMO.HMD";
      if (def.primary_model != expected) throw std::runtime_error("Unexpected mission actor model");
      if (!first) std::cout << ',';
      first = false;
      // SUBWAY.BIN uses centimetres and its stored Y grows upward in the
      // browser's exported scene convention. Mission-script Y has the other sign.
      std::cout << "{\"source\":" << id << ",\"model\":\"" << def.primary_model
                << "\",\"health\":" << actor.health << ",\"aiParameter\":" << actor.ai_parameter
                << ",\"position\":[" << actor.transform.x << ',' << actor.transform.y << ',' << actor.transform.z
                << "],\"rooms\":[";
      bool room_first = true;
      for (auto room : table.roomsContainingObject(id)) { if (!room_first) std::cout << ','; room_first=false; std::cout << room; }
      std::cout << "],\"route\":[";
      bool point_first = true;
      for (auto point : actor.patrol_path) {
        if (!point_first) std::cout << ',';
        point_first=false;
        std::cout << '[' << point.x << ',' << point.y << ',' << point.z << ']';
      }
      std::cout << "],\"routeLoops\":" << (actor.patrol_path_loops ? "true" : "false") << '}';
    }
    std::cout << "]\n";
  } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
