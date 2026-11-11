# RiftVault v1.17 — Exact Printings & Card Zoom

Builds on v1.16 and preserves the same browser-storage data key and saved inventory/deck schemas.

## New

1. **One Search result per printing.** Each unique catalogue printing ID is listed separately, including special/promotional and alternate-art variants. Card code, art, rarity, quantity and market price are shown for that printing only. Your existing sorting and set/owned filters remain, and collector number is the default sort for new users.
2. **One-printing card detail.** Selecting a result's *text* opens only that specific printing, with its own Bulk/deck/storage locations, foil and normal counts, price estimates and Add to Bulk controls.
3. **Tap to enlarge artwork.** Tap an image in Search, set browsing, the owned inventory, or an open deck. The enlarged view provides close and zoom controls and returns to your previous position. Deck thumbnails show the assigned physical printing if it has artwork.
4. **Compact deck statistics on mobile.** Required, Assigned, Still Missing and Deck Sections now use smaller 2×2 tiles. Desktop metrics are unchanged.

## Install on GitHub Pages

1. Save a JSON backup from the existing app (**More → Settings & backup**) before updating.
2. Upload all extracted files into the root of your existing `riftvault` repository (replace matching files); commit.
3. Check GitHub Actions for successful Pages deployment. Close/reopen the installed mobile site; if necessary refresh the page normally. **Do not clear site data**, which would delete locally stored inventory.
4. Search `Ahri` to see individual collector-number results; open Renata Glasc's deck and tap a card's thumbnail to enlarge it.

**Note:** Card artwork and market quotes rely on the online catalogue and the RiftHunt feed. Unavailable images show a placeholder; missing prices show N/A. The app is not affiliated with Riot Games.


## Important notes

- Saved cards and decks use the same `riftvault-local-v1` storage key as v1.16. The new version does not intentionally reset data. Back up before updating.
- RiftVault remains device-local and does not synchronize between phone and desktop automatically.
- Card images and TCGplayer market quotes rely on live third-party catalogue feeds. No image or quote is shown as guaranteed if the provider is unavailable.
- The Rules Library contains short explanations, not the full official rulebook; check the official source for current changes.
- Camera OCR and foil recognition still need physical phone testing.
