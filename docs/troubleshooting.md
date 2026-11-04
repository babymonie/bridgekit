# Troubleshooting

## Manager disappeared

Closing hides it. Focus the app and press Ctrl+Shift+B, or use the Bridge tray icon under hidden icons. It remains available with all plugins disabled. Loader shortcuts grant no extension access to unsafe pages.

## Changes remain after disabling

Managed CSS is removed and hosts stop, but arbitrary mutations/MAIN-world hooks may need reload. Finish work first. Closing Settings alone is not disabling.

## Invalid package entry path

Select the folder containing manifest.json. SDK entries must be contained relative HTML paths. Native MV3 content-script JS/CSS may begin with a slash in BridgeKit 0.4.1+. Drive paths, traversal and unsafe separators remain rejected. Do not edit the Chrome installation as a workaround.

## Repeek permissions screen

0.4.1 reports both approved FACEIT sites, including content-script matches. Reopen app/settings after updating the closed runtime. This adds no privileges. Its separate background chrome.management/polyfill error remains; correct permissions do not establish full support.

## Uploader imports but cannot upload

Root-relative import is fixed, but chrome.offscreen is unsupported. Enabled/Running does not prove that workflow works. Request the missing API with a synthetic reproduction.

## Sync storage unavailable

No Chrome/Google cloud sync exists. A local fallback is tested for content scripts; other contexts may warn. Do not copy browser databases to work around it.

## Unsupported archive / app changed

Only exact known hashes are accepted. An update may create an unsupported directory. Do not replace hashes/receipts, reuse another build's patch or weaken integrity checks. Submit a build request.

## Modified/unowned files

Update/uninstall refuses these to preserve data. Keep archive, backup, receipt, settings and unknown files. Inspect before changing anything; do not force restore from an unverified backup.

## Package fingerprint changed

Do not edit managed snapshots. Disable/uninstall and install/review revised source; settings remain.

## Skips or fixture failures

Clean clones lack optional packages/archives. GUI diagnostics need a desktop and launch authorization; screenshot capture can fail even with passing geometry assertions. Keep evidence types separate. See [testing](testing.md).

Use the [bug form](https://github.com/babymonie/bridgekit/issues/new?template=bug-report.yml) with versions, reproduction and sanitized errors.
