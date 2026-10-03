# Installers: a shared directory in settings, contact snapshots on the job

- **Status:** Accepted
- **Date:** 2026-10-03
- **Related:** spec `docs/superpowers/specs/2026-10-03-installers-design.md`,
  `src/installers.js`, `src/installersui.jsx`; ADR 0002 (shared settings),
  ADR 0003 (snapshots)

The team keeps a list of installer companies and puts some of them on a job,
where they print at the bottom of the selection sheet. The directory lives in
the shared settings record (`settings.installers`), not its own table: it is a
few dozen rows edited by a handful of people, the shop address already lives
there with the same last-write-wins contract, and no SQL has to be run. A job
holds **copies** of each installer's contact details and trades
(`project.installers`), taken when the installer is added — the ADR 0003
snapshot rule — so a quote keeps printing the installer it went out with after
the directory is edited or an installer is removed. Removing and re-adding the
installer on the job refreshes the copy.

Trades are Tile, Hard Surface (hardwood, vinyl, laminate) and Carpet. A job's
trades are derived from its product lines every time, never stored.

## Considered options

- **An `installers` table** like todos — rejected for now: it needs an
  owner-run SQL file for a list small enough to ride the settings record.
- **Jobs store only installer ids** and read the directory live — rejected:
  an edit or delete in Settings would rewrite every old quote's printout.
