# SCES-01911 cinematic and audio inventory

## Provenance and limits

- Source: the locally available French PS1 disc `SCES-01911`. ISO9660 directory entries enumerated with the existing `tools/export_intro.py::find_extents` reader; raw MODE2/2352 sectors read without modifying the image.
- Reproduction: from the repository root run `python3 tools/audit_ps1_media.py --output work/audit-full/new-cinematics-inventory.json`; it requires the existing CUE/BIN, Python and FFmpeg/ffprobe 9.0.2. One temporary raw extent is deleted after probing. Complete structured results, SHA-256 digests, raw-sector validation, streams and captured decoder errors are in the selected output file; a [metadata snapshot](ps1-cinematics-inventory.json) is included here.
- The ISO directory size is not the raw byte count. Each media hash covers `ceil(iso_directory_bytes/2048)` complete 2352-byte sectors including sector headers and padding. LBA is relative to the data-track start. This is a defined raw extent hash, not necessarily the logical media stream hash.
- `ffprobe -count_frames` decodes streams. The estimated duration below is decoded video frames / reported nominal frame rate, **not** a verified in-engine playback duration. No subtitles, spoken language, complete dialogue transcript or runtime event ordering were established. Filenames and directory names do not prove mission assignment.

## Findings

- The ISO directory contains **39 STR files**: 15 under `/SOL`, 9 under `/CUT`, and 15 under `/EOL`. All 39 report MDEC video at 15 fps; 35 are 320×160 and 4 are 320×240. The decoder reports a 37.8 kHz stereo XA audio stream for 38; `/SOL/SCEEP.STR` exposes no audio stream. An audio stream does not prove speech or its language.
- The combined nominal decoded video duration is about **1,256 seconds**, including logos, title and duplicated picture content. It is not a count of unique cinematic content.
- `/CUT/MUSEUM.STR` and `/CUT/MUSEUM1.STR` produce the same decoded-video MD5 `1e8b534bfd2b6eb31dd0fdf245db624d`, but different decoded-audio MD5 values `870f3ca5514b11dc3f8c7118942867b4` and `9f9143aea3e79e2985147faee323976e` respectively, with FFmpeg 9.0.2. This proves differing decoded audio bytes, **not** which languages they contain.
- `/XA/INGAMEF.XA` has ISO size 107,347,968 bytes (52,416 raw sectors, 123,282,432 bytes); raw extent SHA-256 `84c5c44f036e5c91cf4a56a254108ba1c35e6cddefd899950a23d43e48b26f99`. Its sector subheaders record 16 audio channel IDs: 0–14 and 16. FFprobe reports 16 mono 37.8 kHz XA streams but emits demux errors on this mixed file; their exact usable duration, dialogue boundaries, text, language and trigger mapping remain unverified.
- `/COMMON/INGAMEF.XH` is 272 logical bytes (SHA-256 `953c25cfd923a01e2a9dd91c9f45e4d67b6c6aeed962c9544e88937f78cd52fd`) and embeds the path `\XA\INGAMEF.XA;1`. At offsets `0x80–0x10c` the 36 little-endian words contain 35 distinct nondecreasing values, all less than the XA sector count. If interpreted as sector offsets from the XA start, every one lands on file 1, audio channel 0. This is a testable candidate index, not proof of segment boundaries, clip identities, language or execution semantics; the duplicated zero and final end boundary remain unresolved. `BEEPSX.VH`, `BEEPSX.VB` and `TITLEF.HOG` are inventoried as additional audio-related candidates, not assumed to be dialogue.
- Current web `web/game.js` plays two converted videos `intro-general.mp4` and `intro-georgia.mp4` when starting Georgia Street; `tools/export_intro.py` maps them to `/SOL/INTRO.STR` and `/SOL/SUBWAY.STR`. The title video uses a separate `title-loop.mp4`; metro currently goes straight to its reconstructed briefing. Later sequences and verified voice/dialogue triggers are not implemented.

## Video entries

| Disc path | ISO bytes | LBA | Frames | Nominal seconds | Video | Audio streams |
|---|---:|---:|---:|---:|---|---:|
| `/CUT/CAT2.STR` | 9,207,808 | 144784 | 449 | 29.933 | 320×160 / 15/1 fps | 1 |
| `/CUT/CATACOMB.STR` | 17,055,744 | 149280 | 832 | 55.467 | 320×160 / 15/1 fps | 1 |
| `/CUT/CHURCH2.STR` | 4,620,288 | 157608 | 225 | 15.0 | 320×160 / 15/1 fps | 1 |
| `/CUT/MUSEUM.STR` | 6,930,432 | 159864 | 338 | 22.533 | 320×160 / 15/1 fps | 1 |
| `/CUT/MUSEUM1.STR` | 6,930,432 | 163248 | 338 | 22.533 | 320×160 / 15/1 fps | 1 |
| `/CUT/MUSEUM2.STR` | 1,441,792 | 166632 | 70 | 4.667 | 320×160 / 15/1 fps | 1 |
| `/CUT/SILO.STR` | 12,746,752 | 167336 | 622 | 41.467 | 320×160 / 15/1 fps | 1 |
| `/CUT/SILO2.STR` | 6,275,072 | 174081 | 306 | 20.4 | 320×160 / 15/1 fps | 1 |
| `/CUT/WHOUSE.STR` | 5,718,016 | 177145 | 279 | 18.6 | 320×160 / 15/1 fps | 1 |
| `/EOL/BASE2.STR` | 2,162,688 | 180459 | 105 | 7.0 | 320×160 / 15/1 fps | 1 |
| `/EOL/BASEEXT2.STR` | 2,162,688 | 181515 | 105 | 7.0 | 320×160 / 15/1 fps | 1 |
| `/EOL/CATACOMB.STR` | 5,292,032 | 182571 | 258 | 17.2 | 320×160 / 15/1 fps | 1 |
| `/EOL/CAVE.STR` | 3,014,656 | 185155 | 147 | 9.8 | 320×160 / 15/1 fps | 1 |
| `/EOL/CAVE2.STR` | 4,112,384 | 186627 | 200 | 13.333 | 320×160 / 15/1 fps | 1 |
| `/EOL/CHOPPER.STR` | 4,243,456 | 188635 | 207 | 13.8 | 320×160 / 15/1 fps | 1 |
| `/EOL/CHURCH.STR` | 1,933,312 | 190707 | 94 | 6.267 | 320×160 / 15/1 fps | 1 |
| `/EOL/INWHOUSE.STR` | 2,506,752 | 191651 | 122 | 8.133 | 320×160 / 15/1 fps | 1 |
| `/EOL/MUSEUM.STR` | 4,734,976 | 193396 | 231 | 15.4 | 320×160 / 15/1 fps | 1 |
| `/EOL/PARK2.STR` | 3,670,016 | 195708 | 179 | 11.933 | 320×160 / 15/1 fps | 1 |
| `/EOL/SILO.STR` | 54,902,784 | 197500 | 2680 | 178.667 | 320×160 / 15/1 fps | 1 |
| `/EOL/SUBWAY.STR` | 5,636,096 | 224308 | 275 | 18.333 | 320×160 / 15/1 fps | 1 |
| `/EOL/SUBWAY2.STR` | 1,687,552 | 227581 | 82 | 5.467 | 320×160 / 15/1 fps | 1 |
| `/EOL/SUBWAY3.STR` | 1,753,088 | 228405 | 84 | 5.6 | 320×160 / 15/1 fps | 1 |
| `/EOL/WHOUSE2.STR` | 1,490,944 | 229261 | 72 | 4.8 | 320×160 / 15/1 fps | 1 |
| `/SOL/989LOGO.STR` | 1,638,400 | 36127 | 80 | 5.333 | 320×240 / 15/1 fps | 1 |
| `/SOL/BASEEXT.STR` | 38,928,384 | 37448 | 1900 | 126.667 | 320×160 / 15/1 fps | 1 |
| `/SOL/CATACOMB.STR` | 2,359,296 | 56456 | 115 | 7.667 | 320×160 / 15/1 fps | 1 |
| `/SOL/CHOPPER.STR` | 3,309,568 | 57608 | 161 | 10.733 | 320×160 / 15/1 fps | 1 |
| `/SOL/CHURCH.STR` | 30,670,848 | 59224 | 1497 | 99.8 | 320×160 / 15/1 fps | 1 |
| `/SOL/EIDETIC.STR` | 1,032,192 | 74200 | 50 | 3.333 | 320×240 / 15/1 fps | 1 |
| `/SOL/INTRO.STR` | 32,014,336 | 74704 | 1563 | 104.2 | 320×160 / 15/1 fps | 1 |
| `/SOL/MUSEUM.STR` | 27,328,512 | 90857 | 1334 | 88.933 | 320×160 / 15/1 fps | 1 |
| `/SOL/PARK.STR` | 15,958,016 | 104201 | 779 | 51.933 | 320×160 / 15/1 fps | 1 |
| `/SOL/PARK2.STR` | 7,094,272 | 111993 | 346 | 23.067 | 320×160 / 15/1 fps | 1 |
| `/SOL/SCEEP.STR` | 921,600 | 115457 | 45 | 3.0 | 320×240 / 15/1 fps | 0 |
| `/SOL/SUBWAY.STR` | 14,630,912 | 116428 | 714 | 47.6 | 320×160 / 15/1 fps | 1 |
| `/SOL/TITLE.STR` | 13,385,728 | 124093 | 649 | 43.267 | 320×240 / 15/1 fps | 1 |
| `/SOL/WHOUSE.STR` | 19,611,648 | 131150 | 957 | 63.8 | 320×160 / 15/1 fps | 1 |
| `/SOL/WHOUSE2.STR` | 7,241,728 | 140726 | 353 | 23.533 | 320×160 / 15/1 fps | 1 |

## Next verification steps

1. Observe the French game in a controlled runtime; capture which STR or XA range is requested at each mission and trigger, with disc hash, emulator build and repeatable input.
2. Decode and audition short XA segments locally to identify actual language, dialogue, speaker and boundaries; retain evidence and uncertainty. Cross-check any offset interpretation against executable behavior.
3. Compare each observed sequence, timing and transition with the current browser flow before implementing changes. Preserve the user-selected L2/R2 controls and follow camera.
