"""Tests for OBJ merging and local data protection."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import preparer_geometrie as preparation


class TestGeometrie(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_fusion_decale_les_faces_de_chaque_modele(self):
        a = self.root / 'a.obj'
        b = self.root / 'b.obj'
        a.write_text('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
        b.write_text('v 1 1 1\nv 2 1 1\nv 1 2 1\nf 1 3 2\n')
        sortie = self.root / 'assemble.obj'
        self.assertEqual(preparation.fusionner([a, b], sortie), (6, 2))
        contenu = sortie.read_text()
        self.assertIn('f 1 2 3\n', contenu)
        self.assertIn('f 4 6 5\n', contenu)
        with self.assertRaises(FileExistsError):
            preparation.fusionner([a], sortie)
        self.assertEqual(sortie.read_text(), contenu)

    def test_rejette_une_face_hors_limites(self):
        a = self.root / 'a.obj'
        a.write_text('v 0 0 0\nv 1 0 0\nf 1 2 3\n')
        with self.assertRaisesRegex(ValueError, 'hors limites'):
            preparation.fusionner([a], self.root / 'sortie.obj')

    def test_refuse_un_dossier_deja_existant(self):
        fake_repo = self.root / 'repo'
        (fake_repo / 'references/sf-pc-port/include').mkdir(parents=True)
        (fake_repo / 'references/sf-pc-port/src/assets').mkdir(parents=True)
        (fake_repo / 'references/sf-pc-port/src/assets/emd_scene.cpp').touch()
        image = self.root / 'image.iso'
        image.touch()
        sortie = self.root / 'ne-pas-toucher'
        sortie.mkdir()
        garde = sortie / 'personnel.txt'
        garde.write_text('intact')
        with patch.object(preparation, 'ROOT', fake_repo), patch.object(preparation.shutil, 'which', return_value='/usr/bin/true'):
            with self.assertRaises(FileExistsError):
                preparation.preparer(image, sortie)
        self.assertEqual(garde.read_text(), 'intact')


if __name__ == '__main__':
    unittest.main()
