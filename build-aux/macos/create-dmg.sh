#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Create a macOS DMG from a Kaya .app bundle
#
# Optionally code-signs and notarizes the app if the relevant environment
# variables are set. Signing requires an Apple Developer certificate.
#
# Usage: create-dmg.sh <app-path> [output-dmg]
#
# Environment variables (all optional):
#   MACOS_SIGNING_IDENTITY  - Developer ID certificate name for codesigning
#   MACOS_NOTARIZE_APPLE_ID - Apple ID for notarization
#   MACOS_NOTARIZE_PASSWORD - App-specific password for notarization
#   MACOS_NOTARIZE_TEAM_ID  - Apple Developer Team ID for notarization
# =============================================================================

if [ $# -lt 1 ]; then
    echo "Usage: $0 <app-path> [output-dmg]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$1"
APP_NAME="SaveButton"

VERSION=$(defaults read "$APP_PATH/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "dev")
OUTPUT_DMG="${2:-${APP_NAME}-${VERSION}.dmg}"

echo "=== Creating DMG for $APP_NAME $VERSION ==="

# ---- Optional code signing ----
if [ -n "${MACOS_SIGNING_IDENTITY:-}" ]; then
    echo "--- Code signing with identity: $MACOS_SIGNING_IDENTITY ---"

    ENTITLEMENTS="$SCRIPT_DIR/entitlements.plist"
    if [ ! -f "$ENTITLEMENTS" ]; then
        ENTITLEMENTS="$APP_PATH/Contents/entitlements.plist"
    fi

    # Retry wrapper for codesign — Apple's timestamp server can be slow in CI
    sign() {
        local max_attempts=3
        local attempt=1
        while [ $attempt -le $max_attempts ]; do
            if codesign --force --sign "$MACOS_SIGNING_IDENTITY" \
                --options runtime \
                --timestamp \
                --entitlements "$ENTITLEMENTS" \
                "$@" 2>&1; then
                return 0
            fi
            echo "  codesign attempt $attempt failed, retrying in 5s..."
            sleep 5
            attempt=$((attempt + 1))
        done
        echo "ERROR: codesign failed after $max_attempts attempts: $*"
        return 1
    }

    # Sign all dylibs first (innermost binaries must be signed before the bundle)
    find "$APP_PATH" -name "*.dylib" -o -name "*.so" | while read -r lib; do
        sign "$lib"
    done

    # Sign pixbuf loaders
    find "$APP_PATH/Contents/Resources/lib/gdk-pixbuf-2.0" -type f 2>/dev/null | while read -r loader; do
        if file "$loader" | grep -q "Mach-O"; then
            sign "$loader"
        fi
    done

    # Sign the GJS binary
    sign "$APP_PATH/Contents/Resources/bin/gjs"

    # Sign the app bundle itself
    codesign --force --deep --sign "$MACOS_SIGNING_IDENTITY" \
        --options runtime \
        --timestamp \
        --entitlements "$ENTITLEMENTS" \
        "$APP_PATH" || {
        echo "  Retrying app bundle signing in 5s..."
        sleep 5
        codesign --force --deep --sign "$MACOS_SIGNING_IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements "$ENTITLEMENTS" \
            "$APP_PATH"
    }

    echo "Code signing complete."
else
    echo "Skipping code signing (MACOS_SIGNING_IDENTITY not set)."
fi

# Remove entitlements from bundle (only needed during signing, not distribution)
rm -f "$APP_PATH/Contents/entitlements.plist"

# ---- Create DMG ----
echo "--- Creating DMG ---"

# Remove existing DMG if present
rm -f "$OUTPUT_DMG"

create-dmg \
    --volname "$APP_NAME" \
    --volicon "$APP_PATH/Contents/Resources/savebutton.icns" \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon-size 100 \
    --icon "${APP_NAME}.app" 150 190 \
    --hide-extension "${APP_NAME}.app" \
    --app-drop-link 450 190 \
    "$OUTPUT_DMG" \
    "$APP_PATH" || true
    # create-dmg exits non-zero if no signing identity is set; this is OK

if [ ! -f "$OUTPUT_DMG" ]; then
    echo "ERROR: DMG creation failed"
    exit 1
fi

echo "DMG created: $OUTPUT_DMG"

# ---- Optional notarization ----
if [ -n "${MACOS_NOTARIZE_APPLE_ID:-}" ] && \
   [ -n "${MACOS_NOTARIZE_PASSWORD:-}" ] && \
   [ -n "${MACOS_NOTARIZE_TEAM_ID:-}" ]; then
    echo "--- Submitting for notarization ---"

    xcrun notarytool submit "$OUTPUT_DMG" \
        --apple-id "$MACOS_NOTARIZE_APPLE_ID" \
        --password "$MACOS_NOTARIZE_PASSWORD" \
        --team-id "$MACOS_NOTARIZE_TEAM_ID" \
        --wait

    echo "--- Stapling notarization ticket ---"
    xcrun stapler staple "$OUTPUT_DMG"

    echo "Notarization complete."
else
    echo "Skipping notarization (Apple ID secrets not set)."
fi

echo ""
echo "=== DMG ready: $OUTPUT_DMG ==="
