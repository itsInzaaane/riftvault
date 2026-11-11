# RiftVault v1.16 — Deck Artwork & Rules Library

Based on **v1.15**. Retains card scanner, rune and alternate-art identification, local collection, deck allocations, TXT imports, sorting, wishlist, daily RiftHunt/TCGplayer price estimates, Bilgewater comparison links, and Excel/JSON backup and export.

## New

1. **Deck card thumbnails:** Opening a deck now shows an image beside every required card. Where possible the thumbnail represents the actual printing assigned to the deck, including alternate art; otherwise the matching catalogue image is used. If a card has no online art, a placeholder is displayed.
2. **Larger deck list text:** Card names are roughly 16–17 px, with more readable secondary information. Layout adapts to narrow mobile screens. Existing allocation, swap and quantity controls remain.
3. **Rules Library:** Dedicated desktop section and **More → Rules library** on phones. Search 35 concise topics covering deck construction, gameplay, keywords, tournament and errata. Filter by category, or search plain-language terms such as `Deflect`, `40 cards`, `combat` or `runes`. Each topic links to an official rulebook. A separate shortcut links to a third-party searchable rendering of the entire Core Rules; the official PDF remains authoritative.
4. **Deck context:** The deck checklist includes **Search Rules Library**, with a return-to-deck shortcut.
5. **Corrected minimum main-deck size check:** Official October 2026 core rule §103.3 says **at least** 40 cards including the chosen champion. The basic checker now flags only decks below 40, not decks above 40.

### Rules accuracy

The Rules Library contains **short, curated reference summaries** for navigating the official rules, not the full text of the 142-page rulebook. The source documents were dated 9 October 2026 when built. Always check [Riot's official Rules Hub](https://playriftbound.com/en-us/rules-hub/) for the newest versions, bans and errata. A local search only searches the included summaries, and is not an AI rules-answering assistant.

## Updating GitHub Pages

1. On the existing RiftVault phone, go to **More → Settings & backup** and save a **JSON backup** before updating.
2. Unzip the release. In your GitHub repository (`riftvault`) upload the **contents** of this folder to the repository root, replacing the previous files, and commit.
3. Check GitHub **Actions → pages build and deployment**. Reopen the same website on your phone after deployment. You might need to fully close/reopen the installed web app to refresh cached content.
4. Open a deck to check artwork and text size. Open **More → Rules library** and search `Deflect` or `Rune Deck`.

Inventory is still stored under the same `riftvault-local-v1` browser-storage key. Updating the app does not intentionally reset inventory or deck assignments. Never clear the browser's **site data** to force a refresh, as this would erase locally stored cards. The app still does not sync its inventory across devices.

## Testing limits

Browser-based interaction, responsive layout and syntax checks can be run locally; the live online card-art catalogue and price feed may be unavailable in test environments. Actual camera OCR should be tested on a physical phone. This is an unofficial Riftbound companion and is not endorsed by Riot Games.
