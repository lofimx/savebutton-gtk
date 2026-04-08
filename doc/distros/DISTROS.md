# Releasing Save Button to Linux Distros and macOS

Save Button is published to seven distribution targets. This document covers the full release process.

## Quick Reference

| Distro | Portal | Workflow |
|---|---|---|
| AUR | [aur.archlinux.org](https://aur.archlinux.org/packages/savebutton) | `.github/workflows/aur.yml` |
| Snap | [snapcraft.io](https://snapcraft.io/) | `.github/workflows/snap.yml` |
| Flatpak | [flathub.org](https://flathub.org/) | `.github/workflows/flatpak.yml` |
| DEB | GitHub Releases | `.github/workflows/deb.yml` |
| RPM | GitHub Releases | `.github/workflows/rpm.yml` |
| Gentoo | Custom overlay | `.github/workflows/gentoo.yml` |
| macOS DMG (arm64) | GitHub Releases | `.github/workflows/macos.yml` |
| macOS DMG (x86_64) | GitHub Releases | `bin/release-macos-intel.rb` (local) |

## How Releases Work

1. Tag a release (e.g. `git tag v0.2.0 && git push origin v0.2.0`).
2. The `v*` tag triggers all seven GitHub Actions workflows.
3. Each workflow builds its package and attaches it to the GitHub Release (via `softprops/action-gh-release@v2`). AUR is an exception -- it pushes a PKGBUILD update directly to the AUR.
4. **After the tag push**, run `ruby bin/release-macos-intel.rb` on an Intel Mac to build and upload the x86_64 DMG to the same release. (If `release.rb` was run on macOS, this happens automatically.)
5. Snap, Flatpak, DEB, RPM, Gentoo, and macOS also run **nightly builds** on `main` branch pushes, uploaded as workflow artifacts (not attached to a release).

## Build Artifacts

| Distro | Release asset | Nightly artifact |
|---|---|---|
| AUR | *(pushed to AUR, not attached)* | *(release-only)* |
| Snap | `savebutton_*.snap` | `savebutton-snap-nightly` |
| Flatpak | `org.savebutton.SaveButton.flatpak` | *(builder cache only)* |
| DEB | `savebutton_*_amd64.deb` | `savebutton-deb-nightly` |
| RPM | `savebutton-*.x86_64.rpm` | `savebutton-rpm-nightly` |
| Gentoo | `savebutton-*.ebuild` + `savebutton-*-deps.tar.xz` | *(build verification only)* |
| macOS DMG (arm64) | `SaveButton-*-arm64.dmg` | `savebutton-macos-nightly` |
| macOS DMG (x86_64) | `SaveButton-*-x86_64.dmg` | *(local build only)* |

---

## GitHub Secrets

The automated workflows require these repository secrets (Settings > Secrets and variables > Actions).

### AUR

| Secret | Description | How to get it |
|---|---|---|
| `AUR_USERNAME` | AUR account username | Your [aur.archlinux.org](https://aur.archlinux.org/) account username |
| `AUR_EMAIL` | AUR account email (currently `steven@deobald.ca`) | Your AUR account profile |
| `AUR_SSH_PRIVATE_KEY` | SSH private key registered with AUR for git push access | Generate with `ssh-keygen -t ed25519 -C "aur"`, then add the **public** key to your [AUR account SSH keys](https://aur.archlinux.org/account/) |

### macOS

All base64 values should be encoded without line breaks (`base64 -w 0` on Linux, `base64` on macOS).

| Secret | Description | How to get it |
|---|---|---|
| `MACOS_CERTIFICATE_P12` | "Developer ID Application" certificate, base64-encoded | Keychain Access > find "Developer ID Application" cert > right-click > Export Items... > save as `.p12` > `base64 < cert.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password set when exporting the `.p12` file | Set during export |
| `MACOS_SIGNING_IDENTITY` | Full codesign identity string (e.g. `"Developer ID Application: Your Name (TEAMID)"`) | Run `security find-identity -v -p codesigning` on a Mac with the cert installed |
| `MACOS_NOTARIZE_APPLE_ID` | Apple ID email for notarization | Your Apple Developer account email |
| `MACOS_NOTARIZE_PASSWORD` | App-specific password for notarization | [appleid.apple.com](https://appleid.apple.com/) > Sign-In and Security > App-Specific Passwords > Generate |
| `MACOS_NOTARIZE_TEAM_ID` | Apple Developer Team ID (e.g. `FDPGS97G76`) | [developer.apple.com/account](https://developer.apple.com/account) > Membership Details |

**How to get the Developer ID certificate:**

1. Go to [developer.apple.com/account](https://developer.apple.com/account) > Certificates, Identifiers & Profiles > Certificates
2. Create a new "Developer ID Application" certificate (requires a Certificate Signing Request from Keychain Access)
3. Download and double-click to install it in your Keychain
4. In Keychain Access, right-click the certificate > Export Items... > save as `.p12` (set a password)
5. Encode: `base64 < DeveloperIDApplication.p12 | pbcopy` (macOS) or `base64 -w 0 < DeveloperIDApplication.p12` (Linux)
6. Add the base64 string as `MACOS_CERTIFICATE_P12` and the password as `MACOS_CERTIFICATE_PASSWORD`

### Snap, Flatpak, DEB, RPM, Gentoo

These workflows require **no secrets**. They build packages using only the source code and public package repositories.

---

## AUR

### First-Time Setup

1. Create an account on [aur.archlinux.org](https://aur.archlinux.org/)
2. Add your SSH public key to your AUR account
3. Create the AUR package: `git clone ssh://aur@aur.archlinux.org/savebutton.git`, add a `PKGBUILD` and `.SRCINFO`, commit, and push
4. Add `AUR_USERNAME`, `AUR_EMAIL`, and `AUR_SSH_PRIVATE_KEY` as GitHub repository secrets

### Release Procedure

Fully automatic. When a `v*` tag is pushed:

1. The workflow extracts the version from the tag
2. Substitutes `VERSION_PLACEHOLDER` in `build-aux/aur/PKGBUILD`
3. Pushes the updated PKGBUILD to the AUR using `KSXGitHub/github-actions-deploy-aur@v3.0.1`
4. `updpkgsums: true` ensures checksums are recalculated automatically

No manual steps required after tag push.

### Troubleshooting

- **SSH auth failure**: The AUR SSH private key may have been rotated. Regenerate a key pair and update both the AUR account and the `AUR_SSH_PRIVATE_KEY` secret.
- **PKGBUILD lint errors**: The AUR enforces `namcap` checks. Run `namcap PKGBUILD` locally to validate before pushing.

---

## Snap

### First-Time Setup

1. Register a Snap name on [snapcraft.io](https://snapcraft.io/) (`snapcraft register savebutton`)
2. The `snap/snapcraft.yaml` in the repo defines the Snap build

### Release Procedure

Automatic build on tag push. The workflow:

1. Builds using `snapcore/action-build@v1`
2. Attaches the `.snap` file to the GitHub Release

**Note:** The workflow does not publish to the Snap Store automatically. To publish:

1. Download the `.snap` from the GitHub Release
2. `snapcraft upload savebutton_*.snap --release=stable`

Alternatively, configure Snapcraft credentials as a secret to automate publishing.

### Troubleshooting

- **Build failure**: The `snapcraft.yaml` may reference packages unavailable in the build environment. Check the build log for missing dependencies.
- **Snap won't install**: Verify interfaces and plugs in `snapcraft.yaml`. Run `snap install savebutton_*.snap --dangerous` locally to test.

---

## Flatpak

### First-Time Setup

1. Create a Flatpak manifest at `build-aux/flatpak/org.savebutton.SaveButton.json` (and a top-level `org.savebutton.SaveButton.json` for release builds)
2. Submit to Flathub by opening a PR at [github.com/flathub/flathub](https://github.com/flathub/flathub) with the manifest
3. Once accepted, Flathub builds are managed through the Flathub GitHub org

### Release Procedure

Automatic build on tag push. The workflow:

1. Builds in a `gnome-49` container using `flatpak/flatpak-github-actions/flatpak-builder@v6`
2. Attaches the `.flatpak` bundle to the GitHub Release

**Note:** For Flathub distribution, the Flathub repo's manifest must be updated separately (typically via a PR to the Flathub repo with the new release tag/URL).

### Troubleshooting

- **Builder cache issues**: The nightly and release builds use different cache keys. If builds fail after dependency changes, clear the GitHub Actions cache.
- **Runtime not found**: Ensure the manifest targets a runtime available in the `gnome-49` container image.

---

## DEB

### First-Time Setup

1. Create `build-aux/deb/control` with package metadata (using `VERSION_PLACEHOLDER` for the version)
2. Create `build-aux/deb/postinst` and `build-aux/deb/postrm` scripts
3. No external registry setup required -- DEBs are attached to GitHub Releases

### Release Procedure

Automatic build on tag push. The workflow:

1. Builds on `ubuntu-24.04` with meson
2. Packages using `dpkg-deb` with the control file from `build-aux/deb/`
3. Attaches the `.deb` to the GitHub Release

Users install with: `sudo dpkg -i savebutton_*_amd64.deb && sudo apt-get install -f`

### Troubleshooting

- **Dependency issues on install**: Ensure all runtime dependencies are listed in `build-aux/deb/control`. Run `dpkg -I savebutton_*.deb` to inspect the package.
- **Build fails on Ubuntu**: Check that `ubuntu-24.04` still provides all required `-dev` packages. The runner image is updated by GitHub periodically.

---

## RPM

### First-Time Setup

1. Create `build-aux/rpm/savebutton.spec` with package metadata (using `VERSION_PLACEHOLDER`)
2. No external registry setup required -- RPMs are attached to GitHub Releases

### Release Procedure

Automatic build on tag push. The workflow:

1. Builds in a `fedora:41` container using `rpmbuild`
2. Attaches the `.rpm` to the GitHub Release

Users install with: `sudo dnf install savebutton-*.x86_64.rpm`

### Troubleshooting

- **Spec file errors**: Run `rpmlint build-aux/rpm/savebutton.spec` locally to catch issues.
- **Missing build dependencies in Fedora container**: The `fedora:41` image is minimal. Ensure all `BuildRequires` are installed in the workflow's dependency step.

---

## Gentoo

### First-Time Setup

1. Create an ebuild template at `build-aux/gentoo/savebutton-VERSION_PLACEHOLDER.ebuild`
2. Create `build-aux/gentoo/metadata.xml`
3. To get into the official Gentoo repository, file a bug at [bugs.gentoo.org](https://bugs.gentoo.org/) with the ebuild, or maintain a custom overlay

### Release Procedure

Automatic build and verification on tag push. The workflow:

1. Builds in a `gentoo/stage3` container
2. Creates a custom overlay, substitutes the version, and runs `emerge`
3. Runs `pkgcheck scan` to validate the ebuild
4. Attaches the ebuild and deps tarball to the GitHub Release

**Note:** This does not automatically publish to any Gentoo repository. The ebuild and deps tarball are attached to the GitHub Release for users who maintain custom overlays. To submit to the official tree, file a version bump bug at [bugs.gentoo.org](https://bugs.gentoo.org/).

### Troubleshooting

- **`pkgcheck scan` warnings**: These are informational. The workflow runs `pkgcheck scan || true` so warnings don't fail the build. Review the output for actionable issues.
- **Emerge fails on dependencies**: The workflow configures specific USE flags in `/etc/portage/package.use/savebutton-deps`. If new transitive dependencies appear, additional USE flags may be needed.
- **Slow builds**: The workflow uses `--getbinpkg` to pull binary packages for dependencies. If the Gentoo binary host is down or stale, builds will compile from source and take significantly longer.

---

## macOS DMG

macOS builds produce two DMGs per release: one for Apple Silicon (arm64) and one for Intel (x86_64). The arm64 build runs in GitHub Actions on a free `macos-latest` runner. The Intel build runs locally on an Intel Mac because GitHub's x64 macOS runners (`macos-*-large`, `macos-*-intel`) are paid "larger runners" with no free tier.

### First-Time Setup

All steps must be done on a Mac.

1. **Apple Developer account**: Enroll at [developer.apple.com](https://developer.apple.com/). The "Developer ID Application" certificate type requires a paid Apple Developer Program membership ($99/year).

2. **Create the Developer ID Application certificate**:
   - Open Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority
   - Go to [developer.apple.com/account](https://developer.apple.com/account) > Certificates > Create a "Developer ID Application" certificate using the CSR
   - Download and install the certificate

3. **Export and encode the certificate for CI (arm64 builds)**:
   - In Keychain Access, right-click the "Developer ID Application" certificate > Export Items... > save as `.p12`
   - `base64 < DeveloperIDApplication.p12 | pbcopy`
   - Add as `MACOS_CERTIFICATE_P12` secret; add the export password as `MACOS_CERTIFICATE_PASSWORD`

4. **Get the signing identity string**:
   - `security find-identity -v -p codesigning`
   - Copy the full identity string (e.g. `"Developer ID Application: Steven Deobald (TEAMID)"`)
   - Add as `MACOS_SIGNING_IDENTITY` secret

5. **Create an app-specific password for notarization**:
   - Go to [appleid.apple.com](https://appleid.apple.com/) > Sign-In and Security > App-Specific Passwords
   - Generate a new password, add as `MACOS_NOTARIZE_PASSWORD`
   - Add your Apple ID email as `MACOS_NOTARIZE_APPLE_ID`
   - Add your Team ID (from [developer.apple.com/account](https://developer.apple.com/account) > Membership Details) as `MACOS_NOTARIZE_TEAM_ID`

6. **Add all six macOS secrets** to the GitHub repository (Settings > Secrets and variables > Actions)

7. **Intel Mac setup** (for local x86_64 builds):
   - Install the same Developer ID Application certificate in the Intel Mac's keychain
   - Install Homebrew dependencies: `brew install gjs gtk4 libadwaita libsoup gobject-introspection adwaita-icon-theme gdk-pixbuf meson ninja node dylibbundler create-dmg librsvg gh`
   - Authenticate `gh`: `gh auth login`
   - Set signing/notarization env vars in your shell profile (or export them before running the script):
     ```
     export MACOS_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
     export MACOS_NOTARIZE_APPLE_ID="your@email.com"
     export MACOS_NOTARIZE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
     export MACOS_NOTARIZE_TEAM_ID="YOURTEAMID"
     ```

### Release Procedure

**Step 1: Push the tag.** This triggers the GitHub Actions workflow for arm64.

**Step 2 (arm64 -- automatic):** The `macos.yml` workflow:

1. Installs Homebrew dependencies on a `macos-latest` runner (arm64)
2. Imports the signing certificate into a temporary CI keychain
3. Runs `build-aux/macos/bundle.sh` to create `SaveButton.app`
4. Runs `build-aux/macos/create-dmg.sh` to sign, notarize, and create `SaveButton-{version}-arm64.dmg`
5. Attaches the DMG to the GitHub Release

**Step 3 (x86_64):** If `release.rb` was run on macOS, it automatically runs `bin/release-macos-intel.rb` after pushing the tag. If `release.rb` was run on Linux, it prints instructions. On the Intel Mac, run:

```bash
cd /path/to/savebutton-gtk
git pull
ruby bin/release-macos-intel.rb
```

The script:
1. Verifies it's running on macOS x86_64
2. Detects the latest `v*` tag, checks it out
3. Runs `bundle.sh` to build the .app
4. Runs `create-dmg.sh` to sign, notarize, and create `SaveButton-{version}-x86_64.dmg`
5. Uploads the DMG to the GitHub Release via `gh release upload`

Both DMGs end up on the same GitHub Release. Users install by opening the appropriate DMG and dragging Save Button to Applications.

### Troubleshooting

- **Codesign fails with "identity not found"**: The certificate was not imported correctly. Verify `MACOS_CERTIFICATE_P12` is valid base64 and the password matches (CI), or that the certificate is installed in Keychain Access (local Intel build). Run `security find-identity -v -p codesigning` to confirm.
- **Notarization fails with "invalid credentials"**: The app-specific password may have been revoked. Generate a new one at [appleid.apple.com](https://appleid.apple.com/).
- **Notarization fails with "invalid signature"**: All Mach-O binaries (dylibs, executables) must be signed before the app bundle itself. The `create-dmg.sh` script handles this order, but if new binaries are added to the bundle, they must be included in the signing loop.
- **DMG won't open on user's Mac ("unidentified developer")**: The DMG was not notarized or the notarization ticket was not stapled. Check the workflow logs (arm64) or terminal output (Intel) for notarization errors.
- **Homebrew dependency changes**: If `bundle.sh` fails after a Homebrew update, check that all required packages are installed. Compare with the prerequisites comment at the top of `build-aux/macos/bundle.sh`.
- **`release-macos-intel.rb` fails with "No v* tags found"**: Run `git fetch --tags` and verify tags exist with `git tag -l 'v*'`.
- **`gh release upload` fails with 404**: The GitHub Release may not have been created yet (the arm64 workflow creates it). Wait for the CI workflow to complete, or create the release manually with `gh release create v0.2.0`.
