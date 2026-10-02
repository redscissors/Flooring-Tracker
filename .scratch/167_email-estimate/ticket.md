---
issue_type: Feature
summary: A small Email button between Order entry and Print that opens an email with
  the estimate attached as a PDF, the customer's address filled in when there is one
status: done
labels: [ready-for-human]
---

# Email estimate button

Owner, 2026-10-02: a button about ⅓ the width of Print, between Order entry and Print,
that opens an email with the project attached as a PDF, To filled with the customer's
email (blank when none). Only on the Clean header and the phone layout. PDFs named
"Customer - Project Name". Same day: moved to a plain icon right after the Samples
icon in the Clean header (the phone sheet keeps it beside Print).

Browsers can't attach a file to a `mailto:` email, so (owner picked after the options
were laid out; the team sends from Windows new Outlook/webmail and iPads/phones):

- **Phone / iPad** — the system share sheet with the PDF attached; the customer's email
  is copied first (the share sheet has no recipient slot).
- **Computer** — the PDF saves to Downloads and a pre-addressed email opens (subject,
  message signed with the salesperson); drag the PDF in.

Decision record: ADR 0055.

## Proof

- `sample.pdf` — the real `emailEstimate` over the 090 fixture job doubled (2 pages,
  cut between rows), Manrope embedded. `node .scratch/167_email-estimate/shot.mjs`
  (with `npx vite --port 5199` running): download name, mailto, result.
- `share.mjs` — the touch path with `navigator.share` mocked: accepted, and refused
  once (Safari) → `share-retry.png`, the one-tap Share button.
- `proj-header-clean*.png`, `clean-hover.png` — the button in the Clean layouts
  (header-preview.html); the icon after Samples, with its hover tip.
- `mobile-sheet.png` — the phone ⋯ sheet footer (real MobileSheet, App's footer markup).

Not testable here: a real iOS/Android share sheet and Safari's SVG rendering of the
sheet — check on an iPad once deployed.
