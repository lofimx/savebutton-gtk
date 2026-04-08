#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Kaya macOS .app Bundle Script
#
# Builds the Kaya application with Meson, then constructs a self-contained
# macOS .app bundle with GJS, GTK4, libadwaita, and all native dependencies.
#
# Prerequisites: brew install gjs gtk4 libadwaita libsoup gobject-introspection \
#   adwaita-icon-theme gdk-pixbuf meson ninja node dylibbundler librsvg
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_NAME="SaveButton"
APP_ID="org.savebutton.SaveButton"
VERSION=$(grep "version:" "$PROJECT_ROOT/meson.build" | head -1 | sed "s/.*'\(.*\)'.*/\1/")

# Detect Homebrew prefix (arm64 vs x86_64)
if [ -d "/opt/homebrew" ]; then
    BREW_PREFIX="/opt/homebrew"
elif [ -d "/usr/local/Homebrew" ]; then
    BREW_PREFIX="/usr/local"
else
    echo "ERROR: Homebrew not found. Install from https://brew.sh"
    exit 1
fi

BUILDDIR="$PROJECT_ROOT/builddir-macos"
APPDIR="$PROJECT_ROOT/${APP_NAME}.app"
CONTENTS="$APPDIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "=== Building Save Button $VERSION for macOS ==="
echo "Homebrew prefix: $BREW_PREFIX"
echo "Architecture: $(uname -m)"

# ---- Step 1: Meson build ----
echo "--- Step 1: Meson build ---"

cd "$PROJECT_ROOT"
git submodule update --init --recursive
npm install --silent
npm run bundle:temporal --silent

if [ -d "$BUILDDIR" ]; then
    rm -rf "$BUILDDIR"
fi

PKG_CONFIG_PATH="${BREW_PREFIX}/lib/pkgconfig:${BREW_PREFIX}/share/pkgconfig" \
PATH="${BREW_PREFIX}/bin:$PATH" \
  meson setup "$BUILDDIR" \
    --prefix="$RESOURCES" \
    --datadir=share \
    --bindir=bin

ninja -C "$BUILDDIR"

# ---- Step 2: Create .app skeleton ----
echo "--- Step 2: Creating .app bundle ---"

rm -rf "$APPDIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES/bin"
mkdir -p "$RESOURCES/lib/girepository-1.0"
mkdir -p "$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders"
mkdir -p "$RESOURCES/share/kaya"
mkdir -p "$RESOURCES/share/glib-2.0/schemas"
mkdir -p "$RESOURCES/share/icons/hicolor"

# ---- Step 3: Info.plist ----
echo "--- Step 3: Info.plist ---"

sed "s/@VERSION@/$VERSION/g" "$SCRIPT_DIR/Info.plist.in" > "$CONTENTS/Info.plist"

# ---- Step 4: Generate .icns icon ----
echo "--- Step 4: Generating .icns ---"

ICONSET_DIR="$SCRIPT_DIR/savebutton.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

ICON_SRC="$PROJECT_ROOT/data/icons/hicolor"
SVG_SRC="$PROJECT_ROOT/icon.svg"

# Copy existing PNGs to iconset with required naming convention
cp "$ICON_SRC/16x16/apps/$APP_ID.png"   "$ICONSET_DIR/icon_16x16.png"
cp "$ICON_SRC/32x32/apps/$APP_ID.png"   "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICON_SRC/32x32/apps/$APP_ID.png"   "$ICONSET_DIR/icon_32x32.png"
cp "$ICON_SRC/64x64/apps/$APP_ID.png"   "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICON_SRC/128x128/apps/$APP_ID.png" "$ICONSET_DIR/icon_128x128.png"
cp "$ICON_SRC/256x256/apps/$APP_ID.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICON_SRC/256x256/apps/$APP_ID.png" "$ICONSET_DIR/icon_256x256.png"

# Generate larger sizes from SVG
rsvg-convert -w 512 -h 512 "$SVG_SRC" -o "$ICONSET_DIR/icon_256x256@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_SRC" -o "$ICONSET_DIR/icon_512x512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_SRC" -o "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES/savebutton.icns"
rm -rf "$ICONSET_DIR"

# ---- Step 5: Copy GResource bundles ----
echo "--- Step 5: Copying GResource bundles ---"

cp "$BUILDDIR/src/$APP_ID.src.gresource" "$RESOURCES/share/kaya/"
cp "$BUILDDIR/data/$APP_ID.data.gresource" "$RESOURCES/share/kaya/"

# ---- Step 6: GSettings schemas ----
echo "--- Step 6: Compiling GSettings schemas ---"

cp "$PROJECT_ROOT/data/$APP_ID.gschema.xml" "$RESOURCES/share/glib-2.0/schemas/"
"${BREW_PREFIX}/bin/glib-compile-schemas" "$RESOURCES/share/glib-2.0/schemas/"

# ---- Step 7: Copy icons ----
echo "--- Step 7: Copying icons ---"

cp -R "$PROJECT_ROOT/data/icons/hicolor" "$RESOURCES/share/icons/"

# Adwaita icon theme is required by libadwaita for symbolic icons
ADWAITA_ICONS="${BREW_PREFIX}/share/icons/Adwaita"
if [ -d "$ADWAITA_ICONS" ]; then
    cp -R "$ADWAITA_ICONS" "$RESOURCES/share/icons/"
fi

# ---- Step 8: Copy GJS binary ----
echo "--- Step 8: Copying GJS binary ---"

GJS_BIN="${BREW_PREFIX}/bin/gjs"
if [ ! -f "$GJS_BIN" ]; then
    echo "ERROR: gjs not found at $GJS_BIN"
    exit 1
fi
cp "$GJS_BIN" "$RESOURCES/bin/gjs"

# ---- Step 9: Bundle dylibs with dylibbundler ----
echo "--- Step 9: Bundling dylibs ---"

dylibbundler \
    -of \
    -b \
    -x "$RESOURCES/bin/gjs" \
    -d "$RESOURCES/lib/" \
    -p "@executable_path/../Resources/lib/" \
    -s "${BREW_PREFIX}/lib"

# ---- Step 9b: Bundle GI-loaded libraries ----
# dylibbundler only discovers direct link dependencies of gjs. Libraries loaded
# at runtime by GObject Introspection (via dlopen) must be copied explicitly.
echo "--- Step 9b: Bundling GI runtime libraries ---"

GI_RUNTIME_LIBS=(
    "libgtk-4.1.dylib"
    "libadwaita-1.0.dylib"
    "libsoup-3.0.0.dylib"
    "libgraphene-1.0.0.dylib"
)

for lib in "${GI_RUNTIME_LIBS[@]}"; do
    src="${BREW_PREFIX}/lib/$lib"
    if [ -f "$src" ]; then
        cp "$src" "$RESOURCES/lib/"
        echo "  Copied $lib, bundling its dependencies..."
        dylibbundler \
            -of \
            -b \
            -x "$RESOURCES/lib/$lib" \
            -d "$RESOURCES/lib/" \
            -p "@executable_path/../Resources/lib/" \
            -s "${BREW_PREFIX}/lib"
    else
        echo "  WARN: $lib not found at $src"
    fi
done

# ---- Step 10: Copy GI typelib files ----
echo "--- Step 10: Copying typelib files ---"

TYPELIB_DIR="${BREW_PREFIX}/lib/girepository-1.0"
DEST_TYPELIB="$RESOURCES/lib/girepository-1.0"

REQUIRED_TYPELIBS=(
    "Adw-1.typelib"
    "cairo-1.0.typelib"
    "freetype2-2.0.typelib"
    "Gdk-4.0.typelib"
    "GdkPixbuf-2.0.typelib"
    "Gio-2.0.typelib"
    "GLib-2.0.typelib"
    "GModule-2.0.typelib"
    "GObject-2.0.typelib"
    "Graphene-1.0.typelib"
    "Gsk-4.0.typelib"
    "Gtk-4.0.typelib"
    "HarfBuzz-0.0.typelib"
    "Pango-1.0.typelib"
    "PangoCairo-1.0.typelib"
    "Soup-3.0.typelib"
)

for typelib in "${REQUIRED_TYPELIBS[@]}"; do
    if [ -f "$TYPELIB_DIR/$typelib" ]; then
        cp "$TYPELIB_DIR/$typelib" "$DEST_TYPELIB/"
    else
        echo "WARN: Typelib not found: $typelib"
    fi
done

# ---- Step 11: Bundle GDK pixbuf loaders ----
echo "--- Step 11: Bundling GDK pixbuf loaders ---"

PIXBUF_LOADERS_SRC="${BREW_PREFIX}/lib/gdk-pixbuf-2.0/2.10.0/loaders"
PIXBUF_LOADERS_DEST="$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders"

if [ -d "$PIXBUF_LOADERS_SRC" ]; then
    # Copy all loader plugins
    for loader in "$PIXBUF_LOADERS_SRC"/*.so "$PIXBUF_LOADERS_SRC"/*.dylib; do
        [ -f "$loader" ] && cp "$loader" "$PIXBUF_LOADERS_DEST/"
    done

    # Rewrite dylib paths for each pixbuf loader
    for loader in "$PIXBUF_LOADERS_DEST"/*; do
        if [ -f "$loader" ]; then
            dylibbundler \
                -of \
                -b \
                -x "$loader" \
                -d "$RESOURCES/lib/" \
                -p "@executable_path/../Resources/lib/" \
                -s "${BREW_PREFIX}/lib" 2>/dev/null || true
        fi
    done

    # Generate loaders.cache with the loader directory path
    GDK_PIXBUF_MODULEDIR="$PIXBUF_LOADERS_DEST" \
        "${BREW_PREFIX}/bin/gdk-pixbuf-query-loaders" \
        "$PIXBUF_LOADERS_DEST"/* \
        > "$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache" 2>/dev/null || true

    # Rewrite absolute paths in loaders.cache to bundle-relative
    if [ -f "$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache" ]; then
        sed -i '' "s|${PIXBUF_LOADERS_DEST}|@executable_path/../Resources/lib/gdk-pixbuf-2.0/2.10.0/loaders|g" \
            "$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
    fi
fi

# ---- Step 12: Install macOS launcher scripts ----
echo "--- Step 12: Installing launcher scripts ---"

cp "$SCRIPT_DIR/kaya-launcher.js" "$RESOURCES/share/kaya/"
cp "$SCRIPT_DIR/kaya-shell-launcher.sh" "$MACOS_DIR/kaya"
chmod +x "$MACOS_DIR/kaya"

# ---- Step 13: Copy entitlements (used during code signing) ----
cp "$SCRIPT_DIR/entitlements.plist" "$CONTENTS/"

# ---- Verify ----
echo "--- Verifying bundle ---"

echo "GJS binary:"
file "$RESOURCES/bin/gjs"

echo ""
echo "Checking for remaining Homebrew references in GJS:"
REMAINING=$(otool -L "$RESOURCES/bin/gjs" | grep -c "$BREW_PREFIX" || true)
if [ "$REMAINING" -gt 0 ]; then
    echo "WARNING: Found $REMAINING remaining Homebrew references:"
    otool -L "$RESOURCES/bin/gjs" | grep "$BREW_PREFIX"
else
    echo "OK: No Homebrew references found"
fi

echo ""
echo "Bundle contents:"
echo "  Dylibs: $(find "$RESOURCES/lib" -name '*.dylib' | wc -l | tr -d ' ')"
echo "  Typelibs: $(find "$DEST_TYPELIB" -name '*.typelib' | wc -l | tr -d ' ')"
echo "  GResources: $(find "$RESOURCES/share/kaya" -name '*.gresource' | wc -l | tr -d ' ')"

echo ""
echo "=== Bundle complete: $APPDIR ==="
echo "To test: open $APPDIR"
