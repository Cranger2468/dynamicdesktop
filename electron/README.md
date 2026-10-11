# Island for macOS

An Electron desktop companion with a separate frameless transparent overlay, always-on-top status window, menu bar controller, spring animations, interactive event simulator, and offline preference storage. The Lovable website is its browser preview, not a native macOS app.

## Build on your Mac

Requires Node.js 22+ and Bun. From the project folder:

1. `bun install`
2. `bun run desktop:build`
3. `bun run desktop:start` to launch locally.
4. `bun run desktop:package:arm64` for Apple Silicon, or `bun run desktop:package:x64` for Intel.

The packaging script creates `Island-darwin-arm64/Island.app` (or x64) in a temporary release folder and a downloadable ZIP in that folder. Both architectures are separate builds. Move Island.app to Applications, then open it. Close the settings window to keep the island running; use the tray's Quit Island to fully exit. Launch at login is applied through Electron's login-item API.

## System integration and permissions

Battery percentage and charging use `/usr/bin/pmset`; volume uses `/usr/bin/osascript`. Music metadata and playback controls target the running **Music** app, not every music service. Permit Music automation in System Settings → Privacy & Security → Automation when prompted. No microphone/camera access is requested: those event indicators are **simulations**, not system-wide detection. Brightness, notifications, Bluetooth, Focus, downloads, and connectivity are interactive simulations. Media album art and timeline remain preview content even when Music supplies real track text. Generated original artwork is bundled locally. No network connection is required for the packaged app.

The offset and display selector accommodate different displays; no private notch APIs or guessed physical notch dimensions are used. Transparent portions of the overlay pass mouse events through to underlying apps. All preload calls are narrow, IPC senders are checked, Node integration is disabled, and renderer isolation/sandboxing are enabled.

## Signed release and DMG

A macOS binary cannot be launch-tested or signed in the Linux Lovable environment. You must sign on a Mac using your own Developer ID certificate, then notarize with Apple's notarytool before distributing publicly. Unsigned apps may require Control-click → Open, and approval under System Settings → Privacy & Security. Never disable Gatekeeper globally.

To produce a basic drag-to-Applications DMG on a Mac, after signing:

```
mkdir -p /tmp/island-dmg
cp -R /tmp/island-release/Island-darwin-arm64/Island.app /tmp/island-dmg/
ln -s /Applications /tmp/island-dmg/Applications
hdiutil create -volname Island -srcfolder /tmp/island-dmg -ov -format UDZO /tmp/Island.dmg
```

This creates a basic installer, not a customized graphical Finder layout. A polished signed/notarized installer and macOS runtime verification remain release steps. This Electron project does not include Swift or an Xcode project.
