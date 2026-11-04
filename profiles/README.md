# App profiles and presets

faceit.json is the bundled historical FACEIT preset: known hashes, platform and legacy integration metadata. It is not a template to apply to arbitrary apps.

The desktop picker and CLI setup generate machine-local generic profiles. They pin artifact hashes and explicit page access; do not commit real installation paths.

See [scanner](../docs/app-scanner.md) and [general patching](../docs/patching-electron.md). A typical generated profile uses:

```json
{
  "schemaVersion": 1,
  "appId": "my-app",
  "name": "My App",
  "archive": "/absolute/path/resources/app.asar",
  "executable": "/absolute/path/MyApp",
  "sha256": "<64 lowercase hex characters>",
  "executableSha256": "<64 lowercase hex characters>",
  "pageAccess": {
    "origins": ["app://desktop"],
    "localPages": []
  },
  "nativeExtensions": false
}
```

Generate actual hashes with setup; this illustrative JSON is not an installable profile. Origin/local-page policies must not be empty or wildcarded.
