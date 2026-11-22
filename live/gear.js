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
  const LIST = [
    // ---- Pioneer DJ / AlphaTheta club mixers (LINK port, REC OUT) ----
    { id: 'DJM-900NXS2', name: 'DJM-900NXS2', short: '900NXS2', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 1,
      out: ['REC OUT', 'RCA', 'none'], alt: 'REC OUT already used (a venue recorder)? MASTER 2 (RCA) works too; it follows MASTER. Both busy: a Y splitter on REC OUT.',
      level: 'REC OUT has no knob of its own. Whether MASTER changes it isn\'t confirmed for this model: watch the meter.' },
    { id: 'DJM-A9', name: 'DJM-A9', short: 'A9', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 2,
      out: ['REC OUT', 'RCA', 'none'], alt: 'REC OUT already used? MASTER 2 (RCA) works too; it follows MASTER. Both busy: a Y splitter on REC OUT.' },
    { id: 'DJM-V10-LF', name: 'DJM-V10-LF', short: 'V10-LF', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', also: ['V10LF'],
      out: ['REC OUT', 'RCA', 'none'], alt: 'REC OUT already used? MASTER 2 (RCA) works too; it follows MASTER. Both busy: a Y splitter on REC OUT.' },
    { id: 'DJM-V10', name: 'DJM-V10', short: 'V10', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes', top: 3,
      out: ['REC OUT', 'RCA', 'none'], alt: 'REC OUT already used? MASTER 2 (RCA) works too; it follows MASTER. Both busy: a Y splitter on REC OUT.' },
    { id: 'DJM-900NXS', name: 'DJM-900NXS', short: '900NXS', maker: 'Pioneer DJ', kind: 'mixer', link: 'yes',
      out: ['REC OUT', 'RCA', 'none'], alt: 'REC OUT already used? MASTER 2 (RCA) works too; it follows MASTER. Both busy: a Y splitter on REC OUT.' },
    // ---- Pioneer DJ mixers with no LINK port and no REC OUT ----
    { id: 'DJM-750MK2', name: 'DJM-750MK2', short: '750MK2', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH MONITOR knob, if the booth monitors aren\'t on it.',
      watch: 'No REC OUT on this one: MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-450', name: 'DJM-450', short: '450', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used: a Y splitter on it. There is no BOOTH or REC OUT.',
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER, so the recording moves with the room.' },
    { id: 'DJM-250MK2', name: 'DJM-250MK2', short: '250MK2', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used: a Y splitter on it. There is no BOOTH or REC OUT.',
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER, so the recording moves with the room.' },
    { id: 'DJM-S11', name: 'DJM-S11', short: 'S11', maker: 'Pioneer DJ', kind: 'mixer', link: 'no', top: 4,
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH LEVEL knob, if the booth monitors aren\'t on it.',
      watch: 'A battle mixer: no REC OUT and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S9', name: 'DJM-S9', short: 'S9', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own booth level knob, if the booth monitors aren\'t on it.',
      watch: 'A battle mixer: no REC OUT and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S7', name: 'DJM-S7', short: 'S7', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH LEVEL knob, if the booth monitors aren\'t on it.',
      watch: 'A battle mixer: no REC OUT and no LINK port. MASTER 2 is the RCA copy of the master.' },
    { id: 'DJM-S5', name: 'DJM-S5', short: 'S5', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['BOOTH/MASTER 2', 'RCA', 'booth'], alt: 'The booth monitors are on BOOTH/MASTER 2? Then the only other out is MASTER 1 (XLR, the PA): a Y cable there is the venue\'s call.',
      watch: 'One RCA pair is BOOTH or MASTER 2 (a setting; BOOTH out of the box, with the BOOTH LEVEL knob). Set to MASTER it follows MASTER instead.' },
    { id: 'DJM-S3', name: 'DJM-S3', short: 'S3', maker: 'Pioneer DJ', kind: 'mixer', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used: a Y splitter on it. There is no BOOTH or REC OUT.',
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER, so the recording moves with the room.' },
    // ---- Pioneer DJ / AlphaTheta all-in-ones ----
    { id: 'XDJ-XZ', name: 'XDJ-XZ', short: 'XDJ-XZ', maker: 'All-in-one', kind: 'allinone', link: 'yes', top: 5,
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH level knob.',
      watch: 'No REC OUT on the XDJ-XZ. MASTER 2 is the RCA copy of the master (MASTER 1 is the big XLR pair).',
      netNote: 'GHOST LINK reads its own decks and its mixer from there; up to 2 extra players go in its LINK (CH3/CH4) sockets.' },
    { id: 'XDJ-RX3', name: 'XDJ-RX3', short: 'XDJ-RX3', maker: 'All-in-one', kind: 'allinone', link: 'no', top: 6,
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH level knob.',
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.' },
    { id: 'XDJ-RX2', name: 'XDJ-RX2', short: 'XDJ-RX2', maker: 'All-in-one', kind: 'allinone', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH MONITOR knob.',
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-RX2 has no LINK port GHOST LINK can use: no titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'XDJ-RX', name: 'XDJ-RX', short: 'XDJ-RX', maker: 'All-in-one', kind: 'allinone', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (1/4-inch jacks) with its own BOOTH MONITOR knob.',
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-RX\'s LINK socket is only for rekordbox on a laptop. Leave GHOST LINK off it: tools like this are reported to crash it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'XDJ-RR', name: 'XDJ-RR', short: 'XDJ-RR', maker: 'All-in-one', kind: 'allinone', link: 'no',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used: a Y splitter on it. There is no BOOTH or REC OUT.',
      watch: 'No REC OUT or BOOTH: MASTER 2 is the only spare. It follows MASTER.' },
    { id: 'XDJ-AZ', name: 'XDJ-AZ', short: 'XDJ-AZ', maker: 'All-in-one', kind: 'allinone', link: 'check',
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks) with its own BOOTH LEVEL knob.',
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The XDJ-AZ has a LINK port, but GHOST LINK hasn\'t been tried with one and the library it\'s built on doesn\'t read it yet: expect no titles.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'OPUS-QUAD', name: 'OPUS-QUAD', short: 'OPUS-QUAD', maker: 'All-in-one', kind: 'allinone', link: 'check', also: ['OPUSQUAD', 'OPUS'],
      out: ['MASTER 2', 'RCA', 'master'], alt: 'MASTER 2 already used? BOOTH (two 1/4-inch jacks, own BOOTH knob), or ZONE (XLR, own ZONE knob) if no zone speakers are on it.',
      watch: 'No REC OUT: MASTER 2 is the RCA copy of the master.',
      net: ['The OPUS-QUAD\'s LINK socket is for rekordbox, not other players. GHOST LINK hasn\'t been tried with one: at best a limited view, no titles yet.',
        'Still works: SOUND IN (meter, SILENCE warning, recording) from its MASTER 2.'] },
    { id: 'OMNIS-DUO', name: 'OMNIS-DUO', short: 'OMNIS-DUO', maker: 'All-in-one', kind: 'allinone', link: 'no', also: ['OMNISDUO'],
      out: ['BOOTH/MASTER 2', 'RCA', 'booth'], alt: 'The booth speakers are on it? Then the only other out is MASTER 1 (XLR, the PA): ask the venue.',
      watch: 'One RCA pair is BOOTH or MASTER 2 (a setting; BOOTH out of the box, with the BOOTH LEVEL knob).' },
    // ---- Rane ----
    { id: 'RANE-72MK2', name: 'Rane Seventy-Two MKII', short: 'RANE 72 MKII', maker: 'Rane', kind: 'mixer', link: 'no', also: ['SEVENTYTWOMKII', 'SEVENTYTWOMK2', 'RANE72MKII', 'RANE72MK2'],
      out: ['SESSION OUT', 'RCA', 'own'], alt: 'SESSION OUT already used? BOOTH (1/4-inch jacks) with its own BOOTH knob.',
      watch: 'Rane\'s record out is called SESSION OUT, with its own knob.' },
    { id: 'RANE-72', name: 'Rane Seventy-Two', short: 'RANE 72', maker: 'Rane', kind: 'mixer', link: 'check', also: ['SEVENTYTWO', 'RANE72'],
      out: ['SESSION OUT', 'RCA', 'check'], alt: 'Check the back panel for BOOTH (1/4-inch jacks).',
      watch: 'The first Seventy-Two wasn\'t checked against Rane\'s manual: check the back panel for SESSION OUT.' },
    { id: 'RANE-70', name: 'Rane Seventy', short: 'RANE 70', maker: 'Rane', kind: 'mixer', link: 'no', also: ['RANESEVENTY', 'RANE70'],
      out: ['SESSION OUT', 'RCA', 'own'], alt: 'SESSION OUT already used? BOOTH (1/4-inch jacks) with its own BOOTH knob.',
      watch: 'Rane\'s record out is called SESSION OUT, with its own knob.' },
    { id: 'RANE-70A', name: 'Rane Seventy-A', short: 'RANE 70-A', maker: 'Rane', kind: 'mixer', link: 'check', also: ['SEVENTYA', 'SEVENTYATRAK'],
      out: ['SESSION OUT', 'RCA', 'check'], alt: 'Check the back panel for BOOTH (1/4-inch jacks).',
      watch: 'Not checked against Rane\'s manual: check the back panel. On Rane mixers the record out is usually SESSION OUT.' },
    { id: 'RANE-MP2015', name: 'Rane MP2015', short: 'MP2015', maker: 'Rane', kind: 'mixer', link: 'no', also: ['MP2015'],
      out: ['SESSION OUT', 'RCA', 'own'], alt: 'SESSION OUT already used? BOOTH (1/4-inch jacks) with its own level knob.',
      watch: 'Every output carries the main mix with its own level knob; SESSION is the RCA one.' },
    { id: 'RANE-FOUR', name: 'Rane Four', short: 'RANE FOUR', maker: 'Rane', kind: 'mixer', link: 'no', also: ['RANEFOUR'],
      out: ['MAIN OUT', 'RCA', 'check'], where: 'MAIN OUT, the RCA pair on the back (not the XLR pair)', alt: 'RCA MAIN already used? BOOTH/ZONE (1/4-inch jacks) with its own BOOTH/ZONE knob.',
      watch: 'No REC OUT: the RCA MAIN OUT is the one made for a recorder.' },
    // ---- Allen & Heath ----
    { id: 'XONE-92', name: 'Xone:92', short: 'XONE:92', maker: 'Allen & Heath', kind: 'mixer', link: 'no', top: 7, also: ['XONE92'],
      out: ['RECORD', 'RCA', 'none'], alt: 'RECORD already used? A Y splitter on it. (BOOTH is 1/4-inch jacks with its own knob, if the monitors aren\'t on it.)',
      level: 'RECORD comes before the MIX knobs: it has no knob, the loud parts sit wherever the mix sits.' },
    { id: 'XONE-96', name: 'Xone:96', short: 'XONE:96', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE96'],
      out: ['RECORD', 'RCA', 'none'], alt: 'RECORD already used? A Y splitter on it, or BOOTH (1/4-inch jacks, own knob) if the monitors aren\'t on it.',
      level: 'RECORD comes before the MASTER knobs: it has no knob, the loud parts sit wherever the mix sits.',
      net: ['The Xone:96 has no LINK port for the DJ network (its X:LINK socket is only for Xone controllers).',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) and SOUND IN. Missing: ON AIR and fader info.'] },
    { id: 'XONE-PX5', name: 'Xone:PX5', short: 'XONE:PX5', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONEPX5', 'PX5'],
      out: ['RECORD', 'RCA', 'none'], alt: 'RECORD already used? A Y splitter on it, or MASTER 2 (RCA, follows MASTER).',
      level: 'RECORD comes before the MASTER knob: it has no knob, the loud parts sit wherever the mix sits.',
      net: ['The Xone:PX5 has no LINK port for the DJ network (its X:LINK socket is only for Xone controllers).',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) and SOUND IN. Missing: ON AIR and fader info.'] },
    { id: 'XONE-43C', name: 'Xone:43C', short: 'XONE:43C', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE43C'],
      out: ['RECORD', 'RCA', 'check'], alt: 'RECORD already used? A Y splitter on it, or BOOTH (RCA, own BOOTH knob).' },
    { id: 'XONE-43', name: 'Xone:43', short: 'XONE:43', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE43'],
      out: ['RECORD', 'RCA', 'none'], alt: 'RECORD already used? A Y splitter on it, or BOOTH (RCA, own BOOTH knob).',
      level: 'RECORD comes before the master knob: it has no knob, the loud parts sit wherever the mix sits.' },
    { id: 'XONE-23C', name: 'Xone:23C', short: 'XONE:23C', maker: 'Allen & Heath', kind: 'mixer', link: 'no', also: ['XONE23C'],
      out: ['RECORD', 'RCA', 'check'], alt: 'RECORD already used? MONITOR (RCA, own MONITOR knob), if the booth monitors aren\'t on it.' },
    // ---- Denon DJ ----
    { id: 'X1850', name: 'Denon DJ X1850 PRIME', short: 'X1850', maker: 'Denon DJ', kind: 'mixer', link: 'no', also: ['X1850PRIME', 'X1850'],
      out: ['RECORD', 'RCA', 'check'], alt: 'RECORD already used? The RCA MASTER (follows MASTER), or BOOTH (1/4-inch jacks, own BOOTH knob).',
      net: ['The X1850\'s LINK ports are Denon\'s own (Engine), not the Pioneer DJ network GHOST LINK reads: ON AIR can\'t come from it.',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) from any Pioneer players, and SOUND IN.'] },
    { id: 'X1800', name: 'Denon DJ X1800 PRIME', short: 'X1800', maker: 'Denon DJ', kind: 'mixer', link: 'no', also: ['X1800PRIME', 'X1800'],
      out: ['RECORD', 'RCA', 'check'], alt: 'RECORD already used? The RCA MASTER (follows MASTER), or BOOTH (1/4-inch jacks, own BOOTH knob).',
      net: ['The X1800\'s LINK ports are Denon\'s own (Engine), not the Pioneer DJ network GHOST LINK reads: ON AIR can\'t come from it.',
        'Still works: titles, art, waveforms, BPM, PLAYED (guessed from the MASTER deck) from any Pioneer players, and SOUND IN.'] },
    { id: 'PRIME-4', name: 'Denon DJ PRIME 4+', short: 'PRIME 4+', maker: 'Denon DJ', kind: 'allinone', link: 'no', also: ['PRIME4PLUS', 'PRIME4'],
      out: ['MASTER', 'RCA', 'master'], where: 'MASTER, the RCA pair on the back (the PA is usually on the XLR pair)', alt: 'RCA MASTER already used? ZONE (XLR, own ZONE knob) if no zone speakers are on it: an XLR to RCA cable.',
      watch: 'No REC OUT: the RCA MASTER is the spare when the PA is on the XLR pair.',
      net: ['A Denon all-in-one: its LINK port speaks Denon\'s own language (StageLinQ), not the Pioneer DJ network. No titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording).'] },
    { id: 'PRIME-GO', name: 'Denon DJ PRIME GO / GO+', short: 'PRIME GO', maker: 'Denon DJ', kind: 'allinone', link: 'no', also: ['PRIMEGOPLUS', 'PRIMEGO'],
      out: ['MASTER', 'RCA', 'master'], where: 'MASTER, the RCA pair on the back (the PA is usually on the XLR pair)', alt: 'RCA MASTER already used? BOOTH (1/4-inch jacks) with its own BOOTH knob.',
      watch: 'No REC OUT: the RCA MASTER is the spare when the PA is on the XLR pair.',
      net: ['A Denon all-in-one: it doesn\'t join the Pioneer DJ network. No titles or decks from it.',
        'Still works: SOUND IN (meter, SILENCE warning, recording).'] },
    // ---- the rest ----
    { id: 'MODEL-1', name: 'PLAYdifferently MODEL 1', short: 'MODEL 1', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['PLAYDIFFERENTLYMODEL1', 'MODEL1'],
      out: ['RECORD OUT', 'MINI', 'none'], where: 'RECORD OUT, the 3.5 mm (mini jack) socket on the top panel',
      alt: 'RECORD OUT already used? MASTER 2 (1/4-inch jacks, own MASTER 2 knob) if no zone is on it.',
      level: 'RECORD OUT comes before the master fader: no knob, the loud parts sit wherever the mix sits.' },
    { id: 'MODEL-1.4', name: 'PLAYdifferently MODEL 1.4', short: 'MODEL 1.4', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['MODEL14'],
      out: ['RECORD OUT', 'MINI', 'none'], where: 'RECORD OUT, the 3.5 mm (mini jack) socket on the top panel',
      alt: 'RECORD OUT already used? BOOTH (1/4-inch jacks, own knob) if the monitors aren\'t on it.',
      level: 'RECORD OUT comes before the master fader: no knob, the loud parts sit wherever the mix sits.' },
    { id: 'ES-DJR400', name: 'E&S DJR400', short: 'DJR400', maker: 'Other makers', kind: 'mixer', link: 'check', also: ['DJR400'],
      out: ['a spare RCA out', 'RCA', 'check'], where: 'a spare RCA output on the back (check the back panel: it depends on how it was built)',
      alt: 'Check the back panel: some are built with an RCA record out, some with an RCA booth.',
      watch: 'Not checked against the maker\'s page: trust the labels on the back.' },
    { id: 'BOZAK-AR6', name: 'Bozak AR-6', short: 'BOZAK AR-6', maker: 'Other makers', kind: 'mixer', link: 'no', also: ['AR6', 'BOZAK'],
      out: ['TAPE OUT', 'RCA', 'check'], alt: 'TAPE OUT already used? A Y splitter on it.',
      watch: 'On a Bozak the record out is called TAPE OUT.' },
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
      out: ['BOOTH', 'TRS', 'check'], where: 'a spare output on the back: BOOTH, or the RCA master if the PA is on another pair (check the back panel)',
      cable: 'RCA to RCA for an RCA out; 2 x 1/4-inch to 2 x RCA for 1/4-inch jacks.',
      alt: 'Everything busy: a Y splitter on the RCA master.',
      watch: 'Not checked against Rane\'s manual: trust the labels on the back. Never PHONES.' },
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
  function sound(x) {
    if (!x) return null;
    const [use, jack, follows, extra] = x.out || ['REC OUT', 'RCA', 'check'];
    const j = JACK[jack] || JACK.RCA;
    const name = x.kind === 'other' || x.kind === 'laptop' || x.kind === 'none' ? 'mixer' : x.name;
    const level = follows === 'none' ? use + ' has no knob of its own. The loud parts sit wherever the DJ\'s mix sits; that\'s normal.'
      : follows === 'master' ? use + ' follows the MASTER level: turning the room up turns the recording up.'
      : follows === 'booth' ? use + ' has its own BOOTH level knob: set the recording with it, the room stays the same.'
      : follows === 'own' ? use + ' has its own level knob: set the recording with it.'
      : 'Which knob sets ' + use + ' isn\'t confirmed: watch the meter.';
    const loud = follows === 'none' ? 'Red on the loud parts: the DJ\'s mix is running hot (check the mixer\'s MASTER meter). A few flashes are fine.'
      : follows === 'master' ? 'Red on the loud parts: turn MASTER down a little, or use ' + (x.alt ? 'the other output' : 'BOOTH') + ' and set it on its own knob.'
      : follows === 'booth' ? 'Red on the loud parts: turn the BOOTH level knob down a little.'
      : 'Red on the loud parts: turn the level knob for ' + use + ' down a little. ' + (jack === 'XLR' ? 'XLR is hot for a small card.' : '');
    const quiet = follows === 'none' ? 'Quiet: check the mixer is really sending (channel faders up, crossfader). A quiet recording is still usable; it can be turned up after.'
      : follows === 'master' ? 'Quiet: turn MASTER up, or use the BOOTH out and turn its knob up (the room stays the same).'
      : 'Quiet: turn the level knob for ' + use + ' up. A quiet recording is still usable.';
    return {
      id: x.id, name: x.name, use,
      where: x.where || (use + ' (' + j.jack + (jack === 'TRS' ? ' jacks' : '') + ') on the ' + (x.front ? 'front' : 'back') + (extra ? ', ' + extra : '')),
      cable: x.cable || j.cable,
      why: x.watch || (follows === 'none' ? use + ' is there for recording: it carries the mix and nobody else is using it, most nights.' : ''),
      taken: x.alt || 'Every output busy: a Y splitter on the one you need.',
      level: x.level || level, loud: x.loud || loud, quiet: x.quiet || quiet,
    };
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

  return { LIST, PLAYERS, chipFor, byId, fromName, fromText, groups, network, sound, player, current, store, norm };
})();
if (typeof module !== 'undefined') module.exports = Gear;
