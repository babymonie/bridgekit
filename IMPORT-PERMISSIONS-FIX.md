> Historical local integration notes. Third-party packages and machine-specific receipts are not distributed in Git. See [current compatibility](docs/supported-apps.md) and [testing](docs/testing.md).

# Import and Repeek permissions — Bridge 0.4.1

Installed into verified FACEIT 2.11.0 while the app was closed. FACEIT was left closed after the update.

The supplied Chrome extension folder was valid. Its manifest uses /faceit/contentScript.js and /faceit/web.js. Bridge previously treated these as absolute filesystem paths. Chrome instead trims leading slashes for content-script resources, as documented in [Chrome's content scripts manifest reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts). Bridge now follows that rule only for native content-script JS/CSS, retaining containment, traversal and separator checks. Source files in Chrome are unchanged.

The uploader was copied into Bridge's managed registry as chrome-jiphjfgegfhcophdoacldbcpakmoacnc, disabled with zero grants. It appears in the plugin list after reopening. Its offscreen permission refers to an API Bridge does not implement; this update fixes import, not the upload workflow.

Repeek's already-approved registry grants include both required FACEIT origins. The compatibility library previously initialized permissions.origins from manifest.host_permissions alone, omitting the content-script site. Bridge now seeds permission reports from the approved registry grants, includes persisted optional grants, and recognizes requests for already-approved sites. Requests for unapproved origins remain denied. The user's Repeek grants and enable state were preserved.

Verification: 51 Node tests passed. Ten targeted checks passed in FACEIT's installed Electron 45.1.0 runtime: importing the supplied folder disabled, normalizing copied paths, preserving the original manifest, Repeek getAll/contains/request results, undeclared-site rejection, removal of the permissions screen, Node isolation and rendered options content. Separate current manager and FORECAST suites passed 19 and 17 checks respectively.

The targeted test uses copied extension code, a separate temporary profile and blocked/intercepted HTTP(S) traffic. No Chrome cookies, credentials, storage databases or live account operations were used.

Remaining limits: Repeek's background bundle reports a Proxy invariant error when its polyfill reads chrome.management. Fixing its permissions screen does not establish complete Repeek support. The uploader's offscreen workflow also remains unsupported. FORECAST's separate sync-unavailable warning remains documented in VALIDATION.md.

Reopen FACEIT normally, press Ctrl+Shift+B, and open Repeek settings. The additional-permissions screen should no longer appear. The uploader is listed disabled; review its limitations before enabling it. Details are recorded in compatibility-verification.json.
