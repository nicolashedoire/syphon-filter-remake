"""Verify portable export safeguards and one real French-disc extraction."""
from pathlib import Path
import sys
import tempfile
import unittest
import shutil

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import export_level_geometry as exporter


class ResourceNameTests(unittest.TestCase):
    def test_normalizes_resource_names(self):
        self.assertEqual(exporter.validate_resource('subway2'), 'SUBWAY2')

    def test_rejects_paths_and_unbounded_names(self):
        for value in ('../PARK', '/FOG/PARK', 'PARK.FOG', '', 'A' * 9):
            with self.subTest(value=value), self.assertRaises(ValueError):
                exporter.validate_resource(value)


class FrenchDiscExportTests(unittest.TestCase):
    image_bin = ROOT / 'game-disc/Syphon Filter (France).bin'

    @unittest.skipUnless(image_bin.exists() and image_bin.stat().st_size > 100_000_000
                         and (ROOT / 'references/sf-pc-port/src/assets/emd_scene.cpp').exists()
                         and (shutil.which('clang++') or shutil.which('c++')),
                         'French disc image, reference parser, or compiler is not available')
    def test_destroyed_subway_geometry_and_no_overwrite(self):
        image = ROOT / 'game-disc/Syphon Filter (France).cue'
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'export'
            result = exporter.export_level(image, 'SUBWAY2', target)
            self.assertEqual(result['archive'], '/FOG/SUBWAY2.FOG')
            self.assertEqual(result['model_count'], 23)
            self.assertGreater(result['vertices'], 10_000)
            self.assertGreater(result['triangles'], 10_000)
            self.assertTrue((target / 'subway2.obj').is_file())
            self.assertEqual(len(list((target / 'obj').glob('*.obj'))), 23)
            with self.assertRaises(FileExistsError):
                exporter.export_level(image, 'SUBWAY2', target)


if __name__ == '__main__':
    unittest.main()
