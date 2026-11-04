# Bridge SDK v1 — managed page extensions

The same plugin runs under the FACEIT and local test-bench adapters. The API remains backward compatible with version 1; `bridge.info().sdkVersion` reports `0.2.0`. The 0.4.0 manager creates a separate host for each enabled SDK package.

## Page API

All calls below originate in a plugin panel. The broker binds them to that panel's parent app window; plugins cannot supply another window ID or a target URL.

| Method | Permission | Result |
|---|---|---|
| `page.info()` | `page.read` | Current URL and title |
| `page.query(selector)` | `page.read` | Up to 100 snapshots: tag, ID, text (2,000 characters each) |
| `page.setText(selector, text)` | `page.dom` | Number of changed elements, up to 100 |
| `page.insertHTML(selector, html, position)` | `page.dom` | Inserts a sanitized, plugin-owned wrapper into the first match; position is append or prepend |
| `page.remove(selector)` | `page.dom` | Removes matching plugin-owned wrappers, never arbitrary app-owned nodes |
| `page.addStyle({id, css})` | `page.styles` | Style ID; replaces that ID's previous stylesheet |
| `page.addStyle({id, file})` | `page.styles` | Loads a bundled CSS file |
| `page.removeStyle(id)` | `page.styles` | Whether a stylesheet existed |
| `page.runScript(file, args)` | `page.scripts` | JSON-serializable result from a bundled JavaScript file |
| `page.cleanup()` | `page.scripts` | Aborts script signals, runs cleanup callbacks, removes owned wrappers and inserted CSS |
| `page.onNavigate(callback)` | Notification subscription | Returns an unsubscribe function; callback receives `{url}` |

```js
const page = await window.bridge.page.info();
const headings = await window.bridge.page.query('h1');
await window.bridge.page.setText('#my-extension-label', 'Hello from a plugin');
await window.bridge.page.insertHTML('body', '<aside id="my-widget"><strong>My extension</strong></aside>');
await window.bridge.page.addStyle({ id: 'my-style', css: '#my-widget { color: #fbb86a; }' });
const result = await window.bridge.page.runScript('client.js', { message: 'Hello' });
const unsubscribe = window.bridge.page.onNavigate(({ url }) => console.log(url));
// Later:
unsubscribe();
await window.bridge.page.cleanup();
```

`insertHTML` uses the browser's native safe Sanitizer API with a narrow allowlist: text containers, headings, lists and buttons. Scripts, frames, inline handlers, URL attributes, forms and inline styles are removed. Runtimes without native safe HTML insertion reject that call. Use a bundled client script for richer DOM construction. Use plugin-owned selectors for `setText`: cleanup cannot automatically restore arbitrary app text you replaced.

## Client-side JavaScript

Put code in `client.js` inside the plugin directory. It is an async function body, with `args` and `bridgePage` supplied by the host. `document` is the real app document. This example creates a working button in the app HTML:

```js
const button = document.createElement('button');
button.type = 'button';
button.textContent = args.message;
button.setAttribute('data-bridge-owner', bridgePage.pluginId);
button.addEventListener('click', () => {
  button.textContent = 'Client-side code ran';
}, { signal: bridgePage.signal });
document.body.append(button);
bridgePage.onCleanup(() => button.remove());
return { inserted: true };
```

`bridgePage` contains the plugin ID, a frozen snapshot of its saved settings, an AbortSignal, and `onCleanup(fn)`. Register cleanup for listeners, observers and timers. Closing settings hides the panel. Disabling or disposing the host runs cleanup. A full page navigation destroys the old script context; document-end scripts run again on the new allowed page. SPA navigation emits a notification without automatically rerunning the script. Call the script again if necessary and make it idempotent.

Managed plugins run in separate persisted isolated world IDs (the standalone bench defaults to 1047), separate from the app's JavaScript globals and Electron's preload world. They can read and change the shared DOM and use ordinary browser APIs. **Page-script permission is broad page access:** scripts may read browser-visible data and make requests as that page. The panel's network restrictions do not apply to code deliberately running in the app document. This is not a security boundary between a script and page data, nor protection against slow or malicious page code. Node.js, process execution, raw IPC and native Electron APIs are not provided.

The host only accepts bundled `.js` files, never arbitrary source strings or remote script URLs. Absolute paths, traversal, escaped paths, symlinks outside the package and oversized files are rejected. Script files and returned JSON are limited to 64 KiB; arguments to 8 KiB. Calls time out after five seconds; this bounds waiting, not execution cancellation. Infinite synchronous code can still block the shared app renderer. Use the cleanup signal for cooperative cancellation.

## Automatic content scripts

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "version": "0.1.0",
  "apiVersion": 1,
  "entry": "index.html",
  "permissions": ["panel", "storage.local", "page.read", "page.dom", "page.styles", "page.scripts"],
  "contentScripts": [{ "runAt": "document_end", "js": ["client.js"], "css": ["client.css"] }]
}
```

Only `document_end` timing is supported. The host runs scripts at attachment and after full page loads, for the attached parent window only. The FACEIT adapter allows exactly `https://www.faceit.com`; account/login origins and offscreen or Node-enabled app windows are denied. The test-bench adapter allows only its local fixture. No page API is exposed to the app's main-world scripts.

Content CSS is inserted by Electron, independent of the page's inline-style CSP. Style IDs replace previous inserts. Resource URLs, imports, escapes and comments are rejected by the conservative resource-free CSS policy. Scripts may construct richer UI under `page.scripts` permission. Cleanup removes managed styles and plugin-owned wrappers; plugins must undo any other changes they make.

## Grants and panel isolation

Manifest permissions are requests. `createHost({ grantedPermissions: [...] })` supplies the trusted host's grants; a request outside that set is rejected. The manager reviews declared permissions before enabling an imported package and stores approved grants in the registry. Direct standalone hosts default to panel and storage only. Folder/ZIP imports are validated and copied before activation; no package install scripts run.

Each panel retains sandboxing, context isolation, disabled Node integration, a separate non-persistent session and a narrow preload bridge. The broker authenticates its exact WebContents, main frame and entry URL on every call. Panel network requests, downloads, permissions, popups, navigation, webviews and files outside the plugin directory remain denied. Page code has the broader browser capabilities described above. The adapter and broker are trusted main-process code.

## Settings

```js
await window.bridge.storage.set('enhancePage', true);
const enabled = await window.bridge.storage.get('enhancePage'); // null if missing
```

Requires `storage.local`. Settings are separate by adapter and plugin ID. Keys start with a letter and contain at most 64 letters, digits, underscores, dots or hyphens. Prototype keys are rejected. Values are booleans, finite numbers, null, or strings up to 4,096 characters; the serialized quota is 32 KiB. Writes atomically replace an adjacent temporary file. Settings survive runtime updates and uninstall.

## Adapter integration

After Electron is ready, call `createHost({ adapterId, storageDirectory, pluginDirectory, grantedPermissions, isPageAllowed })`, then `host.attach(browserWindow)`. The URL predicate is trusted adapter configuration. Calls are checked against the current main page and navigation generation, including an in-world URL check before evaluating code. `await host.dispose()` cleans up page resources and destroys the panels.

The manager supports multiple SDK hosts with distinct broker channels and isolated world IDs. SDK main-world injection, document-start timing and background workers are not implemented; native addon capabilities are described below.

## Panel visibility (0.2.1)

Closing the panel hides it without disposing the plugin or removing its page widgets. Ctrl+Shift+B in the app or panel, or the dedicated Bridge tray icon, reopens it. `host.openPanel()` provides the same action to trusted adapters. The tray is removed when its last parent window is destroyed or the host is disposed. Explicit host disposal still runs cleanup.

## Managed packages and Chrome-compatible addons (0.4.0)

The trusted manager owns folder/ZIP installation, discovery, permission review, listing, settings, enable/disable and uninstall. Those controls are independent of every plugin. Entries and grants persist in registry.json. HTML settings entries may be nested inside a package. New local packages are disabled until enabled by the user.

`bridge.addons.list()` returns manager-registered entries and state; `bridge.addons.open(id)` opens an enabled registered plugin's settings for the attached app session. Both require addons.manage. They do not expose arbitrary paths or raw native operations, nor do they provide plugin installation/uninstall privileges to ordinary panels.

Native MV3 packages use Electron extension support plus the bundled compatibility adapter. Supported paths include service workers, resources, popup/options pages, messaging, object storage and selected tabs/windows/permissions APIs. Sync storage falls back to local storage without cloud synchronization. Required nativeMessaging and debugger permissions are rejected; other APIs may be unsupported at runtime. Enabling an extension is not proof of complete Chrome compatibility.

A package may supply bridge-plugin.json with stable id metadata and `settings: {"css": "relative.css"}` to adapt its own settings layout. CSS is contained and size-checked. Runtime hosts do not contain product-specific selectors or extension IDs.

Disabling invokes SDK lifecycle cleanup, closes native settings windows and removes native extensions from observed sessions. MAIN-world hooks and arbitrary DOM mutations may survive until a page reload; the manager exposes a reload notice/control rather than claiming those effects are already gone. SDK cleanup callbacks must remove timers/listeners/observers and undo custom app mutations.

This version has passed Node and actual Electron fixture tests, including 19 manager checks in the installed FACEIT runtime. Normal app/manager opening was checked separately. See VALIDATION.md for evidence and limits.

## Native import and permission reporting (0.4.1)

Content-script manifest resource paths may begin with a slash; the Chrome-specific import path trims leading slashes before containment checks and writes normalized paths only to the managed copy. SDK entries and other filesystem paths retain their strict rules.

Compatibility permissions.getAll and contains derive API permissions and origins from approved registry grants, including content-script matches. Approved required-origin requests succeed without granting additional access. The broker continues denying unapproved origins and supports explicit approval of declared optional clipboardWrite only. Optional origin grants that are not already approved are not implemented.

Known limits include the uploader's offscreen API and Repeek's background polyfill management error; successful installation and permission checks do not establish full feature compatibility.
