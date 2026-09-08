Status: done

Owner (2026-09-08): "the extras box is labeled Setting materials and sundries,
and I want that to just be labeled Extras."

The cards layout already titled the box "Extras" on a plain job; the phrase
survived in two places — the quote-options print, where the shared-areas box
read "Setting materials & sundries — shared areas", and the dormant classic
layout. Both now say Extras ("Extras — shared areas" on the options sheet); the
print.js comment that named the old label follows.

Proof — `preview.html`/`preview.jsx` are the 082 options harness with a tile
(grout + mortar) added to the shared Hallway area so the shared-areas box
actually renders (082's vinyl-only Hallway carried no materials). `shot.mjs`
shoots the with-shared sheet in screen and print media and lists the matching
headings: `[ 'Extras — shared areas' ]`.

- `options-with-shared-print.png` / `options-with-shared-screen.png`

`npm test`: 1375 pass, 0 fail. `npm run lint`: 7 errors, identical with the
change stashed (pre-existing).
