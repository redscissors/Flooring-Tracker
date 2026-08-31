# Basket: derived "In this project" kits + bundle snap (ADR 0035 step 2)

Status: done

The Sheoga drawer now shows two sections: the staged basket (persisted,
delete-on-move unchanged) and "In this project" — every placed kit derived
live from the anchor markers (placedKits), with Reconfigure (reopen +
replace via the kitId group) and Remove (removeKitLines). A multi-width
move stamps the whole bundle on its first line, so bundles reopen and are
no longer information loss. Preview shots in this directory; design in
docs/adr/0035-configurator-kit-instance-id.md.
