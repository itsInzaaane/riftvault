# RiftVault v1.20 — Blue Shield Edition

Built on v1.18, retaining the card scanner, rune and foil handling, decks, banned-card labels, TXT import, Excel/JSON export, Rules Library, exact-printing search, five set PNG logos and daily TCGplayer pricing via RiftHunt.

## New in this release

- **Blue Shield branding:** Uses the user-selected minimalist blue-shield/card icon across PWA icons and website; matching dark navy and electric-blue theme.
- **Main sets first:** Origins, Spiritforged, Unleashed, Vendetta and Radiance, followed by other sets alphabetically. All set logos retained.
- **Signature vs unsigned overnumbered:** Distinct collector keys and exact RiftHunt printing IDs, so one variant never borrows the other variant's price. A missing quote is `N/A`; existing locally misidentified cards should be corrected manually. `*` and legacy `s` signature markers are supported.
- **Deck assignment suggestions:** On a successful card scan, if any incomplete deck needs that printing, a popup offers Assign 1 / Not now. It does not automatically allocate cards. Each deck also shows a badge and a Review available cards action when unassigned Bulk copies can fill deck requirements. Rune matching still works across sets.

## Update existing GitHub Pages site

1. On your PHONE, open RiftVault → More → Settings & backup → Download JSON. Store this backup safely.
2. Extract the ZIP, upload ALL files (including the new icon files and set PNG files) directly into the root of your existing GitHub `riftvault` repository, replacing the old files.
3. Commit, confirm the Pages deployment under Actions, then close/reopen the phone web app. If the old theme persists, refresh the page without clearing website data.
4. Test one Signature and one unsigned overnumbered card: their market values must be separate or `N/A`. Test a deck with one missing card, scan that card and confirm the prompt offers allocation to the correct deck.

## Safeguards and limitations

- Inventory data remains in the same browser localStorage key `riftvault-local-v1`. Phone and desktop do not automatically sync.
- Do not delete site data. Save JSON backups before updating. Updating website files does not intentionally rewrite inventory quantities or decks.
- Daily TCGplayer market estimates from RiftHunt are not instant sale prices. Exact printing prices require a live feed; `N/A` indicates no verified matching quote. No Bilgewater price is claimed to be live; comparison links remain.
- Browser camera OCR and foil assessment are experimental; verify physical scans on your own phone.
- The banned list is a dated reference; check official tournament rules for changes.
- RiftVault is an unofficial fan companion and is not affiliated with Riot Games.
