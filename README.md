# RiftVault v1.23 — Rarity-Based Auto Foil Scanner

A mobile/desktop Riftbound collection companion built on your v1.20 Blue Shield Edition. Existing inventory, foil/alt/signature printings, rune assignment, set images, TCGplayer/RiftHunt market prices, Bilgewater links, banned labels, decks, OCR scanning, Rules Library and Excel/JSON downloads are retained.


## New in v1.23: Rarity-based finish detection

After OCR identifies an **exact printing** (set + collector number, including `a`/`*`), RiftVault applies the following collector-aware finish policy:

| Physical printing | When scanned in Smart mode |
| --- | --- |
| Standard booster Rare / Epic from Origins, Spiritforged, Unleashed, Vendetta or Radiance | **Foil** assigned automatically |
| Alternate Art / Showcase / Overnumbered / Signed / Ultimate | **Foil** assigned automatically |
| Booster Common / Uncommon | Finish selection **required**; camera reflections are only a hint |
| Standard/basic Rune | Finish selection **required** (Normal or Foil) |
| Alternate-Art Rune (`a` suffix) | **Foil** assigned automatically |
| Proving Grounds starter printings (`OGS`) | **Non-foil** assigned automatically |
| Other promotional / unverified products | Finish selection **required**; do not guess from rarity or price-feed availability |

RiftVault only auto-assigns a fixed finish when a printing is identified. Low-confidence OCR and sensitive collector-number variants still trigger **Smart Scan Verification** first. If the initial OCR drops an alternate-art or Signature marker, confirm the printing before adding. **In Smart mode, Commons, Uncommons and basic Runes always require confirmation**, even if the camera suggests a finish. In Manual mode, your selected finish is used on flexible printings; a known fixed finish still takes precedence.

The add-to-Bulk selectors also respect known fixed-finish rules. The app does **not** silently rewrite existing non-foil Rare/Epic inventory or edit previously saved deck allocations; review older entries manually if they were captured under the wrong finish. Some ready-made decks and special products can have different foil conventions, and a card's printed code may not identify the product in which it was acquired. For those cards, verify the actual finish and consider using a separate product-specific printing if available.

**Rule source:** Riot's published [Collectability in Riftbound: Origins](https://playriftbound.com/en-us/news/announcements/collectability-in-riftbound-origins/) explains the booster foil slot and that booster Rares and Epics are foil. The product-specific starter exception is supported by [Riftbound foil guide](https://riftbound.org/learn/cards/foils). Real camera performance and every promotional printing still require verification.

## Retained from v1.22

- **Mobile Point Counter uses available screen height:** The two red/blue halves expand evenly to fill the screen above the existing bottom navigation, with bigger scoring controls. The display adapts as the browser chrome or phone height changes; it scrolls rather than hiding controls on unusually short devices.
- **Homepage artwork is larger and lower:** The single changing Overnumbered card art is scaled up, positioned lower, and feathered with a broad image alpha mask so there is no visible vertical cut-off. The left-side text retains a readable dark gradient. Applies to phone and desktop.
- **No changes to inventory schema:** Existing saved cards, decks, pricing, rules and scheduled update workflow are retained. The package continues to include `.github/workflows` and `scripts` folders.

## Features retained from v1.21


- **Responsive Home/Overview:** Simplified desktop and phone dashboard with one featured overnumbered card image at a time. Returning to Home chooses a different image, avoiding an immediate repeat when there are alternatives. The picture is loaded from the card catalogue, so it needs an internet connection and a valid image URL.
- **Point Counter:** Open under *More → Point Counter*. Opponent faces away (180° rotated) in red at the top; your score in blue at the bottom. +/−, 50-step Undo history, Reset, 1v1 (8) or 2v2 (11), saved on this device. Reaching a target prompts a win-condition check rather than declaring an automatic victory.
- **Smart Scan Verification:** Ambiguous/low-confidence readings, missing artwork and sensitive Signature/Overnumbered variants pause before counting a copy. Confirm the detected code/card image or select a different printing. The existing foil and alternate-art confirmation steps remain. Recognition must be checked on your physical camera.
- **TXT deck export:** Already included in the source; preserved as *Deck → Export TXT*. Includes the Legend, Champion, MainDeck, Battlefields, Runes and Sideboard section headings/quantities.
- **Automatic local inventory snapshots:** After data changes, IndexedDB stores an updated restore point, retaining up to 20 versions. A new version is started after a quiet 20-minute interval. Open *More → Settings & backup → Review / restore snapshots*. You can export a snapshot as JSON. **These are local backups, not cloud backups.** They can be lost if website data is cleared. On browsers with the File System Access API (some desktop Chromium browsers), optionally choose an external folder for writable JSON backups while permission remains granted. Android may not support this option. Use *Download JSON* regularly for an independent off-device backup.
- **Official bans / rulebook updates:** Includes a dated snapshot (`official-updates.json`) and a GitHub Actions workflow that checks Riot's Rules Hub every six hours, publishes validated bans and current Core/Tournament rulebook links/dates, and updates BANNED labels/legality checks through the app feed. If the check fails, the app retains the prior snapshot and displays an unverified or stale status. **This requires installing/enabling the GitHub workflow; it is not automatic merely by uploading the website files.** The Rules Library's short human-authored summaries remain offline and need manual revision if the actual rules change. The official documents linked from the app follow the latest verified update.
- **Centered app icon:** Uses the updated centered blue shield PNGs for the installed app, browser icon and phone home screen.

## IMPORTANT: How to deploy

1. On the **same browser/phone you use for RiftVault**, open *More → Settings & backup → Download JSON*. Store it outside your phone's web-browser storage.
2. Extract the ZIP. Upload the contents of the package to the **root** of your existing GitHub `riftvault` repository, keeping the file and folder paths exactly as provided. Replace older versions. Do not put the extracted folder itself inside the repository (unless its contents are at the root).
3. Ensure the hidden `.github/workflows/official-rules-refresh.yml` and `scripts/refresh_official.py` paths are present in GitHub. Uploading only loose root files will NOT install the automatic rules checker. To add the workflow manually on GitHub, choose *Add file → Create new file* and type the full filename `.github/workflows/official-rules-refresh.yml`, then paste the YAML from the ZIP. Add `scripts/refresh_official.py` similarly. The `official-updates.json` file must also be at the root.
4. Check your GitHub repository's **Settings → Actions → General → Workflow permissions**. The scheduled workflow needs permission to write repository contents. Set **Read and write permissions** if required, or ask your repository administrator to enable that setting. Do not commit any personal tokens or private API keys.
5. Open **Actions → Refresh official Riftbound rules and bans → Run workflow** once to test it. A green check confirms the scheduled source check completed. It is scheduled every six hours, but GitHub schedules are not guaranteed to run at exact times. If Riot changes its page structure, validation will prevent an unverified overwrite; check the workflow log and the app's source status.
6. Wait for **pages build and deployment** to succeed, then close/reopen `https://itsinzaaane.github.io/riftvault/` on desktop and phone. Refresh the browser if older files remain cached. If the installed icon remains old, you may need to remove and reinstall the home-screen shortcut (do **not** clear site storage).

**The GitHub action depends on official public content, not a Riot API key.** The parser detects ban lists and rulebook document links/dates. It does not automatically regenerate the entire searchable rules text or infer unpublished bans, and it cannot guarantee instant tournament-day availability. Confirm important restrictions against https://playriftbound.com/en-us/rules-hub/.

## Preserving your collection

This version retains `localStorage` key `riftvault-local-v1` for inventory and deck assignments. Updating files under the same website/origin should preserve it. A new browser, an incognito window or cleared site data may contain no collection; restore your JSON file in those cases. This version does **not** sync collection data between phone and desktop.

## Testing and limitations

- Syntax validation passed for JavaScript and Python.
- v1.23 automated browser tests covered 12 rarity/printing cases, including OGN/SFD/RAD foil Rares/Epics, flexible Commons/Uncommons/Runes, alternate-art Runes, foil Signature overnumbered, non-foil OGS starters and unknown promotional cards. A simulated OCR loop verified Rare → Foil inventory entry and Common → finish confirmation before counting. Tested at 320px, 390px and 1100px with no page-script errors or horizontal overflow.
- Browser-interaction simulations passed at widths 320, 390, 768 and 1100px: new homepage, switching overnumbered images, red/blue counter scoring and Undo, official snapshot validation, Jinx TXT parsing (60 cards), and Smart Scan Verification preventing an automatic add until confirmation.
- Python official-source parser passed fixture checks (12 Standard + 13 2v2 bans). Real scheduled runs require the workflow to be installed and enabled on your GitHub repository.
- **Not verified in a real phone browser here:** Samsung camera OCR/foil detection, an actual scheduled GitHub job, live artwork/CDN pricing, and IndexedDB restore/cloud folder functionality. Please test with a small sample and retain your exported backup.

RiftVault is an unofficial personal-use fan application and is not affiliated with or endorsed by Riot Games.
