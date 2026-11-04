# FACEIT Ad Cleaner 1.0.0

A standalone Bridge SDK plugin that visually removes FACEIT ad placements and collapses their space. It uses only panel and page.styles permissions. No page JavaScript, network access, account access or Node/Electron API is requested.

## Install

Open Bridge with Ctrl+Shift+B. Choose Install ZIP and select faceit-ad-cleaner.bridge.zip. Review the two permissions, then enable FACEIT Ad Cleaner in the plugin list. A runtime update or app restart is not required. Alternatively use Install folder and select this directory.

## Detection

The stylesheet targets FACEIT AdPlacementWrapper class names, data-fuse ad containers, fuse-slot elements, F_Client_ slot IDs and google_ads_iframe_ frames. It hides the entire supplied post-match wrapper, including its Go premium placeholder, Advertisement labels and Remove Ads link. It does not match ordinary Premium links or match videos by their text.

CSS applies automatically to matching nodes inserted during SPA navigation. Bridge reapplies it after full page loads on the adapter-approved FACEIT origin. Dynamic class hashes following AdPlacementWrapper do not matter.

Disable the plugin through Bridge to remove its stylesheet and restore existing placements. Match elements and ad DOM nodes are preserved, avoiding interference with the app's rendering lifecycle.

## Scope and validation

This is cosmetic filtering: it hides ad elements and their layout space; it does not block ad network requests, bypass subscriptions or unlock Premium. Unknown future ad markup may need new selectors. Bridge currently injects SDK CSS at document_end, so the plugin does not promise zero initial flash.

17 actual Electron checks passed on an offline FACEIT fixture, including the supplied placement structure, zero-height collapse, dynamic insertions, hash changes, navigation, unrelated content and disable cleanup. No live match was interrupted or reloaded. Receipt: ad-cleaner-verification.json in the parent project. Run npm run ad-cleaner:verify from that project to repeat the checks.
