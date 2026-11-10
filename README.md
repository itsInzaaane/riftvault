# RiftVault v1.15 — Collection Navigation + Sorting

This release keeps your existing RiftVault scanner, foil detection, Rune handling, deck allocations, RiftAtlas TXT import, local inventory, daily TCGplayer prices via RiftHunt, Bilgewater links and Excel/JSON exports.

## Improvements
- **Search Cards** now supports sorting by card number (ascending/descending), name (A–Z/Z–A), market price (highest/lowest) and number of copies owned (most/fewest).
- **Inventory** now opens with a branded set gallery instead of listing the full collection. Search your owned inventory or tap **Browse all owned copies** to see quantity controls.
- **Inside every set**, browse individual collector-number printings—including alternate art—with independent search, Owned-only filtering and the same sorting options.
- **Set tiles** combine the former Sets and Inventory pages, include the set completion bar, and say **Cards** instead of Names. Set wordmarks are stylized, original RiftVault typography, not official Riot logos.
- **My Decks** shows the deck's Legend card artwork as the deck cover where the catalogue has an image. Offline, a subtle themed placeholder is used.
- Sort selections are saved only as separate lightweight browser UI preferences. Stock/deck data is unaffected.

**Sorting details:** Card number uses natural numeric sorting and supports alphabetic collector suffixes; highest/lowest prices use exact-printing TCGplayer daily USD estimates via RiftHunt (unknown quotes always appear last); owned copy counts include Bulk, decks and storage, not just unassigned copies. In Search Cards, cards are grouped by name, and the largest quoted printing value is used for price ranking; inside a set, each physical printing is ranked separately. Prices are estimates, not guaranteed sale prices.

## Update your existing installation
1. Open the current app in the same browser and go to **More → Settings & backup → Download JSON** to make a complete backup.
2. Extract the ZIP. Upload **all the included files into the ROOT** of your existing GitHub `riftvault` repository, replacing older versions (don't upload the ZIP itself).
3. Commit your changes. Wait for **Actions → pages build and deployment** to finish successfully.
4. Reopen `https://itsinzaaane.github.io/riftvault/` in the same browser. If you see the old version, close the app fully and reopen; if needed, clear only the site's cached files, **not site storage/data**.
5. Open Inventory and tap a set, then try the Sort by dropdown. Open Search cards and try the same sorting modes.

Inventory is stored under the unchanged `riftvault-local-v1` localStorage key. There is no automatic synchronization across devices. Keep JSON backups, especially before updates. Changes were tested with a simulated browser and an offline catalogue; official artwork/prices require internet access and the external feeds to be reachable from your phone.
