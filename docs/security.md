# Security model

## Trusted components

The adapter, installer, registry, manager and brokers are trusted app code. Desktop packaging must not give plugins main-process privileges.

SDK panels retain sandboxing, context isolation, Node-disabled renderers, web security and a narrow preload. Brokers authenticate WebContents/frame/URL and grants. Panel downloads, arbitrary navigation/popups, network resources, webviews and out-of-package files are restricted.

Imports use snapshots, path checks, link rejection and ZIP quotas. Fingerprints prevent activating silently changed managed code. Package install scripts are never executed.

## Page access

Approved page.scripts code can inspect/change browser-visible data and use browser APIs. Worlds share DOM; they do not protect page data or prevent renderer blocking. Prefer page.styles for cosmetic features.

Adapter checks constrain eligible pages. Arbitrary script changes require cooperative cleanup, while managed styles/wrappers have host cleanup. Some changes require reload.

## Native compatibility

The MV3 layer does not reproduce every Chrome permission mechanism. Approved grants drive compatibility reports, but native APIs may remain unsupported. Never substitute raw Node/Electron. Required nativeMessaging/debugger packages are rejected.

No browser cookies, credentials/authentication databases are imported. Cloud sync is not implemented. Ad Cleaner changes visibility, not network traffic or subscription access.

Report issues through [SECURITY.md](../SECURITY.md) using minimal synthetic data.
