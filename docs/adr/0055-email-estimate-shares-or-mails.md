# Email estimate: share the PDF on touch devices, save it + open a pre-addressed email on computers

- **Status:** Accepted
- **Date:** 2026-10-02
- **Scope:** Clean header (an icon after Samples) + the phone ⋯ sheet (beside Print); the one-bar and classic headers don't carry it (owner)
- **Related:** `src/emailestimate.jsx`, `src/estimatemail.js`; proof `.scratch/167_email-estimate`

The owner asked for a button that opens an email with the estimate attached as a PDF and
the customer's address filled in. A browser cannot attach a file to a `mailto:` email, so
the button splits by device. Phones and iPads (`!isWide` or a coarse pointer) hand the PDF
to the system share sheet: the file is attached, but the sheet has no recipient slot, so the
customer's email is copied to the clipboard first. Computers save the PDF to Downloads as
`Customer - Project Name.pdf` and open a `mailto:` addressed to the customer with the subject
and message filled in; the salesperson drags the PDF in. The team sends from Windows with
the new Outlook or webmail, and the Windows share window can't reach Outlook on the web or
Gmail in a tab, while a `mailto:` works with any default mail app.

The PDF is the same `EstimatePaper` the Print button and Print preview render (same
`paperProps`, so the option scope follows the preview), drawn into an off-screen root,
captured with `modern-screenshot` and paged into letter-size `jsPDF` pages at the print
sheet's 1.4 cm margins, cutting only between `break-inside: avoid` blocks. Both libraries
load on the first click (ADR 0026).

## Considered options

- **The app sends the email itself** (a Netlify Function + an email service, PDF attached,
  in-app compose box). The only way to fill the recipient AND attach the file; rejected for
  now: it needs a paid sending service, DNS records and a key the owner would set up.
- **Share sheet everywhere.** Rejected on computers: no recipient prefill, and classic
  Outlook / webmail aren't share targets on Windows.
- **The browser's print dialog "Save as PDF"** (vector text, byte-identical to Print).
  Rejected: two dialogs and a manual save before the email even opens.
- **`html2canvas`.** Rejected: it can't parse `color-mix()`, which the sheet uses;
  `modern-screenshot` lets the browser render the CSS itself (SVG `foreignObject`).

## Consequences

- The PDF is an image of the sheet (~0.8 MB for a two-page job), not selectable text.
- The Google Fonts stylesheet is cross-origin, so the screenshot library can't read it and
  would draw a wider fallback face over a layout measured in Manrope; `emailestimate.jsx`
  fetches that stylesheet itself and inlines the latin Manrope files.
- Safari can drop the click's user activation while the PDF builds; a refused share
  raises a one-tap "Share estimate PDF" button that carries a fresh gesture.
