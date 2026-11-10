# RiftVault v1.13 — Radiance (RAD) scanner and catalogue fix

## Why RAD cards did not scan
The earlier gallery catalogue could lag Radiance. Version 1.12 had a small offline seed of RAD Runes but not the full numbered RAD set. OCR could correctly read `RAD-061a` without finding the matching card in the index.

## Changes
- Downloads **RiftHunt's full up-to-date printing catalogue** (one browser-readable GET to `https://api.rifthunt.com/bulk/cards`), including standard RAD numbers, alternate artwork, Runes, signature/overnumbered printings, and SP promo codes where present. Caches the current catalogue to use between visits; requires internet for the first complete download.
- Matches collector codes such as `RAD-001`, `RAD-061a`, `RAD-R03`, `RAD-R03a`, `RAD-SP1` and `SFD-088a`. Different printings are not silently merged.
- Shows the **Radiance catalogue readiness** status on the scanner screen so an unpopulated catalogue is not mistaken for an OCR malfunction.
- Preserves all existing saved card IDs when a printing already exists, including cards reserved in decks, scanned cards, their finish, and other storage locations.
- TCGplayer market valuations via RiftHunt remain daily estimates by precise printing/finish. Bilgewater comparison links remain available.
- Keeps deck allocation, rune auto-assignment, TXT import, backup, Recent Scans, foil assessment, set completion, and Excel export.

## Deploy to GitHub Pages
1. **Download Settings → JSON backup** from the existing app before updating.
2. Extract ZIP and upload all files from inside this folder to the root of your existing GitHub `riftvault` repository. Replace all matching files, then Commit changes.
3. After Pages deploys, close and reopen the installed web app. If the scanner still displays the old version, refresh the website without clearing browser site data.
4. With internet access, open **Auto scanner** and check the Radiance readiness status. It should show well over 160 RAD printings.
5. Scan a standard RAD numbered card, a RAD alternate art, and a Rune to check actual camera OCR.

## Notes
- No data migration: the storage key `riftvault-local-v1` remains untouched.
- The scanner does not guarantee detection under all lighting or camera focus conditions. An unreadable number may still need manual search.
- Existing inventory stays local to your current phone/browser; JSON backup is required to transfer devices.
- The app is an unofficial fan-made tool, not an official Riot app.
