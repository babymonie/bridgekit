# Contributing

Start with an issue describing the app/plugin/bug. Adapter requests need exact build/platform/channel details; read [adding an adapter](docs/adding-an-adapter.md).

```powershell
npm ci
npm test
```

Use a focused branch/PR describing trigger, resulting behavior, validation and limits. Actual Electron evidence is needed for desktop claims. Never use account actions, matches or real uploads as fixtures.

Keep clean-clone tests working without proprietary files and explain optional skips. Add meaningful regression checks for changed permission/lifecycle boundaries.

Adapters choose pages/windows; generic runtime must not name plugins; packages own selectors/settings; installers own hashes/backups/rollback. Preserve narrow APIs, sandboxing, sender/grant/path checks and cleanup.

Original contributions are MIT licensed. Preserve dependency notices. Do not commit app archives, third-party extensions, profiles, credentials, private screenshots or machine reports. FORECAST remains an ignored local fixture.

See AGENTS.md and [testing](docs/testing.md).
