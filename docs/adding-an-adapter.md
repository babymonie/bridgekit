# Adding an adapter

Most compatible ASAR apps now use a generated profile through the general engine; see [general patching](patching-electron.md). A dedicated adapter is needed only for special integration behavior. Prefer supported source hooks when you own the app. Electron use alone does not establish safe patchability.

## Source integration

Create one manager and observe app windows:

```js
const { app, BrowserWindow } = require('electron');
const { createPluginManager } =
  require('./bridge-runtime/runtime/plugin-manager.cjs');

const manager = createPluginManager({
  adapterId: 'my-app',
  nativeExtensions: false,
  enableBundledDefaults: false,
  isPageAllowed(value) {
    try { return new URL(value).origin === 'https://app.example.com'; }
    catch { return false; }
  }
});
app.on('browser-window-created', (_event, win) => manager.observe(win));
app.whenReady().then(() =>
  BrowserWindow.getAllWindows().forEach(win => manager.observe(win))
);
```

Ship runtime/, vendor/ and chosen plugins/ beside the integration. Use a unique adapterId and exact trusted origin policy. Native MV3 needs compatible persistent sessions.

Verify contextIsolation, disabled Node integration and non-offscreen pages. Exclude login/payment/unrelated origins. Loaders may reopen trusted UI without plugin page access. Test windows/sessions, navigation, quit/restore, cleanup, settings and every-plugin-disabled management.

## Packaged build qualification

For each exact OS/build/channel:

1. Record version, distribution, Electron version and original archive hash.
2. Inspect bootstrap timing, original entry, windows/sessions and update behavior.
3. Establish a reversible integration path. Stop if integrity/signature rules prohibit it; use supported hooks.
4. Preserve original code/backup and stage only owned files.
5. Require a stopped app before archive/runtime changes.
6. Refuse unknown hashes, changed backups and unowned files. Never auto-repatch upgrades.
7. Prove preservation/rollback on offline copies, then runtime fixtures before normal opening.
8. Document supported builds, boundaries and limitations.

Do not weaken fuses, signatures/security controls or alter anti-cheat. Avoid live account actions as fixtures. Submit build details through [App requests](https://github.com/babymonie/bridgekit/issues/new?template=app-request.yml).
