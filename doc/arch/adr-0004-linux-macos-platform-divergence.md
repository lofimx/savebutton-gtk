# ADR 0004: Linux / macOS Platform Divergence

## Context

Save Button's GTK client targets two desktop platforms: Linux (packaged as Flatpak, also Snap, DEB, RPM, and Gentoo) and macOS (packaged as a signed `.app` bundle in a DMG). Nearly all of the codebase is shared TypeScript running on GJS with GTK 4 + libadwaita, but a handful of concerns don't have a truly cross-platform answer:

* secret storage (the Linux keyring is not the macOS Keychain)
* bundling (Flatpak runtime vs. a standalone `.app`)
* URL scheme registration (`.desktop` MimeType vs. Info.plist CFBundleURLTypes)
* process launch (what gets run when the user double-clicks)
* server-reported device type (`desktop_linux` vs. `desktop_macos`)

Every one of these would produce subtle, hard-to-test bugs if code elsewhere in the app made assumptions about the host OS. Past bugs (e.g. secrets silently failing to persist, or a login flow that only worked on one platform) have come from exactly this kind of drift.

## Decision

Platform divergence is allowed, but is confined to a small, explicit set of locations. Everything else — models, services, views, the sync pipeline, the gresource-packaged UI and icons — is written once and runs unchanged on both platforms.

**Platform detection.** The `KAYA_PLATFORM` environment variable is the single source of truth. It is set by `build-aux/macos/kaya-shell-launcher.sh` on macOS; absent on Linux (treated as the default). App code reads it via `GLib.getenv("KAYA_PLATFORM")` and branches on `"macos"` / `"windows"` only where necessary.

**The divergent code paths:**

| Concern | Linux | macOS |
| --- | --- | --- |
| Secret storage | libsecret via `gi://Secret` (async) | `security` CLI via `GLib.spawn_sync` (sync) |
| Launcher | meson-generated shell from `src/org.savebutton.SaveButton.in` | `build-aux/macos/kaya-shell-launcher.sh` (sets `KAYA_PLATFORM`, DYLD/GI/GSETTINGS dirs) |
| Bundling | Flatpak (GNOME runtime provides GLib, libadwaita, Adwaita icons) | `build-aux/macos/bundle.sh` copies libs, compiles gschemas, copies Adwaita icon theme |
| URL scheme `savebutton://` | `data/org.savebutton.SaveButton.desktop.in` `MimeType=x-scheme-handler/savebutton` | `build-aux/macos/Info.plist.in` `CFBundleURLTypes` |
| Device-type label (sent to server) | `"desktop_linux"` | `"desktop_macos"` |

**The uniform-across-platforms pieces:**

* GSettings. The schema (`data/org.savebutton.SaveButton.gschema.xml`) is compiled and shipped on both platforms; `bundle.sh` runs `glib-compile-schemas` into the `.app` Resources. Do not introduce a separate settings store for one platform.
* User data directory. `~/.kaya` via `GLib.get_home_dir()`, identical on both.
* All TypeScript sources in `src/` other than the two files noted below.
* All gresource-packaged UI (`.ui`), CSS, and icons.

**The only TypeScript files that should ever branch on `KAYA_PLATFORM`:**

* `src/services/settings_service.ts` — secret storage (password + refresh token).
* `src/services/auth_service.ts` — the `device_type` string sent to the server.

If a future feature needs a third platform-divergent path, add it to this list when the ADR is updated, and keep the branch narrow (prefer a single wrapper method over scattered `if IS_MACOS` checks).

## Status

Accepted.

## Consequences

Reviewers of new code can check this list and be confident that nothing else needs platform-conditional handling. When diagnosing a bug reported on one OS but not the other, the search space is small and well-defined.

The cost is that the two secret-storage implementations in `settings_service.ts` must stay semantically in sync (same schema, same atomic write order). The macOS `security` CLI is synchronous and the libsecret API is async; the service wraps both in an async interface so callers never see the difference. Future changes to secret layout must update both branches together, or break the invariant that the UI's "signed in" state (which assumes atomic updates) depends on.

If a Windows build ever lands through the GTK repo (today, `savebutton-wpf` is a separate WPF project), the `KAYA_PLATFORM === "windows"` branch already stubbed in `settings_service.ts:12,177` is the hook point; the same ADR structure extends to a third column in the table above.
