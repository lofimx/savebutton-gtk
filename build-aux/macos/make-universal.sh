#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Create a Universal Binary macOS .app bundle
#
# Takes two architecture-specific .app bundles and merges all Mach-O files
# using lipo to produce a single Universal Binary bundle.
#
# Usage: make-universal.sh <arm64.app> <x86_64.app> <output.app>
# =============================================================================

if [ $# -ne 3 ]; then
    echo "Usage: $0 <arm64.app> <x86_64.app> <output.app>"
    exit 1
fi

ARM64_APP="$1"
X86_64_APP="$2"
OUTPUT_APP="$3"

echo "=== Creating Universal Binary ==="
echo "arm64:  $ARM64_APP"
echo "x86_64: $X86_64_APP"
echo "output: $OUTPUT_APP"

# Start with the arm64 bundle as the base
rm -rf "$OUTPUT_APP"
cp -R "$ARM64_APP" "$OUTPUT_APP"

MERGED=0
SKIPPED=0

# Find all files in the bundle and check if they are Mach-O binaries
while IFS= read -r -d '' arm64_file; do
    # Get the relative path within the .app bundle
    rel_path="${arm64_file#"$OUTPUT_APP/"}"
    x86_file="$X86_64_APP/$rel_path"

    # Skip if no x86_64 counterpart exists
    if [ ! -f "$x86_file" ]; then
        continue
    fi

    # Check if the file is a Mach-O binary (executable or dylib)
    if ! file "$arm64_file" | grep -q "Mach-O"; then
        continue
    fi

    # Skip if already universal
    if file "$arm64_file" | grep -q "universal"; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    echo "  Merging: $rel_path"
    lipo -create "$arm64_file" "$x86_file" -output "${arm64_file}.universal"
    mv "${arm64_file}.universal" "$arm64_file"
    MERGED=$((MERGED + 1))

done < <(find "$OUTPUT_APP" -type f -print0)

echo ""
echo "Merged: $MERGED binaries"
echo "Skipped (already universal): $SKIPPED"

# Verify a key binary
echo ""
echo "Verification:"
GJS_BIN="$OUTPUT_APP/Contents/Resources/bin/gjs"
if [ -f "$GJS_BIN" ]; then
    file "$GJS_BIN"
fi

echo ""
echo "=== Universal binary created: $OUTPUT_APP ==="
