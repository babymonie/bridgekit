# Getting started

Install Node.js 22+, clone the BridgeKit repository and run:

```powershell
npm ci
npm start
```

BridgeKit opens its app picker and scans installed locations. Select a result, read its candidate/blocker status, and choose exact origins or local HTML pages for a generic profile. Fully exit the selected app before Review patch. The final dialog lists the target, backup, sidecar and access before mutation.

Use Add folder or Choose app file for portable/custom installs. Scan coverage is bounded and displayed honestly; candidates are not a guarantee of app startup/plugin compatibility. See [scanner](app-scanner.md) and [general patching](patching-electron.md).

After patching, open the app normally. Ctrl+Shift+B or its Bridge tray icon opens that app's plugin manager. Install a plugin folder/ZIP, review capabilities and enable it. Closing hides UI; disabling stops a plugin and runs cleanup. Finish work/matches before any requested page reload.

New generic profiles are SDK-only by default. Hello panel is a general example; app-targeted packages such as FACEIT Ad Cleaner are restricted to their declared app. Native Chrome compatibility is an optional, partial path.

To try plugins without patching any installed app:

```powershell
npm run demo
```

The offline bench uses its own profile. It is separate from the app patcher. FACEIT users can choose the tested preset in the picker or follow [FACEIT instructions](patching-faceit.md). Existing installations retain their data/receipt format.
