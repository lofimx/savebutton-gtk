# Flathub Submission Checklist

First attempt feedback PR:

https://github.com/flathub/flathub/pull/8070

## 1. Validation

All validation checks passed:

```bash
# Validate metainfo
appstreamcli validate data/org.savebutton.SaveButton.metainfo.xml.in

# Validate desktop file
desktop-file-validate data/org.savebutton.SaveButton.desktop.in

# Test Flathub build
flatpak run --command=flathub-build org.flatpak.Builder --install org.savebutton.SaveButton.json

# Regular build
make build
make test
```

### Build Configuration

The production manifest includes:
- GNOME 48 runtime (stable, includes GTK 4.18)
- Offline npm dependency bundling via generated-sources.json (888 packages)
- npm configured for offline mode with cache at /run/build/kaya/flatpak-node/npm-cache
- File system permission for ~/.kaya directory
- All icons (scalable SVG, symbolic, PNGs in 6 sizes)
- AppStream metadata with screenshots
- Git source pointing to v0.1.0 tag

## 2. Flathub Submission Process

1. Go to https://github.com/flathub/flathub/new/new-pr
2. Click "New App Submission" or create a new issue requesting app submission
3. Follow the Flathub bot instructions to create your app repository
4. Once `org.savebutton.SaveButton` repository is created under flathub:
   - Clone it: `git clone https://github.com/flathub/org.savebutton.SaveButton.git`
   - Copy your `org.savebutton.SaveButton.json` into it
   - Add flathub.json if required (bot will tell you)
   - Commit and push
   - Create PR for review

### Command Line Alternative

#### Fork and clone
gh repo fork flathub/flathub --clone --org lofimx && cd flathub
git checkout --track origin/new-pr
git checkout -b add-org.savebutton.SaveButton new-pr

#### Add your files
cp /path/to/org.savebutton.SaveButton.json .
cp /path/to/generated-sources.json .

#### Commit, push, open PR against new-pr branch
git add . && git commit -m "Add org.savebutton.SaveButton"
git push -u origin add-org.savebutton.SaveButton
gh pr create --base new-pr --title "Add org.savebutton.SaveButton"


## Resources

- [Flathub App Submission Guide](https://github.com/flathub/flathub/wiki/App-Submission)
- [Flathub MetaInfo Guidelines](https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines)
- [Flatpak Available Runtimes](https://docs.flatpak.org/en/latest/available-runtimes.html)
- [OARS Content Rating Generator](https://hughsie.github.io/oars/generate.html)
