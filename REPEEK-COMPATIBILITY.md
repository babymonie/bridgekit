> Historical local integration notes. Third-party packages and machine-specific receipts are not distributed in Git. See [current compatibility](docs/supported-apps.md) and [testing](docs/testing.md).

# Repeek compatibility â€” static assessment

Inspected on 2026-11-03. **Not yet supported by Bridge v0.2.** A useful next step is a controlled native Electron extension-loading experiment, followed by targeted shims. The host now implements panel/settings capabilities, isolated document-end page scripts, DOM changes and managed CSS. It still does not load Chrome extensions.

## Artifact and evidence

- Chrome Web Store ID: `mokknliiomknodkdmpcellamkopbdmao`.
- Downloaded from Google's extension update endpoint, without executing or installing it.
- Package version: **5.6.18**, manifest version **3**, minimum Chrome **111**.
- CRX SHA-256: `4b58f5bcfcd51251f262a8478f6bf32047cc9c1d3d416403498652c0352c8c63`.
- The store page previously displayed 5.6.17; the downloaded artifact's manifest is the authority for this report.
- `repeek-manifest.json` preserves the inspected manifest. `repeek-analysis.json` records source hashes and literal API references. The original package remains an intermediate local inspection artifact, not a redistributed deliverable.

## Required capabilities

| Observed requirement | Evidence | Bridge v0.2 | Work needed |
|---|---|---|---|
| Content script on `https://www.faceit.com/*` at document end | `faceit/index.js`, manifest | Partial: isolated document-end scripts | Chrome manifest/content-script mapping and exact timing tests still needed |
| Page-world script at document start | `window/script.js`, `world: MAIN` | Absent | Early page-world injection and a narrow message boundary |
| React internal property access | Page-world script inspects `memoizedProps.children` | Absent | Test against FACEIT desktop DOM and React version; desktop parity is unknown |
| Local storage get/set/remove and change events | Literal references in content bundle | Scalar SDK storage only | Chrome object-shaped storage, removal, event delivery, callback/promise behavior |
| Runtime messaging and metadata | `runtime.sendMessage`, `getManifest`, `getURL`, `onMessage` | Absent | Message routing, resource URLs, extension identity and lifecycle |
| MV3 background service worker | `background/index.js` in manifest | Absent | Native worker support or explicitly documented alternative lifecycle |
| Background API/CDN requests | Worker handlers named `repeekExtensionApi` and `repeekExtensionCdn` | Network denied | Audit destinations and authenticated request behavior before adding scoped network access |
| FACEIT API host access | `https://api.faceit.com/*` host permission | Absent | Preserve intended host restrictions and verify requests |
| Flags and fonts | Web-accessible `flags/*.svg`, content CSS `fonts.css` | Plugin-local files and managed page CSS only | Extension resource serving and CSS/font paths |
| Popup and options pages | `action.default_popup`, `options_ui` | Absent | Desktop UI replacements or native extension page windows |
| Open popup/options and permissions APIs | Literal `action.openPopup`, `runtime.openOptionsPage`, `permissions.getAll/request` | Absent | User-facing host equivalents; audit actual runtime use |
| Clipboard write | Manifest `clipboardWrite` | Absent | Explicit clipboard capability and gesture handling |

## Recommended porting sequence

1. FACEIT 2.10.0 reports **Electron 44.7.0**; the updated FACEIT 2.11.0 reports **Electron 45.1.0**. Identify the actual FACEIT page session, then test an unpacked copy of the exact inspected package in that session. Electron supports a subset of Chrome APIs; native success must be measured rather than assumed.
2. Capture load errors and missing APIs. Verify MV3 worker startup, early MAIN-world script execution, content script timing, and extension resource resolution first.
3. Implement only confirmed gaps. Start with storage compatibility and runtime messaging if needed, then popup/options replacements and scoped requests.
4. Verify read-only features before account actions: settings, UI decorations, flags and statistics. Test invite/match automation separately only if requested.

## What this assessment does not prove

The literal text scan includes bundled compatibility-library references, which may not execute. Aliases and computed property access may hide other calls. It is not a complete dependency graph. No Repeek code was run, and no desktop DOM, credentials, API results, background lifecycle, clipboard operation, or match automation was tested. The public Repeek repository describes v4 as deprecated and v5 as closed-source; do not treat v4 source as current v5 evidence.

## Sources

- [Repeek Chrome Web Store listing](https://chromewebstore.google.com/detail/repeek-formerly-faceit-en/mokknliiomknodkdmpcellamkopbdmao)
- [Google extension update endpoint](https://clients2.google.com/service/update2/crx)
- [Repeek public repository and v5 source notice](https://github.com/repeekgg/browser-extension)
- [Electron Chrome extension support](https://www.electronjs.org/docs/latest/api/extensions)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)


Version 0.2 adds isolated-world page scripts and HTML/CSS APIs, but does not implement MAIN-world injection, document-start scripts, Chrome storage semantics, runtime messaging, extension resource URLs, popup/options mapping or the MV3 worker. Repeek is still not supported.

## 4 November 2026: user-installed Repeek 5.6.18

The user independently installed this package into Bridge. A new isolated profile test executed its original options page in the installed FACEIT runtime. getAll now reports both approved https://www.faceit.com/* and https://api.faceit.com/* origins; contains/request recognize them, an undeclared origin request is denied, and the Additional permissions required screen disappears. No Chrome account state was copied and no new grants were added to the user's Repeek entry.

The background worker still produces a webextension-polyfill Proxy invariant error at chrome.management. This is separate from the permission report and remains unresolved. Options-page permission success must not be represented as complete Repeek support. The earlier static analysis above describes historical evidence; compatibility-verification.json records the new targeted execution.
