// #144 SWEEP: why a change didn't take, in plain words instead of a number ("Didn't save (415)." -> "Didn't save: reload
// this page, then try again."). One place, so every card says the same thing for the same reason. `j` is the box's JSON
// answer when there is one (its own words win when it has them: callers pass j.error first).
(function () {
  function glWhy(status, j) {
    const s = +status || 0;
    if (j && j.mustChange) return 'pick your own password first (STATUS, top).';
    if (s === 401) return 'unlock STATUS first (password or crew code).';
    if (s === 403) return "that needs the owner's password, at the venue (not a link or tonight's crew code).";
    if (s === 404) return 'the box doesn\'t have that any more: reload this page.';
    if (s === 409) return 'something changed meanwhile: look again, then try again.';
    if (s === 413) return 'too big for the box.';
    if (s === 400 || s === 415) return 'the box didn\'t understand it: reload this page, then try again.';
    if (s === 421) return 'open the box by its own address (ghostlink.local or its number), then try again.';
    if (s === 423) return 'the box is busy with something that can\'t be stopped right now: try again in a minute.';
    if (s === 429) return 'too many tries: wait a minute.';
    if (s >= 500) return 'the box hit a problem: try again; if it keeps happening, RESTART on STATUS.';
    if (!s) return 'no answer from the box: check this phone is on its Wi-Fi.';
    return 'try again.';
  }
  if (typeof window !== 'undefined') window.glWhy = glWhy;
  if (typeof module !== 'undefined') module.exports = glWhy;
})();
