"""Tests using synthetic ISO images; no game data is used."""
import importlib.util
import io
import struct
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
import sys

MODULE_PATH = Path(__file__).resolve().parents[1] / 'tools' / 'inspecter_disque_ps1.py'
spec = importlib.util.spec_from_file_location('inspecter_disque_ps1', MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


def record(name, lba, size, directory=False):
    name = name if isinstance(name, bytes) else name.encode('ascii')
    length = 33 + len(name) + (len(name) % 2 == 0)
    r = bytearray(length)
    r[0] = length
    struct.pack_into('<I', r, 2, lba)
    struct.pack_into('>I', r, 6, lba)
    struct.pack_into('<I', r, 10, size)
    struct.pack_into('>I', r, 14, size)
    r[25] = 2 if directory else 0
    r[28:32] = b'\x01\x00\x00\x01'
    r[32] = len(name)
    r[33:33 + len(name)] = name
    return r


def fixture():
    sectors = [bytearray(2048) for _ in range(27)]
    pvd = sectors[16]
    pvd[0:7] = b'\x01CD001\x01'
    pvd[40:72] = b'EXEMPLE FR'.ljust(32, b' ')
    struct.pack_into('<H', pvd, 128, 2048)
    root = record(b'\x00', 20, 2048, True)
    pvd[156:156 + len(root)] = root
    sectors[17][0:7] = b'\xffCD001\x01'
    cnf = b'BOOT = cdrom:\\SCES_019.11;1\r\nTCB = 4\r\n'
    entries = [root, record(b'\x01', 20, 2048, True), record('SYSTEM.CNF;1', 21, len(cnf)),
               record('DATA', 22, 2048, True), record('SCES_019.11;1', 24, 17)]
    body = b''.join(entries)
    sectors[20][:len(body)] = body
    sectors[21][:len(cnf)] = cnf
    subdir = b''.join([record(b'\x00',22,2048,True), record(b'\x01',20,2048,True),record('NIVEAU.FOG;1',23,2500)])
    sectors[22][:len(subdir)] = subdir
    sectors[23][:] = b'A' * 2048
    sectors[24][:452] = b'B' * 452
    return [bytes(s) for s in sectors]


def raw_sector(data, mode):
    raw = bytearray(2352)
    raw[:12] = b'\x00' + b'\xff' * 10 + b'\x00'
    raw[15] = mode
    offset = 24 if mode == 2 else 16
    raw[offset:offset + 2048] = data
    return bytes(raw)


class InspectDiscTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_iso_inventory_and_french_identity(self):
        image = self.path / 'disc.iso'
        image.write_bytes(b''.join(fixture()))
        result = mod.inspect(image)
        self.assertEqual(result['numero'], 'SCES-01911')
        self.assertTrue(result['edition_francaise_sces_01911'])
        self.assertEqual(result['executable'], 'SCES_019.11;1')
        self.assertIn({'chemin':'/DATA/NIVEAU.FOG','octets':2500}, result['fichiers'])
        self.assertEqual(len(result['fichiers']), 3)

    def test_cue_mode2_offset_and_path_with_spaces(self):
        data = [bytes(2048)] * 3 + fixture()
        (self.path / 'nom disque.bin').write_bytes(b''.join(raw_sector(x, 2) for x in data))
        cue = self.path / 'jeu.cue'
        cue.write_text('FILE "nom disque.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:03\n')
        result = mod.inspect(cue)
        self.assertEqual(result['numero'], 'SCES-01911')
        self.assertEqual(result['format_secteur'], 2352)

    def test_mode1_and_cue_2048(self):
        for mode, code in [('MODE1/2352', 1), ('MODE1/2048', 0)]:
            data = fixture()
            (self.path / 'disk.bin').write_bytes(b''.join(raw_sector(s, code) if code else s for s in data))
            cue = self.path / 'disc.cue'
            cue.write_text(f'FILE "disk.bin" BINARY\n TRACK 01 {mode}\n INDEX 01 00:00:00\n')
            self.assertEqual(mod.inspect(cue)['numero'], 'SCES-01911')

    def test_form2_is_not_misread(self):
        data = bytearray(b''.join(raw_sector(s, 2) for s in fixture()))
        data[16 * 2352 + 18] = 0x20
        (self.path / 'disk.bin').write_bytes(data)
        cue = self.path / 'disc.cue'
        cue.write_text('FILE "disk.bin" BINARY\nTRACK 01 MODE2/2352\nINDEX 01 00:00:00\n')
        with self.assertRaisesRegex(mod.ImageError, 'Form 1'):
            mod.inspect(cue)

    def test_missing_cue_bin_and_truncated_iso(self):
        cue = self.path / 'missing.cue'
        cue.write_text('FILE "absent.bin" BINARY\nTRACK 01 MODE2/2352\nINDEX 01 00:00:00\n')
        with self.assertRaisesRegex(mod.ImageError, 'introuvable'):
            mod.inspect(cue)
        image = self.path / 'tiny.iso'
        image.write_bytes(b'vide')
        with self.assertRaisesRegex(mod.ImageError, 'tronquée'):
            mod.inspect(image)

    def test_extracts_two_sectors_without_overwriting(self):
        image = self.path / 'disk.bin'
        image.write_bytes(b''.join(raw_sector(s, 2) for s in fixture()))
        cue = self.path / 'disc.cue'
        cue.write_text('FILE "disk.bin" BINARY\nTRACK 01 MODE2/2352\nINDEX 01 00:00:00\n')
        target = self.path / 'extrait.fog'
        mod.inspect(cue, ('data/niveau.fog;1', target))
        self.assertEqual(target.read_bytes(), b'A' * 2048 + b'B' * 452)
        with self.assertRaises(FileExistsError):
            mod.inspect(cue, ('/DATA/NIVEAU.FOG', target))
        self.assertEqual(target.read_bytes(), b'A' * 2048 + b'B' * 452)
        with self.assertRaisesRegex(mod.ImageError, 'introuvable'):
            mod.inspect(cue, ('/ABSENT.FOG', self.path / 'absent'))

    def test_extract_form2_cleans_partial_file(self):
        data = bytearray(b''.join(raw_sector(s, 2) for s in fixture()))
        data[24 * 2352 + 18] = 0x20
        (self.path / 'disk.bin').write_bytes(data)
        cue = self.path / 'disc.cue'
        cue.write_text('FILE "disk.bin" BINARY\nTRACK 01 MODE2/2352\nINDEX 01 00:00:00\n')
        target = self.path / 'partiel.fog'
        with self.assertRaisesRegex(mod.ImageError, 'Form 1'):
            mod.inspect(cue, ('/DATA/NIVEAU.FOG', target))
        self.assertFalse(target.exists())

    def test_cli_explicit_extraction(self):
        image = self.path / 'disc.iso'
        image.write_bytes(b''.join(fixture()))
        target = self.path / 'extrait'
        with redirect_stdout(io.StringIO()):
            self.assertEqual(mod.main([str(image), '--extraire', '/DATA/NIVEAU.FOG', '--vers', str(target)]), 0)
        self.assertEqual(target.stat().st_size, 2500)
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                mod.main([str(image), '--extraire', '/DATA/NIVEAU.FOG'])

    def test_cli_json_and_error(self):
        image = self.path / 'disc.iso'
        image.write_bytes(b''.join(fixture()))
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(mod.main([str(image), '--json']), 0)
        self.assertIn('SCES-01911', out.getvalue())
        with redirect_stderr(io.StringIO()):
            self.assertEqual(mod.main([str(self.path / 'inconnu.bin')]), 1)

if __name__ == '__main__':
    unittest.main()
