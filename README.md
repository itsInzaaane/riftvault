# RiftVault v1.18 — Set Artwork & Banned Cards

Built on the v1.17 Exact Printings & Card Zoom release. The original `riftvault-local-v1` inventory key and deck allocation schema remain unchanged.

## New in v1.18

- **Real set logos:** Five user-provided transparent PNGs are included locally: Origins, Spiritforged, Unleashed, Vendetta and Radiance. Their artwork appears in Inventory set tiles and set headers. Other sets retain a styled-text fallback.
- **Banned Cards:** Open via desktop sidebar **Banned cards**, mobile **More → Banned cards**, or **More → Rules Library → Banned Cards**. Filter the official snapshot between Standard Constructed (12 entries) and 2v2 Constructed (13 entries); search by name or collector number when metadata is available.
- **Ban notices:** BANNED badges are shown on individual-printing Search Cards, set browsing, owned inventory, card details and deck entries. The only 2v2-only Legend, Master Yi, Wuju Bladesman, is identified separately. All printings with an identical card name share the same legality warning.
- **Deck warning:** Existing Standard deck legality checks now use the same authoritative name matching as the Banned Cards page. An apostrophe or leading “The” should no longer suppress a warning. Bans do not delete or block casual collections.
- All v1.17 changes are retained, including individual printings, card zoom, small mobile deck stats, searchable rules, scanning, finish tracking, deck editing, Rune allocation, daily TCGplayer pricing and Excel export.

## Official source and freshness

Official Riot Games Rules Hub: https://playriftbound.com/en-us/rules-hub/
Ban list snapshot last verified **11 November 2026**. Latest effective official ban change: **18 September 2026**. The app does **not** automatically refresh its ban list from Riot; consult the Rules Hub before tournament play.

## Updating your existing GitHub Pages site

1. **Back up your collection first:** Open RiftVault on your phone, go to **More → Settings & backup**, and download a JSON backup. A GitHub update should not delete local data, but browser storage is not a cloud backup.
2. Download the v1.18 ZIP and unzip it on a computer.
3. Open your existing GitHub repository `riftvault` and choose **Add file → Upload files**. Upload **the contents of the ZIP directly into the repository root** (not the ZIP itself and not an extra folder). Allow the existing files to be replaced.
4. Commit changes, check Actions for a successful Pages deployment, then close and reopen the installed web app on your phone. If the old app persists, refresh without clearing browser site data.

GitHub Pages URL from earlier setup: https://itsinzaaane.github.io/riftvault/

## Limitations

- Online card images and prices require catalogue/price access. Missing artwork and prices remain blank / N/A.
- Bans are based on Riot's dated published list; no automatic ban list sync is claimed.
- Browser-based inventory is device-local. Phone and desktop do not automatically sync.
- Camera OCR and foil recognition are experimental and should be confirmed with physical scans.
- Provided set logo images are fan-project assets; RiftVault is not endorsed by Riot Games.
