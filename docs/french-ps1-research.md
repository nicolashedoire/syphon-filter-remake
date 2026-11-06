# Technical Research — French PS1 Edition

## Disc Examined

The `Syphon Filter (France).zip` image from the [Internet Archive PlayStation Redump collection](https://archive.org/details/ef_Sony_PlayStation1_Redump_Collection_4of4) was downloaded, and its SHA-1 matches the record's metadata: `e72ca31e6f8438469ed7b358a17c8573dfb26b64`. Its CUE/BIN identifies the volume as `SCES01911`, and `SYSTEM.CNF` boots `SCES_019.11`.

The `/FOG/SUBWAY.FOG` archive is readable and contains 14 entries; `WLDEMD.HOG` contains 91 EMD models. The repository tools converted all of them to OBJ locally: 32,323 vertices and 36,021 triangles. These figures cover geometry only; textures, animated objects, and interactions remain to be investigated.

## REA Analysis

On November 6, 2026, [REA](https://github.com/morluto/rea) 6.8.0 with Rizin 0.9.1 inspected the extracted PS-X EXE executable `/SCES_019.11` locally. Its size is 1,824,768 bytes and its SHA-256 is `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. REA's generic artifact inspector does not directly recognize the PS-X EXE format, but its `execute-rizin-command` tool can disassemble 32-bit little-endian MIPS code.

The observed entry point is `0x800e44b4`; 32 instructions were disassembled there. The initial instructions include a loop that writes zeros, followed by stack setup, suggesting program initialization. **This does not yet establish how the gameplay mechanics work.** The executable was not modified. Detailed evidence files remain local.

## Browser assets

The browser prototype includes the original French disc's terrain textures, Gabe and terrorist HMD models, Gabe idle/walk/run animation poses, and 16 static objects from the initial visibility set. `web/assets/intro-general.mp4` and `intro-georgia.mp4` are converted from `/SOL/INTRO.STR` and `/SOL/SUBWAY.STR`; the original French briefing is stored in `web/assets/intro-briefing.js`. The videos retain the audio decoded from the French disc, although its spoken language has not been independently verified.

Texture streaming and palette changes are approximated by a static atlas. Room visibility, object collisions and player shooting are partial reimplementations, and the gameplay objectives are provisional. Export scripts under `tools/` can regenerate the assets from the French CUE/BIN using the pinned SF-pc-port parsers; video conversion requires FFmpeg, and atlas generation requires Pillow.

## Next Steps

- Compare the French addresses and overlays with the US release used by SF-pc-port.
- Reproduce dynamic texture and palette changes, remaining objects, and additional character animations.
- Study collision handling, controls, and mission scripts before claiming a faithful playable scene.
