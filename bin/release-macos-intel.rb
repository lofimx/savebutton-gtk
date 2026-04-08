#!/usr/bin/env ruby
# frozen_string_literal: true

# macOS Intel DMG Release Script
#
# Builds, signs, notarizes, and uploads an x86_64 DMG for the latest release tag.
# Run this on an Intel Mac after `bin/release.rb` has pushed a new tag.
#
# Prerequisites:
#   brew install gjs gtk4 libadwaita libsoup gobject-introspection \
#     adwaita-icon-theme gdk-pixbuf meson ninja node dylibbundler \
#     create-dmg librsvg gh
#
# The following environment variables must be set for signing and notarization:
#   MACOS_SIGNING_IDENTITY  - Developer ID certificate name for codesigning
#   MACOS_NOTARIZE_APPLE_ID - Apple ID for notarization
#   MACOS_NOTARIZE_PASSWORD - App-specific password for notarization
#   MACOS_NOTARIZE_TEAM_ID  - Apple Developer Team ID for notarization

ROOT = File.expand_path("..", __dir__)

def run(cmd)
  output = `cd #{ROOT} && #{cmd} 2>&1`.strip
  unless $?.success?
    abort "Command failed: #{cmd}\n#{output}"
  end
  output
end

# --- Preflight checks ---

unless RUBY_PLATFORM.include?("darwin")
  abort "ERROR: This script must be run on macOS."
end

arch = `uname -m`.strip
unless arch == "x86_64"
  abort "ERROR: This script must be run on an Intel (x86_64) Mac.\nDetected architecture: #{arch}"
end

# --- Determine latest tag ---

tags = run("git tag --sort=-v:refname").lines.map(&:strip).select { |t| t.match?(/^v\d+\.\d+\.\d+$/) }
if tags.empty?
  abort "ERROR: No v* tags found. Run bin/release.rb first."
end

tag = tags.first
version = tag.sub(/^v/, "")
dmg_name = "SaveButton-#{version}-x86_64.dmg"

puts "=== Building Intel DMG for #{tag} (version #{version}) ==="
puts "Architecture: #{arch}"
puts "Output: #{dmg_name}"
puts

# --- Ensure we're on the right commit ---

run("git fetch --tags")
run("git checkout #{tag}")
puts "  Checked out #{tag}"

# --- Build ---

puts
puts "--- Building app bundle ---"
run("bash build-aux/macos/bundle.sh")

puts
puts "--- Creating DMG ---"
run("bash build-aux/macos/create-dmg.sh SaveButton.app #{dmg_name}")

# --- Upload ---

puts
puts "--- Uploading #{dmg_name} to GitHub Release #{tag} ---"
run("gh release upload #{tag} #{dmg_name} --clobber")

puts
puts "=== Done: #{dmg_name} uploaded to release #{tag} ==="
