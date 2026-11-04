# Wand Session Planner — Chrome MV3 plugin

Save up to five session goals, check them off, and set a 5–180 minute break timer. An absolute deadline is saved locally, so it resumes after closing and reopening settings. Reminders appear only while the settings page is open: this package has no background worker, system notifications or alarms. It does not pause games.

Install the folder or ZIP through Wand’s Bridge manager. Requires profile ID `wand`, partial native Chrome compatibility enabled, and a persistent app session. Enable the plugin and open Settings. The only Chrome permission is `storage`. No host permissions, content scripts, network calls, account access or game-process operations.

The same folder can be loaded with Chrome’s Load unpacked control at chrome://extensions (Developer mode). Open its toolbar popup or extension options. Chrome and Wand have separate saved data. BridgeKit’s sidecar restricts Bridge installation to the `wand` profile; Chrome ignores that extra file.

Disable in Bridge manager to close settings and unload the extension. Native data retention after uninstall depends on Electron/browser storage behavior; export is not implemented. See ../../docs/wand-plugins.md.
