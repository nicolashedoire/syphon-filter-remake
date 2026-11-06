// Export local de géométrie EMD en OBJ, sans textures ni données du jeu.
// Utilise EmdScene du projet SF-pc-port : Copyright (c) 2026
// SyphonFilterPC contributors, licence MIT :
// references/sf-pc-port/LICENSE et https://github.com/Madxbio97/SF-pc-port
#include "sf/assets/emd_scene.hpp"

#include <cstddef>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
std::vector<std::byte> lire(const std::filesystem::path &path) {
  std::ifstream input(path, std::ios::binary | std::ios::ate);
  if (!input) throw std::runtime_error("Impossible d'ouvrir le fichier EMD");
  const auto size = input.tellg();
  if (size < 0 || size > 256 * 1024 * 1024)
    throw std::runtime_error("Taille du fichier EMD invalide ou supérieure à 256 Mio");
  std::vector<std::byte> data(static_cast<std::size_t>(size));
  input.seekg(0);
  if (!data.empty() && !input.read(reinterpret_cast<char *>(data.data()), size))
    throw std::runtime_error("Lecture du fichier EMD incomplète");
  return data;
}
} // namespace

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "Usage : exporter_emd_obj <modele.emd> <sortie.obj>\n";
    return 2;
  }
  try {
    const std::filesystem::path source(argv[1]), sortie(argv[2]);
    std::error_code ec;
    if (std::filesystem::equivalent(source, sortie, ec)) {
      throw std::runtime_error("Les fichiers source et destination doivent être différents");
    }
    const auto data = lire(source);
    const auto scene = sf::assets::EmdScene::parse(data);
    std::ostringstream out;
    out << "# Export de geometrie EMD. Coordonnees PS1 brutes ; aucune texture.\n";
    std::size_t base = 1, triangles = 0, ignores = 0, section_id = 0;
    for (const auto &section : scene.sections()) {
      out << "o section_" << ++section_id << "\n";
      for (const auto &vertex : section.vertices)
        out << "v " << vertex.x << ' ' << vertex.y << ' ' << vertex.z << '\n';
      for (const auto &polygon : section.polygons) {
        if (!polygon.renderable || polygon.degenerate) { ++ignores; continue; }
        const auto &v = polygon.vertex_indices;
        out << "f " << base + v[0] << ' ' << base + v[1] << ' ' << base + v[2] << '\n';
        ++triangles;
        if (polygon.quad) {
          out << "f " << base + v[1] << ' ' << base + v[3] << ' ' << base + v[2] << '\n';
          ++triangles;
        }
      }
      base += section.vertices.size();
    }
    if (!out) throw std::runtime_error("Préparation du fichier OBJ impossible");
    const auto contenu = out.str();
    // Le mode x demande au système de créer la destination uniquement si elle
    // n'existe pas, y compris si le chemin désigne un lien symbolique.
    std::FILE *fichier = std::fopen(sortie.string().c_str(), "wbx");
    if (!fichier)
      throw std::runtime_error("Impossible de créer le fichier OBJ : destination existante ou inaccessible");
    const auto ecrit = std::fwrite(contenu.data(), 1, contenu.size(), fichier);
    const auto ferme = std::fclose(fichier);
    if (ecrit != contenu.size() || ferme != 0)
      throw std::runtime_error("Écriture du fichier OBJ incomplète");
    std::cout << scene.sections().size() << " section(s), " << scene.vertexCount()
              << " sommet(s), " << triangles << " triangle(s) ; " << ignores
              << " polygone(s) non affichables ignorés.\n"
              << "Coordonnées brutes, sans textures, matériaux ni animations.\n";
  } catch (const std::exception &e) {
    std::cerr << "Erreur : " << e.what() << '\n';
    return 1;
  }
  return 0;
}
