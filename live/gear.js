'use strict';
/*
 * GEAR GUIDES (#105). Richard at a club: "Using an S11 tonight and was no instructions for that. We should have all
 * gear someone would realistically come across."
 * One list of the mixers, all-in-ones and players a booth is likely to have, from each maker's spec pages / manuals
 * (sources: docs/wiki/gear.md). It drives:
 *  - SET UP SOUND IN (soundsetup.js): which output to plug the sound card into, the jack, the cable, what to watch for.
 *  - The DJ network advice: does this mixer join the DJ network (a LINK port) so GHOST LINK gets ON AIR? If not,
 *    what still works, in plain words. "No mixer on the DJ network" names the mixer, or offers WHICH MIXER?.
 * The public twin is site/www/help/mixers/index.html and docs/wiki/gear.md: keep the three in step (GearGuideTest
 * checks every id is on both). Where a fact couldn't be checked against the maker, the text says
 * "check the back panel", never a guess.
 * Pure data + logic here (Node tests: src/test/js/gear.test.js); the dashboard parts are in gearpick.js.
 */
const Gear = (() => {
  // ---- outputs: how each kind behaves ----
  // follows: 'none' = fixed, no knob of its own (REC OUT on most DJMs), 'master' = follows MASTER LEVEL,
  //          'booth' = its own BOOTH level knob, 'own' = its own level knob, 'check' = not confirmed.
  const JACK = {
    RCA: { jack: 'RCA', cable: 'An RCA to RCA cable (red and white, both ends).' },
    TRS: { jack: '1/4-inch', cable: 'A 2 x 1/4-inch jack to 2 x RCA cable (the output is two 1/4-inch jacks, L and R).' },
    XLR: { jack: 'XLR', cable: 'A 2 x XLR (male) to 2 x RCA cable. XLR is louder: watch the meter.' },
    MINI: { jack: '3.5 mm', cable: 'A 3.5 mm (mini jack) to 2 x RCA cable.' },
  };

  // ---- the list ----
  // kind: mixer | allinone | laptop | none | other. link: 'yes' | 'no' | 'check'. top: on the short list (order).
  // out: [name, jack, follows, extra?] the output to use. alt: the second choice. watch: one line to watch for.
  // also: other spellings found in a venue's GEAR notes or on the DJ network (letters and digits only, upper case).
  // #161: outputs many models share (see outputs() below for the shape)
  const REC_OUT = ['REC OUT', 'RCA', 'none', '', 'rec'];
  const M2 = ['MASTER 2', 'RCA', 'master', 'MASTER LEVEL', 'free'];
  const M1 = ['MASTER 1', 'XLR', 'master', 'MASTER LEVEL', 'pa', 'The PA feed: only with the venue\'s OK, on a Y split. XLR is hot for a small card: watch the meter.'];
  const PH = ['PHONES', 'TRS', 'own', 'headphones LEVEL', 'never'];
  const USBA = ['USB', 'USB', 'check', '', 'usb'];
  const DIG_COAX = ['DIGITAL MASTER OUT', 'COAX', 'master', 'MASTER LEVEL', 'digital'];
  const DIG_AES = ['DIGITAL MASTER OUT', 'XLR', 'master', 'MASTER LEVEL', 'digital', 'AES/EBU digital on an XLR socket: not a line out.'];
  const SEND = ['SEND', 'TRS', 'check', 'SEND LEVEL', 'fx'];
  const SENDS = ['SEND (EXT1, EXT2, MULTI I/O)', 'TRS', 'check', '', 'fx'];
  const LIST = [
    // ---- Pioneer DJ / AlphaTheta club mixers (LINK port, REC OUT) ----
    // #161 outs from each model's Operating Instructions (rear panel, specs, block diagram): docs/wiki/gear.md SOURCES.
    // REC OUT on these is before MASTER LEVEL (their block diagrams), -8 dBu RCA: the best match for a USB sound card.
    { id: 'DJM-900NXS2', name: 'DJM-900NXS2', short: '900NXS2', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 1,
      outs: [REC_OUT, M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, DIG_COAX, SEND, PH, USBA] },
    { id: 'DJM-A9', name: 'DJM-A9', short: 'A9', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 2,
      outs: [REC_OUT, M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, DIG_COAX, SEND, PH, USBA] },
    { id: 'DJM-V10-LF', name: 'DJM-V10-LF', short: 'V10-LF', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', also: ['V10LF'],
      outs: [REC_OUT, M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, DIG_AES, SENDS, PH, USBA] },
    { id: 'DJM-V10', name: 'DJM-V10', short: 'V10', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 3,
      outs: [REC_OUT, M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, DIG_AES, SENDS, PH, USBA] },
    { id: 'DJM-900NXS', name: 'DJM-900NXS', short: '900NXS', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes',
      outs: [REC_OUT, M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, DIG_COAX, SEND, PH, USBA] },
    // ---- Pioneer DJ mixers with no LINK port and no REC OUT jack (their MIX (REC OUT) is a USB stream only) ----
    { id: 'DJM-750MK2', name: 'DJM-750MK2', short: '750MK2', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, SEND, PH, USBA],
      watch: 'No REC OUT jack on this one: MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-450', name: 'DJM-450', short: '450', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, M1, PH, USBA],
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare (some venues use it for the booth). It follows MASTER, so the recording moves with the room.' },
    { id: 'DJM-250MK2', name: 'DJM-250MK2', short: '250MK2', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, M1, PH, USBA],
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare (some venues use it for the booth). It follows MASTER, so the recording moves with the room.' },
    { id: 'DJM-S11', name: 'DJM-S11', short: 'S11', maker: 'Pioneer DJ', kind: 'mixer', link: 'no', top: 4,
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, PH, USBA],
      watch: 'A battle mixer: no REC OUT jack and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S9', name: 'DJM-S9', short: 'S9', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR LEVEL', 'booth'], M1, PH, USBA],
      watch: 'A battle mixer: no REC OUT jack and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S7', name: 'DJM-S7', short: 'S7', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, PH, USBA],
      watch: 'A battle mixer: no REC OUT jack and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S5', name: 'DJM-S5', short: 'S5', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [['BOOTH/MASTER 2', 'RCA', 'booth', 'BOOTH LEVEL', 'free', 'One RCA pair: BOOTH out of the box (its BOOTH LEVEL knob); set to MASTER in the utility settings, it follows MASTER instead.'], M1, PH, USBA],
      watch: 'One RCA pair is BOOTH or MASTER 2 (a utility setting; BOOTH out of the box, with the BOOTH LEVEL knob). Set to MASTER it follows MASTER instead. It runs quiet (-6 dBu): turn it up if the meter is low.' },
    { id: 'DJM-S3', name: 'DJM-S3', short: 'S3', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      outs: [M2, M1, PH, USBA],
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER, so the recording moves with the room.' },
    // ---- Pioneer DJ / AlphaTheta all-in-ones ----
    // #161: no REC OUT jack on any of these (MASTER REC records to a USB stick inside). MASTER 2 (RCA, +2 dBu) follows MASTER.
    { id: 'XDJ-XZ', name: 'XDJ-XZ', short: 'XDJ-XZ', maker: 'All-in-one', kind: 'allinone', link: 'yes', top: 5,
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, SEND, PH, USBA],
      watch: 'No REC OUT on the XDJ-XZ. MASTER 2 is the RCA copy of the master (MASTER 1 is the big XLR pair).',
      netNote: 'GHOST LINK reads its own decks and its mixer from there; up to 2 extra players go in its LINK (CH3/CH4) sockets.' },
    { id: 'XDJ-RX3', name: 'XDJ-RX3', short: 'XDJ-RX3', maker: 'All-in-one', kind: 'allinone', link: 'no', top: 6,
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.' },
    { id: 'XDJ-RX2', name: 'XDJ-RX2', short: 'XDJ-RX2', maker: 'All-in-one', kind: 'allinone', link: 'no',
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-RX2 has no LINK port GHOST LINK can use: no titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'XDJ-RX', name: 'XDJ-RX', short: 'XDJ-RX', maker: 'All-in-one', kind: 'allinone', link: 'no',
      outs: [M2, ['BOOTH OUT', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-RX\'s LINK socket is only for rekordbox on a laptop. Leave GHOST LINK off it: tools like this are reported to crash it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'XDJ-RR', name: 'XDJ-RR', short: 'XDJ-RR', maker: 'All-in-one', kind: 'allinone', link: 'no',
      outs: [M2, M1, PH, USBA],
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER.' },
    { id: 'XDJ-AZ', name: 'XDJ-AZ', short: 'XDJ-AZ', maker: 'All-in-one', kind: 'allinone', link: 'check',
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-AZ has a LINK port, but GHOST LINK hasn\'t been tried with one and the library it\'s built on doesn\'t read it yet: expect no titles.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'OPUS-QUAD', name: 'OPUS-QUAD', short: 'OPUS-QUAD', maker: 'All-in-one', kind: 'allinone', link: 'check', also: ['OPUSQUAD', 'OPUS'],
      outs: [M2, ['ZONE', 'XLR', 'own', 'ZONE', 'zone', 'Set ZONE ASSIGN to MASTER and it carries the mix whatever the MASTER knob says. XLR: an XLR to RCA cable, and watch the meter.'],
        ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The OPUS-QUAD\'s LINK socket is for rekordbox, not other players. GHOST LINK hasn\'t been tried with one: at best a limited view, no titles yet.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'OMNIS-DUO', name: 'OMNIS-DUO', short: 'OMNIS-DUO', maker: 'All-in-one', kind: 'allinone', link: 'no', also: ['OMNISDUO'],
      outs: [['BOOTH/MASTER 2', 'RCA', 'booth', 'BOOTH', 'free', 'One RCA pair: BOOTH out of the box (its BOOTH knob); set to MASTER in the settings it carries the master.'], M1, PH, USBA],
      watch: 'One RCA pair is BOOTH or MASTER 2 (a setting; BOOTH out of the box, with the BOOTH LEVEL knob). If the booth speaker is on it, there is no other free out.' },
    // ---- Pioneer DJ / AlphaTheta controllers (a laptop runs them; their REC OUT is a USB stream, not a jack) ----
    { id: 'DDJ-FLX10', name: 'DDJ-FLX10', short: 'DDJ-FLX10', maker: 'Controllers', kind: 'controller', link: 'no', also: ['DDJFLX10', 'FLX10'],
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT jack: MASTER 2 is the RCA copy of the master. The 3-pin XLR marked DMX is lighting, not sound.' },
    { id: 'DDJ-1000', name: 'DDJ-1000', short: 'DDJ-1000', maker: 'Controllers', kind: 'controller', link: 'no', also: ['DDJ1000', 'DDJ1000SRT'],
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR LEVEL', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT jack: MASTER 2 is the RCA copy of the master.' },
    { id: 'DDJ-REV7', name: 'DDJ-REV7', short: 'DDJ-REV7', maker: 'Controllers', kind: 'controller', link: 'no', also: ['DDJREV7', 'REV7'],
      outs: [M2, ['BOOTH', 'TRS', 'booth', 'BOOTH LEVEL', 'booth'], M1, PH, USBA],
      watch: 'No REC OUT jack: MASTER 2 is the RCA copy of the master.' },
    // ---- Rane ----
    // #161: Rane's record out is SESSION OUT (RCA) with its own SESSION knob; whether MAIN also moves it isn't stated.
    { id: 'RANE-72MK2', name: 'Rane Seventy-Two MKII', short: 'RANE 72 MKII', maker: 'Rane', kind: 'mixer', link: 'no', also: ['SEVENTYTWOMKII', 'SEVENTYTWOMK2', 'RANE72MKII', 'RANE72MK2'],
      outs: [['SESSION OUT', 'RCA', 'own', 'SESSION OUT', 'rec'], ['BOOTH OUT', 'TRS', 'booth', 'BOOTH', 'booth'], ['MAIN OUT', 'XLR', 'master', 'MAIN', 'pa', M1[5]], PH, USBA],
      watch: 'Rane\'s record out is called SESSION OUT, with its own knob on the top panel.' },
    { id: 'RANE-72', name: 'Rane Seventy-Two', short: 'RANE 72', maker: 'Rane', kind: 'mixer', link: 'check', also: ['SEVENTYTWO', 'RANE72'],
      outs: [['SESSION OUT', 'RCA', 'own', 'SESSION OUT', 'rec'], ['BOOTH OUT', 'TRS', 'booth', 'BOOTH', 'booth'], ['MAIN OUT', 'XLR', 'master', 'MAIN', 'pa', M1[5]], PH, USBA],
      watch: 'Rane\'s record out is called SESSION OUT, with its own knob.' },
    { id: 'RANE-70', name: 'Rane Seventy', short: 'RANE 70', maker: 'Rane', kind: 'mixer', link: 'no', also: ['RANESEVENTY', 'RANE70'],
      outs: [['SESSION OUT', 'RCA', 'own', 'SESSION OUT', 'rec'], ['BOOTH OUT', 'TRS', 'booth', 'BOOTH', 'booth'], ['MAIN OUT', 'XLR', 'master', 'MAIN', 'pa', M1[5]], PH, USBA],
      watch: 'Rane\'s record out is called SESSION OUT, with its own knob.' },
    { id: 'RANE-70A', name: 'Rane Seventy-A', short: 'RANE 70-A', maker: 'Rane', kind: 'mixer', link: 'check', also: ['SEVENTYA', 'SEVENTYATRAK'],
      out: ['SESSION OUT', 'RCA', 'check'], alt: 'Check the back panel for BOOTH (1/4-inch jacks).',
      watch: 'Not checked against Rane\'s manual: check the back panel. On Rane mixers the record out is usually SESSION OUT.' },
    { id: 'RANE-12MK2', name: 'Rane Twelve MKII', short: 'RANE 12 MKII', maker: 'Rane', kind: 'controller', link: 'no', also: ['TWELVEMKII', 'TWELVEMK2', 'RANE12MKII', 'RANE12MK2', 'RANETWELVE'],
      via: 'A turntable-style controller, not a mixer: its only audio out carries timecode for the DJ software, not music. Plug the sound card into the mixer it works with (often a Seventy-Two MKII) and pick that mixer.',
      outs: [['AUDIO OUT', 'RCA', 'check', '', 'never', 'Timecode for the DJ software, not music.'], USBA],
      out: ['the mixer\'s output', 'RCA', 'check'], where: 'a spare output on the mixer it works with (pick that mixer above)', alt: 'Pick the mixer the Twelve MKII plays through: it lists that mixer\'s outputs.' },
    { id: 'RANE-MP2015', name: 'Rane MP2015', short: 'MP2015', maker: 'Rane', kind: 'mixer', link: 'no', also: ['MP2015'],
      outs: [['SESSION OUT', 'RCA', 'own', 'SESSION OUT', 'rec'], ['BOOTH OUT', 'TRS', 'booth', 'BOOTH', 'booth'], ['MAIN OUT', 'XLR', 'own', 'MAIN', 'pa', M1[5]],
        ['SESSION OUT S/PDIF', 'COAX', 'own', 'SESSION OUT', 'digital'], ['FX SEND', 'RCA', 'check', '', 'fx'], PH, USBA],
      watch: 'Every output has its own level knob; SESSION is the RCA one, and it doesn\'t move with MAIN.' },
    { id: 'RANE-FOUR', name: 'Rane Four', short: 'RANE FOUR', maker: 'Rane', kind: 'mixer', link: 'no', also: ['RANEFOUR'],
      outs: [['MAIN OUT (RCA)', 'RCA', 'check', '', 'free', 'The RCA pair next to the XLR pair: whether the MAIN knob moves it isn\'t stated by Rane.'], ['BOOTH/ZONE', 'TRS', 'booth', 'BOOTH/ZONE', 'booth'], ['MAIN OUT (XLR)', 'XLR', 'master', 'MAIN', 'pa', M1[5]], PH, USBA],
      watch: 'No REC OUT: the RCA MAIN OUT is the spare for a recorder.' },
    // ---- Allen & Heath ----
    // #161: RECORD is before the master knobs on every Xone here (A&H: "Pre-MASTER level, LR MIX output"), except the 23C (not stated).
    { id: 'XONE-92', name: 'Xone:92', short: 'XONE:92', maker: 'Allen & Heath', kind: 'mixer', link: 'no', top: 7, also: ['XONE92'],
      outs: [['RECORD', 'RCA', 'none', '', 'rec'], ['MIX 2', 'TRS', 'own', 'MIX 2', 'zone'], ['BOOTH', 'TRS', 'booth', 'BOOTH MONITOR', 'booth'], ['MIX 1', 'XLR', 'own', 'MIX 1', 'pa', M1[5]],
        ['AUX 1 / AUX 2', 'TRS', 'check', '', 'fx'], PH],
      level: 'RECORD comes before the MIX knobs: it has no knob, the loud parts sit wherever the mix sits. Mics are left out of it by default.' },
    { id: 'XONE-96', name: 'Xone:96', short: 'XONE:96', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE96'],
      outs: [['RECORD', 'RCA', 'none', '', 'rec'], ['AUDIO SYNC OUT', 'MINI', 'none', '', 'free', 'A&H: a second record out, before the MASTER knobs (3.5 mm).'], ['MST 2', 'TRS', 'own', 'MASTER 2', 'zone'],
        ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MST 1', 'XLR', 'own', 'MASTER 1', 'pa', M1[5]], ['SND 1 / SND 2', 'TRS', 'check', '', 'fx'], PH, USBA],
      level: 'RECORD comes before the MASTER knobs: it has no knob, the loud parts sit wherever the mix sits.',
      net: ['The Xone:96 has no LINK port for the DJ network (its X:LINK socket is only for Xone controllers).',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) and SOUND IN. Missing: ON AIR and fader info.'] },
    { id: 'XONE-PX5', name: 'Xone:PX5', short: 'XONE:PX5', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONEPX5', 'PX5'],
      outs: [['RECORD', 'RCA', 'none', '', 'rec'], ['MASTER 2', 'RCA', 'master', 'MASTER', 'free'], ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MASTER 1', 'XLR', 'master', 'MASTER', 'pa', M1[5]],
        ['FX SEND', 'TRS', 'check', '', 'fx'], PH, USBA],
      level: 'RECORD comes before the MASTER knob: it has no knob, the loud parts sit wherever the mix sits.',
      net: ['The Xone:PX5 has no LINK port for the DJ network (its X:LINK socket is only for Xone controllers).',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) and SOUND IN. Missing: ON AIR and fader info.'] },
    { id: 'XONE-43C', name: 'Xone:43C', short: 'XONE:43C', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE43C'],
      outs: [['RECORD', 'RCA', 'none', '', 'rec'], ['BOOTH', 'RCA', 'booth', 'BOOTH', 'booth'], ['MASTER', 'XLR', 'own', 'MASTER', 'pa', M1[5]], ['X:FX SEND', 'RCA', 'check', '', 'fx'], PH, USBA],
      level: 'RECORD comes before the master knob: it has no knob, the loud parts sit wherever the mix sits.' },
    { id: 'XONE-43', name: 'Xone:43', short: 'XONE:43', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE43'],
      outs: [['RECORD', 'RCA', 'none', '', 'rec'], ['BOOTH', 'RCA', 'booth', 'BOOTH', 'booth'], ['MASTER', 'XLR', 'own', 'MASTER', 'pa', M1[5]], ['X:FX SND', 'RCA', 'check', '', 'fx'], PH],
      level: 'RECORD comes before the master knob: it has no knob, the loud parts sit wherever the mix sits.' },
    { id: 'XONE-23C', name: 'Xone:23C', short: 'XONE:23C', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE23C'],
      outs: [['RECORD', 'RCA', 'check', '', 'rec'], ['MONITOR', 'RCA', 'own', 'MONITOR', 'booth'], ['MAIN', 'XLR', 'own', 'MASTER', 'pa', M1[5]], ['FX SND', 'RCA', 'check', '', 'fx'], PH, USBA] },
    // ---- Denon DJ ----
    // #161: Denon's guides name no knob for the X1850 / X1800 RECORD out and don't say if MASTER moves it: 'check'.
    { id: 'X1850', name: 'Denon DJ X1850 PRIME', short: 'X1850', maker: 'Denon DJ', kind: 'mixer', link: 'no', also: ['X1850PRIME', 'X1850'],
      outs: [['RECORD', 'RCA', 'check', '', 'rec', 'No knob of its own on the panel; whether MASTER moves it isn\'t stated by Denon.'], ['MASTER (RCA)', 'RCA', 'master', 'MASTER', 'free'],
        ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MASTER (XLR)', 'XLR', 'master', 'MASTER', 'pa', M1[5]], ['DIGITAL OUT', 'COAX', 'check', '', 'digital'], ['SEND', 'TRS', 'check', '', 'fx'], PH, USBA],
      net: ['The X1850\'s LINK ports are Denon\'s own (Engine), not the Pioneer DJ network GHOST LINK reads: ON AIR can\'t come from it.',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) from any Pioneer players, and SOUND IN.'] },
    { id: 'X1800', name: 'Denon DJ X1800 PRIME', short: 'X1800', maker: 'Denon DJ', kind: 'mixer', link: 'no', also: ['X1800PRIME', 'X1800'],
      outs: [['RECORD', 'RCA', 'check', '', 'rec', 'No knob of its own on the panel; whether MASTER moves it isn\'t stated by Denon.'], ['MASTER (RCA)', 'RCA', 'master', 'MASTER', 'free'],
        ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MASTER (XLR)', 'XLR', 'master', 'MASTER', 'pa', M1[5]], ['DIGITAL OUT', 'COAX', 'check', '', 'digital'], ['SEND', 'TRS', 'check', '', 'fx'], PH, USBA],
      net: ['The X1800\'s LINK ports are Denon\'s own (Engine), not the Pioneer DJ network GHOST LINK reads: ON AIR can\'t come from it.',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) from any Pioneer players, and SOUND IN.'] },
    { id: 'PRIME-4', name: 'Denon DJ PRIME 4+', short: 'PRIME 4+', maker: 'Denon DJ', kind: 'allinone', link: 'no', also: ['PRIME4PLUS', 'PRIME4'],
      outs: [['MASTER (RCA)', 'RCA', 'master', 'MASTER', 'free'], ['ZONE', 'XLR', 'own', 'ZONE', 'zone', 'XLR: an XLR to RCA cable, and watch the meter.'], ['BOOTH', 'XLR', 'booth', 'BOOTH', 'booth'],
        ['MASTER (XLR)', 'XLR', 'master', 'MASTER', 'pa', M1[5]], PH, USBA],
      where: 'MASTER, the RCA pair on the back (the PA is usually on the XLR pair)',
      watch: 'No REC OUT: the RCA MASTER is the spare when the PA is on the XLR pair.',
      net: ['A Denon all-in-one: its LINK port speaks Denon\'s own language (StageLinQ), not the Pioneer DJ network. No titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording).'] },
    { id: 'PRIME-GO', name: 'Denon DJ PRIME GO / GO+', short: 'PRIME GO', maker: 'Denon DJ', kind: 'allinone', link: 'no', also: ['PRIMEGOPLUS', 'PRIMEGO'],
      outs: [['MASTER (RCA)', 'RCA', 'master', 'MASTER', 'free'], ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MASTER (XLR)', 'XLR', 'master', 'MASTER', 'pa', M1[5]], PH, USBA],
      where: 'MASTER, the RCA pair on the back (the PA is usually on the XLR pair)',
      watch: 'No REC OUT: the RCA MASTER is the spare when the PA is on the XLR pair.',
      net: ['A Denon all-in-one: it doesn\'t join the Pioneer DJ network. No titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording).'] },
    { id: 'SC-LIVE-4', name: 'Denon DJ SC LIVE 4', short: 'SC LIVE 4', maker: 'Denon DJ', kind: 'allinone', link: 'no', also: ['SCLIVE4', 'SCLIVE'],
      outs: [['MAIN (RCA)', 'RCA', 'master', 'MAIN VOLUME', 'free'], ['BOOTH', 'TRS', 'own', 'SPEAKER/BOOTH LEVEL', 'booth', 'Its knob also sets the built-in speakers.'], ['MAIN (XLR)', 'XLR', 'master', 'MAIN VOLUME', 'pa', M1[5]], PH, USBA],
      where: 'MAIN, the RCA pair on the back (the PA is usually on the XLR pair)',
      watch: 'No REC OUT: the RCA MAIN is the spare when the PA is on the XLR pair.',
      net: ['A Denon all-in-one: it doesn\'t join the Pioneer DJ network. No titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording).'] },
    // ---- the rest ----
    { id: 'MODEL-1', name: 'PLAYdifferently MODEL 1', short: 'MODEL 1', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['PLAYDIFFERENTLYMODEL1', 'MODEL1'],
      outs: [['RECORD OUT', 'MINI', 'none', '', 'rec', 'The 3.5 mm socket on the top panel, in the master section: a 3.5 mm to 2 x RCA cable.'], ['MASTER 2', 'TRS', 'own', 'MASTER 2', 'zone'],
        ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'], ['MASTER 1', 'XLR', 'own', 'MASTER 1', 'pa', M1[5]], ['AUX 1 / AUX 2', 'TRS', 'check', '', 'fx'], PH],
      where: 'RECORD OUT, the 3.5 mm (mini jack) socket on the top panel',
      level: 'RECORD OUT comes before the master level (after the master EQ): no knob, the loud parts sit wherever the mix sits.' },
    { id: 'MODEL-1.4', name: 'PLAYdifferently MODEL 1.4', short: 'MODEL 1.4', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['MODEL14'],
      outs: [['RECORD OUT', 'MINI', 'none', '', 'rec', 'The 3.5 mm socket on the top panel, in the master section: a 3.5 mm to 2 x RCA cable.'], ['BOOTH', 'TRS', 'booth', 'BOOTH', 'booth'],
        ['MASTER', 'XLR', 'own', 'MASTER LEVEL', 'pa', M1[5]], ['AUX 1 / AUX 2', 'TRS', 'check', '', 'fx'], PH],
      where: 'RECORD OUT, the 3.5 mm (mini jack) socket on the top panel',
      level: 'RECORD OUT comes before the master level (after the master EQ): no knob, the loud parts sit wherever the mix sits.' },
    { id: 'ES-DJR400', name: 'E&S DJR400', short: 'DJR400', maker: 'Other makers', kind: 'mixer', link: 'check', also: ['DJR400'],
      outs: [['BOOTH (RCA) / REC OUT', 'RCA', 'check', '', 'rec', 'Not verified: no maker document found. A review says the booth RCA pair can be built as a record out when ordered: trust the label.'],
        ['MASTER (RCA)', 'RCA', 'master', 'MASTER', 'free', 'Not verified from the maker.'], ['MASTER (XLR)', 'XLR', 'master', 'MASTER', 'pa', M1[5]]],
      where: 'a spare RCA output on the back (check the back panel: it depends on how it was built)',
      watch: 'Not checked against the maker: trust the labels on the back. Some are built with an RCA record out, some with an RCA booth.' },
    { id: 'BOZAK-AR6', name: 'Bozak AR-6', short: 'BOZAK AR-6', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['AR6', 'BOZAK'],
      out: ['TAPE OUT', 'RCA', 'check'], alt: 'TAPE OUT already used? A Y splitter on it.',
      watch: 'On a Bozak the record out is called TAPE OUT.' },
    // Behringer (#161, for completeness): the record out is printed TAPE, a fixed level
    { id: 'BEHRINGER-DJX750', name: 'Behringer DJX750', short: 'DJX750', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['DJX750'],
      outs: [['TAPE', 'RCA', 'none', '', 'rec'], ['BOOTH', 'RCA', 'booth', 'BOOTH LEVEL', 'booth'], ['MAIN', 'RCA', 'master', 'MASTER', 'pa'], ['SEND', 'RCA', 'check', '', 'never', 'It carries the headphone cue, not the mix.'], PH],
      watch: 'Behringer prints the record out as TAPE: a fixed level, made for a recorder.' },
    { id: 'BEHRINGER-DJX900USB', name: 'Behringer DJX900USB', short: 'DJX900USB', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['DJX900USB', 'DJX900'],
      outs: [['TAPE', 'RCA', 'none', '', 'rec'], ['BOOTH', 'RCA', 'booth', 'BOOTH LEVEL', 'booth'], ['MAIN', 'RCA', 'master', 'MASTER', 'pa'], ['SEND', 'RCA', 'check', '', 'never', 'It carries the headphone cue, not the mix.'], PH, USBA],
      watch: 'Behringer prints the record out as TAPE: a fixed level, made for a recorder.' },
    { id: 'BEHRINGER-VMX1000USB', name: 'Behringer VMX1000USB', short: 'VMX1000USB', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['VMX1000USB', 'VMX1000'],
      outs: [['TAPE OUT', 'RCA', 'none', '', 'rec', 'RCA per the hook-up drawing (the manual text doesn\'t name the plug).'], ['MAIN 2', 'RCA', 'own', 'VOL 2', 'booth'], ['MAIN 1', 'XLR', 'own', 'VOL 1', 'pa', M1[5]],
        ['SUBWOOFER', 'XLR', 'own', 'LEVEL', 'never', 'Bass only, not the whole mix.'], ['SEND', 'TRS', 'check', '', 'fx'], PH, USBA],
      watch: 'Behringer prints the record out as TAPE: the main mix before the volume knobs, fixed level.' },
    { id: 'CONDESA', name: 'Condesa (Carmen / Lucia / Allegra)', short: 'CONDESA', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['CONDESA', 'CARMEN', 'LUCIAX', 'ALLEGRA'],
      out: ['RECORD', 'RCA', 'none'], alt: 'RECORD already used? A Y splitter on it.',
      level: 'RECORD is a fixed level: no knob, the loud parts sit wherever the mix sits. Other Condesa models: check the back panel.' },
    { id: 'ECLER-WARM4', name: 'Ecler WARM4', short: 'WARM4', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['WARM4'],
      out: ['REC', 'RCA', 'none'], where: 'REC, the RCA pair on the front (faceplate)', alt: 'REC already used? BOOTH (RCA, own BOOTH knob), if the monitors aren\'t on it.',
      level: 'REC comes before the master: no knob, the loud parts sit wherever the mix sits.' },
    { id: 'ECLER-NUO4', name: 'Ecler NUO 4', short: 'NUO 4', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['NUO4', 'NUO40'],
      out: ['REC OUT', 'RCA', 'none'], where: 'REC OUT, the RCA pair on the top panel', alt: 'REC OUT already used? BOOTH (RCA, own BOOTH knob), if the monitors aren\'t on it.',
      level: 'REC OUT comes before the master: no knob, the loud parts sit wherever the mix sits.' },
    { id: 'ECLER-NUO5', name: 'Ecler NUO 5', short: 'NUO 5', maker: 'Other makers', kind: 'mixer', link: 'check', also: ['NUO5'],
      out: ['REC', 'RCA', 'check'], where: 'REC (RCA), if it has one: check the panel', alt: 'Check the back panel for a second master or booth out.',
      watch: 'Not checked against Ecler\'s manual: check the panel for REC.' },
    // ---- laptop controllers ----
    { id: 'RANE-ONE', name: 'Rane ONE', short: 'RANE ONE', maker: 'Controllers', kind: 'controller', link: 'no', also: ['RANEONE'],
      outs: [['MAIN OUT (RCA)', 'RCA', 'check', '', 'free', 'The RCA pair: whether the MAIN knob moves it isn\'t stated by Rane.'], ['BOOTH OUT', 'XLR', 'booth', 'BOOTH', 'booth'], ['MAIN OUT (XLR)', 'XLR', 'master', 'MAIN', 'pa', M1[5]], PH, USBA],
      watch: 'The RCA MAIN OUT is the spare when the PA is on the XLR pair. Never PHONES.' },
    // ---- the catch-alls (always last) ----
    { id: 'OTHER', name: 'NOT LISTED', short: 'NOT LISTED', maker: '', kind: 'other', link: 'check',
      out: ['REC OUT', 'RCA', 'check'], where: 'REC OUT (or RECORD / SESSION / TAPE) if it has one: it\'s made for recording. None: a spare RCA master out (MASTER 2), or BOOTH',
      cable: 'An RCA to RCA cable. For BOOTH (1/4-inch jacks): 2 x 1/4-inch to 2 x RCA.',
      alt: 'Everything busy: a Y splitter on REC OUT or the RCA master.',
      watch: 'Never the headphone jack: it carries whatever the DJ cues, not the mix.',
      level: 'REC OUT usually has no knob. A master or booth out follows its own level knob.',
      loud: 'Red on the loud parts: turn the level knob for the output you used down a little (BOOTH, or MASTER if you used a master out). REC OUT has no knob: a few flashes are fine.',
      quiet: 'Quiet: turn the level knob for that output up (BOOTH, or MASTER). REC OUT follows the mix; a quiet recording is still usable.' },
    { id: 'LAPTOP', name: 'LAPTOP DJ', short: 'LAPTOP DJ', maker: '', kind: 'laptop', link: 'no', also: ['SERATO', 'TRAKTOR', 'VIRTUALDJ', 'LAPTOP'],
      out: ['MASTER 2 / BOOTH', 'RCA', 'check'], where: 'a spare output on the mixer the laptop plays through (REC OUT, MASTER 2 or BOOTH). A controller on its own: its RCA MASTER or BOOTH',
      alt: 'Everything busy: a Y splitter on the RCA master.',
      watch: 'Never the laptop\'s headphone jack or the controller\'s PHONES: they carry what the DJ cues.' },
    { id: 'NONE', name: 'NO MIXER (CDJs ONLY)', short: 'CDJs, NO MIXER LINK', maker: '', kind: 'none', link: 'no',
      out: ['REC OUT', 'RCA', 'check'], where: 'REC OUT (or a spare RCA master or BOOTH out) on whatever mixer the players feed',
      alt: 'Everything busy: a Y splitter on the RCA master.' },
  ];

  // Players: does it join the DJ network, and does GHOST LINK read it (beat-link 8.0.0's own notes).
  const PLAYERS = [
    { id: 'CDJ-3000X', link: 'yes', reads: 'check', say: 'LINK port (Wi-Fi is not for the DJ network). Newer than the library GHOST LINK is built on: not tried yet.' },
    { id: 'CDJ-3000', link: 'yes', reads: 'yes', say: 'Full support: titles, art, waveforms, beat grid, song position.' },
    { id: 'CDJ-2000NXS2', link: 'yes', reads: 'yes', also: ['CDJ2000NEXUS2'], say: 'Full support: titles, art, waveforms, beat grid.' },
    { id: 'CDJ-2000NXS', link: 'yes', reads: 'yes', also: ['CDJ2000NEXUS'], say: 'Full support: titles, art, waveforms, beat grid.' },
    { id: 'XDJ-1000MK2', link: 'yes', reads: 'yes', also: ['XDJ1000'], say: 'Reported to work (XDJ-1000 gear).' },
    { id: 'XDJ-700', link: 'yes', reads: 'check', say: 'LINK port. Not confirmed by the library GHOST LINK is built on: not tried yet.' },
    { id: 'SC6000M', link: 'no', reads: 'no', say: 'Denon DJ players talk Denon\'s own network (Engine / StageLinQ), not Pioneer\'s: GHOST LINK can\'t read them. SOUND IN still works.' },
    { id: 'SC6000', link: 'no', reads: 'no', say: 'Denon DJ players talk Denon\'s own network (Engine / StageLinQ), not Pioneer\'s: GHOST LINK can\'t read them. SOUND IN still works.' },
  ];

  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const byId = id => LIST.find(x => x.id === id) || null;
  const keys = x => [x.id, x.name].concat(x.also || []).map(norm).filter(Boolean);
  const pickable = () => LIST.filter(x => x.kind !== 'player');

  /** The list entry for a device name seen on the DJ network ("DJM-900NXS2", "XDJ-XZ"), longest match first. */
  function fromName(name) {
    const n = norm(name);
    if (!n) return null;
    let best = null, len = 0;
    for (const x of LIST) for (const k of keys(x)) if (n.startsWith(k) && k.length > len) { best = x; len = k.length; }
    return best;
  }
  /** The mixer named in free text (a venue's GEAR notes: "2x CDJ-3000, DJM-S11"). Mixers only, longest name wins. */
  function fromText(text) {
    const n = norm(text);
    if (!n) return null;
    let best = null, len = 0;
    for (const x of pickable()) {
      if (x.kind === 'laptop' || x.kind === 'none' || x.kind === 'other') continue;
      for (const k of keys(x)) if (k.length >= 4 && n.includes(k) && k.length > len) { best = x; len = k.length; }
    }
    return best;
  }

  /** The short list (most common first), then the rest grouped by maker, then the catch-alls. */
  function groups() {
    const top = LIST.filter(x => x.top).sort((a, b) => a.top - b.top);
    const rest = {};
    LIST.filter(x => !x.top && (x.kind === 'mixer' || x.kind === 'allinone' || x.kind === 'controller')).forEach(x => (rest[x.maker] = rest[x.maker] || []).push(x));
    const ends = LIST.filter(x => x.kind === 'laptop' || x.kind === 'none' || x.kind === 'other');
    // controllers go in MORE (with their maker heading), like the mixers
    return { top, more: Object.entries(rest).map(([maker, items]) => ({ maker, items })), ends };
  }

  const linkWord = x => x.link === 'yes' ? 'has a LINK port' : x.link === 'no' ? 'has no LINK port' : 'may have a LINK port (check the back panel)';
  const WORKS = 'Still works: titles, art, waveforms, BPM, PLAYED (it guesses from the MASTER deck; a track counts after 30 s) and SOUND IN.';
  const LAPTOP_GETS = 'What a laptop night gets, with the USB sound card on a spare output: the level meter, the SILENCE warning, recording the set, and BY EAR (the BPM, the beat and THE DROP heard from the sound, an estimate). Any CDJs on the DJ network still show as usual.';
  const MISSING = 'Missing: ON AIR (which deck is out loud) and fader info, and dead air goes by play state.';

  /** The DJ network advice for this mixer: 2-3 short lines. seen = the mixer is on the DJ network right now. */
  function network(x, seen) {
    if (!x) return ['Which mixer? Pick it and this says what GHOST LINK can and can\'t see with it.'];
    if (x.kind === 'laptop' || x.kind === 'controller') return [
      (x.kind === 'controller' ? 'The ' + x.name + ' is a laptop controller, so the laptop' : 'A laptop DJ (Serato, rekordbox, Traktor, VirtualDJ)') + ' sends nothing GHOST LINK can read: no titles, decks or ON AIR.',
      LAPTOP_GETS];
    if (x.kind === 'none') return [
      'CDJs with no mixer on the DJ network: fine to play like this.',
      WORKS, MISSING];
    if (x.kind === 'other') return [
      'If the mixer has a LINK (network) port, cable it to the same switch as the players: ON AIR and fader info come back.',
      'No LINK port: ' + WORKS.charAt(0).toLowerCase() + WORKS.slice(1), MISSING];
    if (seen) return [x.name + ' is on the DJ network: ON AIR and fader start come from it.'];
    if (x.net) return x.net.slice();
    if (x.link === 'yes') return [
      'The ' + x.name + ' has a LINK port: cable it to the same switch as the players (or the CDJ hub). Then ON AIR comes back.',
      x.netNote || WORKS];
    if (x.kind === 'allinone' && x.link === 'no') return [
      'The ' + x.name + ' has no LINK port GHOST LINK can use: no titles or decks from it.',
      'Still works: SOUND IN (meter, SILENCE warning, recording) from its ' + x.out[0] + '.'];
    if (x.link === 'no') return [
      'The ' + x.name + ' has no LINK port, so it can\'t join the DJ network. Fine to play like this.',
      WORKS, MISSING];
    return ['The ' + x.name + ': check the back panel for a LINK (network) port. If there is one, cable it to the players\' switch.', WORKS];
  }

  /** The sound card advice for this mixer, in the shape soundsetup.js uses. */
  function sound(x, jackName) {
    if (!x) return null;
    // #161: the jack the owner says is used (any card output of this model), else the best one
    const card = x.outs ? outputs(x).filter(o => o.card) : [];
    const picked = (jackName && card.find(o => o.name === jackName)) || null;
    const best = !picked || picked === card[0];
    const o = picked || card[0] || null;
    const [use, jack, follows, extra] = o ? [o.name, JACK[o.jack] ? o.jack : 'RCA', o.follows] : x.out || ['REC OUT', 'RCA', 'check'];
    const knob = o && o.knob ? o.knob : follows === 'master' ? 'MASTER' : follows === 'booth' ? 'BOOTH' : '';
    const j = JACK[jack] || JACK.RCA;
    const level = follows === 'none' ? use + ' has no knob of its own. The loud parts sit wherever the DJ\'s mix sits; that\'s normal.'
      : follows === 'master' ? use + ' follows ' + knob + ': turning the room up turns the recording up.'
      : follows === 'booth' || follows === 'own' ? use + ' has its own ' + (knob || 'level') + ' knob: set the recording with it' + (follows === 'booth' ? ', the room stays the same.' : '.')
      : 'Which knob sets ' + use + ' isn\'t confirmed: watch the meter.';
    const other = card.find(y => y !== o && (y.follows === 'booth' || y.follows === 'own') && y.use !== 'pa');
    const loud = follows === 'none' ? 'Red on the loud parts: the DJ\'s mix is running hot (check the mixer\'s MASTER meter). A few flashes are fine.'
      : follows === 'master' ? 'Red on the loud parts: turn ' + knob + ' down a little' + (other ? ', or use ' + other.name + ' and set it on its own knob.' : '.')
      : follows === 'booth' || follows === 'own' ? 'Red on the loud parts: turn the ' + (knob || use) + ' knob down a little.' + (jack === 'XLR' ? ' XLR is hot for a small card.' : '')
      : 'Red on the loud parts: turn the level knob for ' + use + ' down a little.' + (jack === 'XLR' ? ' XLR is hot for a small card.' : '');
    const quiet = follows === 'none' ? 'Quiet: check the mixer is really sending (channel faders up, crossfader). A quiet recording is still usable; it can be turned up after.'
      : follows === 'master' ? 'Quiet: turn ' + knob + ' up' + (other ? ', or use ' + other.name + ' and turn its knob up (the room stays the same).' : '. A quiet recording is still usable.')
      : follows === 'booth' || follows === 'own' ? 'Quiet: turn the ' + (knob || use) + ' knob up. A quiet recording is still usable.'
      : 'Quiet: turn the level knob for ' + use + ' up. A quiet recording is still usable.';
    const s = {
      id: x.id, name: x.name, use,
      where: (best && x.where) || (use + ' (' + j.jack + (jack === 'TRS' ? ' jacks' : '') + ') on the ' + (x.front ? 'front' : 'back') + (extra ? ', ' + extra : '')),
      cable: (best && x.cable) || j.cable,
      why: x.via || (best ? x.watch || (o && o.note) : o && o.note) || (follows === 'none' ? use + ' is there for recording: it carries the mix and nobody else is using it, most nights.' : ''),
      taken: (o && o.taken) || x.alt || 'Every output busy: a Y splitter on the one you need.',
      level: (best && x.level) || level, loud: (best && x.loud) || loud, quiet: (best && x.quiet) || quiet,
    };
    if (o) { s.jack = o.name; s.knob = o.knob; s.follows = o.follows; }
    return s;
  }
  // ---- every output, ranked (#161 MIXER OUTPUTS) ----
  // a club Nov 25: the box said REC OUT on the DJM-A9, the resident's recorder had it, MASTER 2 next to it was fine.
  // outs: [name as printed, jack, follows, knob, use, note?], GHOST LINK's order (best first).
  //   jack: RCA | TRS | XLR | MINI | COAX (digital) | USB.   follows: as above; knob = the knob that sets it ('' = none).
  //   use: 'free' (spare most nights), 'rec' (made for recording: a venue recorder may be on it), 'booth' (usually
  //        the booth monitors), 'zone' (a second room, if one is wired), 'pa' (usually the PA), 'digital' (the USB
  //        sound card has no digital input), 'never' (headphones).
  const FOLLOW_SAY = {
    none: 'no knob of its own (it carries the mix before the MASTER knob)',
    master: 'follows the MASTER knob (louder, and it moves with the room)',
    booth: 'its own BOOTH knob', own: 'its own level knob', check: 'which knob sets it: not verified',
  };
  const USE_SAY = {
    free: 'usually free', rec: 'made for recording (a venue recorder may already be on it)',
    booth: 'usually the booth monitors', zone: 'a second room\'s speakers, if one is wired', pa: 'usually the PA: only with the venue\'s OK',
    digital: 'digital: the USB sound card can\'t take it', never: 'never: it carries what the DJ cues, not the mix',
    fx: 'for an effects unit: the DJ\'s FX selector changes what it carries', usb: 'for the DJ\'s laptop',
  };
  const JACK_SAY = { RCA: 'RCA', TRS: '1/4-inch', XLR: 'XLR', MINI: '3.5 mm', COAX: 'coaxial digital', USB: 'USB' };
  const forCard = o => !['digital', 'never', 'fx', 'usb'].includes(o.use) && o.jack !== 'COAX' && o.jack !== 'USB';

  /** Every output of this model as objects, best first (card ones), then the ones the card can't use. */
  function outputs(x) {
    if (!x) return [];
    const raw = x.outs || [[x.out[0], x.out[1], x.out[2], '', 'free']];
    const all = raw.map(([name, jack, follows, knob, use, note], i) => {
      const f = follows || 'check';
      const k = knob || (f === 'master' ? 'MASTER' : f === 'booth' ? 'BOOTH' : '');
      return { name, jack, follows: f, knob: k, use: use || 'free', note: note || '', at: i,
        jackSay: JACK_SAY[jack] || jack, followSay: f === 'own' && k ? 'its own ' + k + ' knob' : f === 'booth' && k ? 'its own ' + k + ' knob' : FOLLOW_SAY[f] || FOLLOW_SAY.check,
        useSay: USE_SAY[use || 'free'] || '' };
    });
    const card = all.filter(forCard), not = all.filter(o => !forCard(o));
    card.forEach((o, i) => { o.rank = i + 1; o.card = true; });
    // "if it's taken": the next one down, and for the last a Y splitter on the best
    const short = o => o.follows === 'none' ? 'no knob of its own' : o.follows === 'master' ? 'follows MASTER'
      : (o.follows === 'booth' || o.follows === 'own') && o.knob ? 'its own ' + o.knob + ' knob' : 'knob not verified';
    const WHY_NOT = { digital: 'digital', never: 'not the mix', fx: 'effects', usb: 'laptop' };
    const SHORT_USE = { rec: 'made for recording', booth: 'usually the booth monitors', zone: 'a second room, if wired', pa: 'the PA: venue\'s OK only' };
    all.forEach(o => { o.followShort = short(o); o.useShort = SHORT_USE[o.use] || ''; o.whyNot = WHY_NOT[o.use] || (o.jack === 'COAX' || o.jack === 'USB' ? 'digital' : ''); });
    card.forEach((o, i) => {
      const n = card[i + 1];
      const fine = n && o.follows === 'none' && n.follows === 'master' ? ' Fine for recording: it\'s louder and moves with the room.' : '';
      o.taken = n ? o.name + ' taken? Use ' + n.name + ' (' + n.jackSay + ', ' + short(n) + (n.use === 'pa' || n.use === 'booth' ? '; ' + n.useSay : '') + ').' + fine
        : card.length > 1 ? 'All taken? A Y splitter on ' + card[0].name + ' shares it with whoever has it.' : o.name + ' taken? A Y splitter shares it with whoever has it.';
    });
    not.forEach(o => { o.card = false; });
    return card.concat(not);
  }

  /** What the phone posts to /api/audio/jack for this output (AudioJack.java): follows booth = its own knob. */
  function jackBody(x, o) {
    return { mixer: x.id, mixerName: x.kind === 'other' || x.kind === 'laptop' || x.kind === 'none' ? '' : x.name,
      jack: o.name, follows: o.follows === 'booth' ? 'own' : o.follows, knob: o.knob };
  }

  /** What GHOST LINK reads from a player. */
  function player(name) {
    const n = norm(name);
    return PLAYERS.find(p => n.startsWith(norm(p.id))) || null;
  }

  // ---- remembering the pick, per venue (this phone), and from the venue's GEAR notes ----
  const KEY = 'gearMixer:';
  const store = {
    get(venue) { try { return (typeof localStorage !== 'undefined' && localStorage.getItem(KEY + (venue || '-'))) || null; } catch (e) { return null; } },
    set(venue, id) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY + (venue || '-'), id); } catch (e) {} },
  };
  /**
   * Tonight's mixer: the one on the DJ network wins, then the one picked here for this venue, then the venue's GEAR
   * notes. {entry, from: 'network' | 'picked' | 'venue'} or null. devices = S.devices, venue = status.venue.
   */
  function current(devices, venue, picked) {
    const m = (devices || []).find(d => d && d.kind === 'MIXER' && d.name);
    if (m) { const x = fromName(m.name); if (x) return { entry: x, from: 'network', name: m.name }; return { entry: byId('OTHER'), from: 'network', name: m.name }; }
    const p = picked !== undefined ? picked : store.get(venue && venue.id);
    if (p && byId(p)) return { entry: byId(p), from: 'picked' };
    const v = venue && fromText(venue.gear);
    if (v) return { entry: v, from: 'venue' };
    return null;
  }

  /**
   * The SOUND CARD IN chip (#105, soundsetup.js): 'deaf' (recording, decks playing, the card hears nothing: #103),
   * 'in' (the card appeared while this page was open, or within o.fresh ms before), or null. Recording or armed: not
   * needed. o = {deafAway, seen (the cardAt already shown on this phone), prevCard (undefined on the first status,
   * null when the last status had no card), boxNow, fresh}.
   */
  function chipFor(a, o) {
    if (!a || !a.card) return null;
    if (a.deaf) return o.deafAway ? null : 'deaf';
    if (a.recordOn || a.recording) return null;
    if (!a.cardAt || o.seen === a.cardAt) return null;
    return o.prevCard === null || o.boxNow - a.cardAt < (o.fresh || 120000) ? 'in' : null;
  }

  // #161: the first card output is the one to use (x.out keeps working for older callers); the "taken" line follows the ranking
  LIST.forEach(x => {
    if (!x.outs) return;
    const o = outputs(x), first = o.find(y => y.card);
    if (first) x.out = [first.name, first.jack === 'MINI' || first.jack === 'TRS' || first.jack === 'XLR' ? first.jack : 'RCA', first.follows];
    if (!x.alt && first) x.alt = first.taken;
  });

  return { LIST, PLAYERS, chipFor, byId, fromName, fromText, groups, network, sound, player, current, store, norm, outputs, jackBody };
})();
if (typeof module !== 'undefined') module.exports = Gear;
