"""Synthetic EMD export checks; no game data is used."""
import pathlib
import struct
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def section(polygons):
    vertices = [(0, 0, 0), (10, 0, 0), (0, 10, 0), (10, 10, 0)]
    h = bytearray(44)
    struct.pack_into('<HH', h, 4, len(polygons), len(vertices))
    # Valid bounds: zero minimum and maximum xyz coordinates are accepted.
    struct.pack_into('<I', h, 0x14, sum(bool(p[0] & 0x80000000) for p in polygons))
    struct.pack_into('<I', h, 0x24, 44 + 16 * len(polygons))
    p = b''.join(struct.pack('<IIII', w0, w1, w2, 0) for w0, w1, w2 in polygons)
    v = b''.join(struct.pack('<hhhH', *xyz, 0) for xyz in vertices)
    return h + p + v


def scene(sections):
    header = bytearray(0xa0)
    offset = len(header)
    for n, data in enumerate(sections):
        struct.pack_into('<I', header, 4 + n * 4, offset)
        offset += len(data)
    struct.pack_into('<I', header, 4 + len(sections) * 4, 0xffffffff)
    return bytes(header) + b''.join(sections)


class TestEmdObj(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.exe = pathlib.Path(cls.temp.name) / 'exporter'
        subprocess.run(['clang++', '-std=c++20', '-O2', '-I', str(ROOT / 'references/sf-pc-port/include'),
                        str(ROOT / 'tools/exporter_emd_obj.cpp'),
                        str(ROOT / 'references/sf-pc-port/src/assets/emd_scene.cpp'), '-o', str(cls.exe)], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_export(self, data):
        folder = pathlib.Path(self.temp.name)
        infile, outfile = folder / 'test.emd', folder / 'test.obj'
        infile.write_bytes(data)
        outfile.unlink(missing_ok=True)
        result = subprocess.run([self.exe, infile, outfile], capture_output=True, text=True)
        return result, outfile

    def test_quad_and_triangle_order_with_two_sections(self):
        # Indices are stored as offsets divisible by 3.
        w2 = (3 << 16) | (6 << 24)
        quad = (0x80000001, 0, w2 | 9)
        triangle = (1, 0, w2)
        result, outfile = self.run_export(scene([section([quad]), section([triangle])]))
        self.assertEqual(result.returncode, 0, result.stderr)
        obj = outfile.read_text().splitlines()
        self.assertIn('f 1 2 3', obj)
        self.assertIn('f 2 4 3', obj)
        self.assertIn('f 5 6 7', obj)
        self.assertEqual(sum(line.startswith('v ') for line in obj), 8)
        self.assertIn('3 triangle(s)', result.stdout)

    def test_hidden_and_degenerate_are_ignored(self):
        w2 = (3 << 16) | (6 << 24)
        hidden = (0, 0, w2)
        degenerate = (1, 0, 0)
        result, outfile = self.run_export(scene([section([hidden, degenerate])]))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('\nf ', outfile.read_text())
        self.assertIn('2 polygone(s) non affichables ignorés', result.stdout)

    def test_invalid_input_does_not_create_obj(self):
        result, outfile = self.run_export(b'invalide')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(outfile.exists())

    def test_out_of_range_indices_are_rejected(self):
        invalid = (1, 0, (3 << 16) | (24 << 24))
        result, outfile = self.run_export(scene([section([invalid])]))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(outfile.exists())

    def test_existing_destination_cannot_be_overwritten(self):
        folder = pathlib.Path(self.temp.name)
        source, target = folder / 'existe.emd', folder / 'existe.obj'
        source.write_bytes(scene([section([(1, 0, (3 << 16) | (6 << 24))])]))
        target.write_bytes(b'conserver')
        result = subprocess.run([self.exe, source, target], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_bytes(), b'conserver')

    def test_source_cannot_be_overwritten(self):
        path = pathlib.Path(self.temp.name) / 'source.emd'
        original = scene([section([(1, 0, (3 << 16) | (6 << 24))])])
        path.write_bytes(original)
        result = subprocess.run([self.exe, path, path], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
