# General Electron patching

Most eligible packaged apps need a reviewed data profile, not a new JavaScript adapter. The engine preserves original packed members and adds an entry wrapper plus an owned sidecar. It supports nested .cjs/.js CommonJS and .mjs/type-module ESM entries; ESM imports are awaited before Electron ready.

## Guided desktop path

```powershell
npm ci
npm start
```

Use [the scanner](app-scanner.md) to select and review an app. Choose page boundaries explicitly. No detected app is patched or launched just by scanning.

## Guided CLI / reproducible profile

```powershell
npm run bridgekit
npm run bridgekit -- setup "C:\Apps\Example" --id example --local-page renderer/index.html
npm run bridgekit -- plan ".bridgekit/profiles/example.json"
npm run bridgekit -- patch ".bridgekit/profiles/example.json"
npm run bridgekit -- status ".bridgekit/profiles/example.json"
npm run bridgekit -- update ".bridgekit/profiles/example.json"
npm run bridgekit -- restore ".bridgekit/profiles/example.json"
```

Alternatively specify exact origins with repeated --origin, including app://desktop for custom protocols. Use --exe for ambiguous launchers and --output for another new profile file. --json gives structured inspection/plans. Mutation commands confirm by default; --yes is an explicit non-interactive acceptance.

Profiles include schemaVersion, appId, name, archive/executable paths, both SHA-256 hashes, pageAccess.origins/localPages, and nativeExtensions. Paths resolve relative to the profile file; generated profiles use real absolute paths. Setup writes a new profile without overwriting an existing one.

Native Chrome compatibility is off by default. The general SDK path works with persistent or ephemeral app sessions. Data is isolated by app ID under ElectronBridge/apps/<id>.

## Safety and limits

The engine requires a stopped app and rechecks hashes before writes. It uses an operation lock, staged files, exact backup and an ownership inventory. Update replaces only owned runtime files; restore returns the original archive and leaves settings intact.

Backup: app.asar.bridgekit-original. Runtime: resources/bridgekit-runtime beside the archive. The runtime contains its app profile and receipt. The original entry still runs if BridgeKit initialization is skipped.

The general workflow currently requires a packed JavaScript main inside an ASAR no larger than 512 MiB. Default index.js, extensionless .js and directory/index.js entries are resolved. External/unpacked main files, other executable formats, unknown fuse states and macOS bundles are refused. Protected ASAR builds require separate Windows integrity preparation before patching. Windows/Linux process checks are implemented; other platforms are not patch-qualified.

The patch engine hashes and inspects the executable with @electron/fuses. The Windows picker also provides a separately reviewed integrity preparation that backs up the executable and disables only its ASAR integrity fuse. This invalidates its signature. See [Electron's integrity documentation](https://www.electronjs.org/docs/latest/tutorial/asar-integrity). A vendor may have additional startup/signing checks that static inspection cannot establish.

A wrapper changes main-module identity. Apps relying on require.main, executable-specific bootstraps, unusual loaders or native session behavior may need an adapter or supported source hook. Do not interpret Candidate as tested compatibility.

## FACEIT and source integration

Use the FACEIT preset for existing installations:

```powershell
npm run bridgekit -- patch --preset faceit
npm run bridgekit -- update --preset faceit
npm run bridgekit -- restore --preset faceit
```

Its historical exact-build restrictions remain. See [FACEIT instructions](patching-faceit.md). For an app you develop yourself, [source integration](adding-an-adapter.md) avoids archive patching.

## Optional Windows integrity preparation

If ASAR integrity is the only blocker, choose **Review integrity change…**. The native warning defaults to Cancel and explains the loss of tamper protection, invalid executable signature, vendor checks and update risk. Accepting changes only the integrity fuse, preserves an exact `.bridgekit-fuse-original` executable backup and records hashes in `.bridgekit-fuse.json`. It does not patch the archive or start the app. Review page access and choose **Review patch…** afterward. The CLI remains blocked until the executable is prepared separately.

To undo this preparation, first **Restore original app…** if BridgeKit is installed, then **Restore original executable…**. Restoration requires unchanged executable/backup hashes and the original archive hash. Updates or external changes block restoration rather than overwriting a new build. Unknown fuses, launchers without a fuse table, app presets and unsupported platforms cannot use this preparation. Existing manual backups are not adopted automatically.
