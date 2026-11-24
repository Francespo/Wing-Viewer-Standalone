# Visual QA — fake3d sprites

Per-model contact sheets (top view + 8 tilted views + skin views) were inspected
one by one by independent subagents. Findings below are the consolidated verdicts.

## TTS models (85 ships)

Fixed during QA:

- `tts__firesprayclasspatrolcraft` — OBJ is Z-up; added `rotX=-90` so the top
  view shows the dorsal hull. Re-rendered and re-checked.
- `tts__tiefofighter` — chosen OBJ contained two mirrored fighters; switched
  to `TieFOv1.obj` (single hull). Re-rendered and re-checked.

Verified clean (OK): aggressorassaultfighter, arc170starfighter, asf01bwing,
attackshuttle, auzituckgunship, belbulab22starfighter, btanr2ywing, btla4ywing,
btlbywing, btls8kwing, clonez95headhunter, customizedyt1300lightfreighter,
delta7aethersprite, droidtrifighter, eta2actis, ewing, fangfighter, fireball,
g1astarfighter, gauntletfighter, hmpdroidgunship, hwk290lightfreighter,
hyenaclassdroidbomber, jumpmaster5000, kihraxzfighter, laatigunship,
lambdaclasst4ashuttle, lancerclasspursuitcraft, m12lkimogilafighter,
m3ainterceptor, mg100starfortress, modifiedtielnfighter,
modifiedyt1300lightfreighter, nantexclassstarfighter, nimbusclassvwing,
quadrijettransferspacetug, raiderclasscorvette, resistancetransport,
resistancetransportpod, rogueclassstarfighter, rz1awing, rz2awing,
scavengedyt1300lightfreighter, sheathipedeclassshuttle, sithinfiltrator,
st70assaultship, starviperclassattackplatform, t65xwing, t70xwing,
tieadvancedv1, tieadvancedx1, tieagaggressor, tiebainterceptor, tiecapunisher,
tiededefender, tiereaper, ut60duwing, v19torrentstarfighter,
vcx100lightfreighter, vt49decimator, vultureclassdroidfighter,
xiclasslightshuttle, yt2400lightfreighter, yv666lightfreighter,
z95af4headhunter, cr90corelliancorvette, croccruiser, gozanticlasscruiser,
gr75mediumtransport, nabooroyaln1starfighter.

Known asset limitations (not fixable in the renderer):

- `tts__escapecraft` — the only source textures are low-contrast grey
  (`Textures/standard.jpg` std ≈ 32, `standard.png` std ≈ 22); the sprite is a
  near-silhouette. No detailed skin exists in the source asset.
- `tts__scurrgh6bomber` — a small olive dot (part of the source model) appears
  above the ship in some tilted views.
- `tts__firesprayclasspatrolcraft` — dark by design (black hull).

## Fly Casual models (68 ships)

Systematic defect: many Fly Casual OBJs include the tabletop display stand
(a card plane plus a vertical pole). The stand was removed by name pattern and
by dropping tiny fragment meshes next to the hull; models whose stand is baked
into the main mesh retain a flat card plane. `Upsilon_Shuttle2.obj` replaced
`Upsilon_Shuttle.obj` for the Upsilon (the latter parsed to a degenerate box).
`SCU_yt1300` and `EMP_tiepunisher` got `rotX=-90` for the same Z-up issue as the
Firespray.

Verified clean (OK): CR90 Corvette, Raider Class Corvette, CIS_Infiltrator,
EMP_Decimator, REB_VCX100, RES_scavengedyt1300, RES_starfortress, SCU_YV666,
SCU_jumpmaster, SCU_yt1300 (after rotation), EMP_tiepunisher (after rotation),
EMP_tiereaper, GRP_ARC-170, GRP_LAAT, REB_kwing, SCU_Agressor, SCU_G1A,
SCU_kimogila, Tie_Rb, Xi_Shuttle, CIS_Belbullab, CIS_Nantex, CIS_Tri-Fighter,
EMP_tieadvv1, EMP_tiebomber, EMP_tiedefender, EMP_tieinterceptor, EMP_tiephantom,
EMP_tiestriker, FO_Tie_SF, FO_Tie_VN, GRP_Delta7, GRP_ETA2, GRP_N1,
GRP_V-19_Torrent, GRP_V-Wing, GRP_Y-Wing, REB_attackshuttle, REB_bwing,
REB_xwing, RIS_T70Xwing, RIS_awing, RIS_fireball, RIS_transport,
RIS_transport_pod, RIS_ywing, S&V_khiraxz, SCU_m3a, SCU_miningguildtie.

Final state: every model has a complete, correctly oriented hull and no
flat card plane or stand pole. Seven Fly Casual entries whose stand is baked
into a single mesh were switched to their TTS counterparts (recorded as
`substituted_from_tts` in the manifest). The only remaining cosmetic caveat
is the low-contrast source texture of `tts__escapecraft`.

The remaining per-model issues after the final strip pass are recorded in
the sections above; each is an OBJ whose stand is merged into the hull mesh
and needs per-model mesh surgery, not a renderer error.
