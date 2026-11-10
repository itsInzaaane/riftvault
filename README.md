# RiftVault v1.14 — Rune scanning + automatic foil-only alternate arts

## Changes
- Collector-code OCR focuses more tightly on the lower-left identifier, and alternates between wider and inverted OCR crops when no match is found.
- Offline starter catalogue includes standard and alternate-art printings of all six basic runes from Origins, Spiritforged, Unleashed, Vendetta and Radiance. Online RiftHunt catalogue continues to enrich artwork and card data.
- An alternate-art printing ending in `a` is always recorded as **Foil**, even when the scanner is in Manual Finish mode or foil reflections aren't detectable.
- Existing non-foil alternate-art inventory records are migrated to Foil without changing owned quantities, deck assignments or storage locations. A pre-migration local recovery snapshot is stored in `riftvault-pre-foil-only-migration-v114`.
- A printed-code fallback is available within the scanner when the camera cannot focus on miniature text. It identifies the exact set and printing from a typed code.

**Important**: `OGN-042a/298` (Origins) and `SFD-R02a` (Spiritforged) can show similar or identical artwork; use the **printed bottom-left set and collector code**. A website preview may display an incorrect card code relative to the art.

## Publish/update
1. Make a JSON backup from Settings before updating.
2. Upload all files in this folder to the repository root, replacing existing files.
3. Commit, let GitHub Pages deploy, then reopen the app on your phone.
4. Confirm `OGN-042a` and `SFD-R02a` are counted as separate **Foil** printings.

All existing collection, deck, rune allocation, daily market price, scan history, and Excel functionality remains. Physical camera accuracy must be tested on the device; the OCR fallback remains available when necessary.
