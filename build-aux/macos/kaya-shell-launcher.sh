#!/usr/bin/env bash

# Kaya macOS launcher
#
# This script is installed as Contents/MacOS/kaya and is the actual
# executable macOS runs when you double-click the app. It sets up
# the environment for the bundled GJS runtime and launches the application.

BUNDLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$BUNDLE_DIR/Resources"

# Tell the app code we're running on macOS (used for Keychain fallback)
export KAYA_PLATFORM=macos

# Path to the Resources directory for the GJS launcher
export KAYA_RESOURCES_DIR="$RESOURCES"

# Library paths for bundled dylibs
export DYLD_LIBRARY_PATH="$RESOURCES/lib"

# GObject Introspection typelib search path
export GI_TYPELIB_PATH="$RESOURCES/lib/girepository-1.0"

# GSettings schema directory
export GSETTINGS_SCHEMA_DIR="$RESOURCES/share/glib-2.0/schemas"

# XDG data dirs for icon themes, etc.
export XDG_DATA_DIRS="$RESOURCES/share"

# GDK pixbuf loader cache
export GDK_PIXBUF_MODULE_FILE="$RESOURCES/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"

# GTK theme data
export GTK_DATA_PREFIX="$RESOURCES"

# Use the Quartz input method on macOS
export GTK_IM_MODULE=quartz

# Launch GJS with the macOS entry point
exec "$RESOURCES/bin/gjs" -m "$RESOURCES/share/kaya/kaya-launcher.js"
