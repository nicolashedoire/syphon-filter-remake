import importlib.util
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from archives_syphon import ArchiveError, extract, parse_fog, parse_hog


def fog_fixture():
    data = bytearray(3 * 2048)
    struct.pack_into('<IIII', data, 0, 0, 3, 0, 0)
    struct.pack_into('<16sII', data, 16, b'WLDEMD.HOG', 1, 1)
    struct.pack_into('<16sII', data, 40, b'NEXT.DAT', 2, 1)
    data[2048:2051] = b'abc'
    data[4096:4099] = b'def'
    return bytes(data)


def hog_fixture():
    names = b'FIRST.EMD\0SECOND.EMD\0'
    name_offset = 28
    data_offset = name_offset + len(names)
    return (struct.pack('<IIIII', 123, 2, 20, name_offset, data_offset) +
            struct.pack('<II', 0, 3) + names + b'abcdefg')


class ArchivesTests(unittest.TestCase):
    def test_fog_entries_and_pal_truncated_tail(self):
        data = fog_fixture()
        entries = parse_fog(data)
        self.assertEqual([(e.name, e.offset, e.size) for e in entries],
                         [('WLDEMD.HOG', 2048, 2048), ('NEXT.DAT', 4096, 2048)])
        altered = bytearray(data)
        struct.pack_into('<I', altered, 4, 4)
        self.assertEqual(len(parse_fog(bytes(altered))), 2)

    def test_fog_corrupt_or_overlapping(self):
        data = bytearray(fog_fixture())
        struct.pack_into('<I', data, 40 + 16, 1)
        with self.assertRaises(ArchiveError):
            parse_fog(data)
        data = bytearray(fog_fixture())
        struct.pack_into('<I', data, 16 + 20, 10)
        with self.assertRaises(ArchiveError):
            parse_fog(data)
        with self.assertRaises(ArchiveError):
            parse_fog(b'bad')

    def test_hog_entries_and_case_insensitive_extract(self):
        data = hog_fixture()
        entries = parse_hog(data)
        self.assertEqual([(e.name, e.size) for e in entries], [('FIRST.EMD', 3), ('SECOND.EMD', 4)])
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'destination.emd'
            extract(data, entries, 'second.emd', output)
            self.assertEqual(output.read_bytes(), b'defg')
            with self.assertRaises(FileExistsError):
                extract(data, entries, 'first.emd', output)
            self.assertEqual(output.read_bytes(), b'defg')

    def test_hog_bad_offsets_and_names(self):
        data = bytearray(hog_fixture())
        struct.pack_into('<I', data, 20, 1)
        with self.assertRaises(ArchiveError):
            parse_hog(data)
        data = bytearray(hog_fixture())
        struct.pack_into('<I', data, 24, 9999)
        with self.assertRaises(ArchiveError):
            parse_hog(data)
        data = hog_fixture().replace(b'SECOND.EMD', b'FIRST.EMD\x00', 1)
        with self.assertRaises(ArchiveError):
            parse_hog(data)

    def test_cli_and_explicit_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'f.fog'
            target = Path(tmp) / 'file.hog'
            path.write_bytes(fog_fixture())
            command = [sys.executable, str(ROOT / 'tools/archives_syphon.py'), 'fog', str(path)]
            listed = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(listed.returncode, 0, listed.stderr)
            self.assertIn('WLDEMD.HOG', listed.stdout)
            result = subprocess.run(command + ['--extraire', 'WLDEMD.HOG', '--vers', str(target)], text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(target.read_bytes()[:3], b'abc')
            bad = subprocess.run(command + ['--extraire', 'INCONNU', '--vers', str(Path(tmp) / 'autre')], text=True, capture_output=True)
            self.assertNotEqual(bad.returncode, 0)


if __name__ == '__main__':
    unittest.main()
