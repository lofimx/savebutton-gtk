setup:
	git submodule update --init --recursive

generated-sources.json:
	flatpak-node-generator npm package-lock.json -o generated-sources.json

clean:
	rm -rf ./flatpak_prod
	rm -rf ./flatpak_app
	rm -rf .flatpak-builder
	rm -rf ./builddir
	rm -rf ./repo
	rm -rf ./eslint-report.txt

lint:
	npx eslint -o eslint-report.txt --no-color src || { cat eslint-report.txt; false; }

test:
	npx jest test

build: generated-sources.json
	npm run bundle:temporal
	npm run bundle:marked
	flatpak-builder --user --force-clean flatpak_app build-aux/flatpak/org.savebutton.SaveButton.json

install:
	flatpak-builder --user --install --force-clean _build_install build-aux/flatpak/org.savebutton.SaveButton.json

# NOTE: Do not use `flatpak-builder --run` here. It creates an incomplete
# sandbox that lacks proper document portal FUSE integration, which breaks
# drag-and-drop file access from file managers on Wayland.
run:
	flatpak run org.savebutton.SaveButton

uninstall:
	flatpak uninstall org.savebutton.SaveButton

flatpak-build:
	flatpak-builder --user --force-clean --repo=repo flatpak_prod org.savebutton.SaveButton.json
	flatpak build-bundle repo org.savebutton.SaveButton.flatpak org.savebutton.SaveButton

flatpak-install:
	flatpak run --command=flathub-build org.flatpak.Builder --install org.savebutton.SaveButton.json

flatpak-lint:
	flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest org.savebutton.SaveButton.json

flatpak-run:
	flatpak run org.savebutton.SaveButton

# --- macOS targets ---

macos-deps:
	@echo "Installing macOS build dependencies via Homebrew..."
	brew install gjs gtk4 libadwaita libsoup gobject-introspection \
		adwaita-icon-theme gdk-pixbuf meson ninja node \
		dylibbundler create-dmg librsvg

macos-build:
	bash build-aux/macos/bundle.sh

macos-dmg: macos-build
	bash build-aux/macos/create-dmg.sh SaveButton.app SaveButton.dmg

macos-run: macos-build
	open SaveButton.app

macos-clean:
	rm -rf builddir-macos
	rm -rf SaveButton.app
	rm -f *.dmg


