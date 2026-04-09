#!/usr/bin/env ruby
# frozen_string_literal: true

# Save Button Release Script
# Automates the release process:
#   Step 1: Determine and confirm new version
#   Step 2: Update version in all source files (including release manifest)
#   Step 3: Commit, tag, and push
#   Step 4: Build macOS Intel DMG (auto on macOS, instructions on Linux)

require "json"
require "date"

ROOT = File.expand_path("..", __dir__)

def run(cmd)
  output = `cd #{ROOT} && #{cmd} 2>&1`.strip
  unless $?.success?
    abort "Command failed: #{cmd}\n#{output}"
  end
  output
end

def prompt(message)
  print message
  $stdin.gets.chomp
end

def confirm(message)
  print "#{message} [Y/n] "
  answer = $stdin.gets.chomp
  abort "Aborted." unless answer.empty? || answer.downcase == "y"
end

# --- Step 1: Determine new version ---

puts "=== Step 1: Determine new version ==="
puts

tags = run("git tag --sort=-v:refname").lines.map(&:strip).select { |t| t.match?(/^v\d+\.\d+\.\d+$/) }

if tags.empty?
  puts "No version tags found."
  input = prompt("Initial version (e.g. 0.1.0): ")
  new_version = input.strip
else
  current_tag = tags.first
  current_version = current_tag.sub(/^v/, "")
  major, minor, patch = current_version.split(".").map(&:to_i)
  suggested_version = "#{major}.#{minor}.#{patch + 1}"

  puts "Current version: #{current_version} (#{current_tag})"
  puts "Suggested version: #{suggested_version}"
  puts

  input = prompt("New version [#{suggested_version}]: ")
  new_version = input.empty? ? suggested_version : input
end

unless new_version.match?(/^\d+\.\d+\.\d+$/)
  abort "Invalid version format: #{new_version} (expected X.Y.Z)"
end

new_tag = "v#{new_version}"
today = Date.today.to_s

puts
puts "Will release: #{new_version} (#{new_tag})"
confirm("Proceed?")

# --- Step 2: Update version in source files ---

puts
puts "=== Step 2: Update version in source files ==="
puts

# package.json
package_json_path = File.join(ROOT, "package.json")
package_json = JSON.parse(File.read(package_json_path))
package_json["version"] = new_version
File.write(package_json_path, JSON.pretty_generate(package_json) + "\n")
puts "  Updated package.json"

# Sync package-lock.json version
run("npm install --package-lock-only")
puts "  Updated package-lock.json"

# meson.build
meson_path = File.join(ROOT, "meson.build")
meson = File.read(meson_path)
meson.sub!(/version:\s*'[^']*'/, "version: '#{new_version}'")
File.write(meson_path, meson)
puts "  Updated meson.build"

# data/org.savebutton.SaveButton.metainfo.xml.in
metainfo_path = File.join(ROOT, "data", "org.savebutton.SaveButton.metainfo.xml.in")
metainfo = File.read(metainfo_path)
metainfo.sub!(/<release version="[^"]*" date="[^"]*"/, "<release version=\"#{new_version}\" date=\"#{today}\"")
File.write(metainfo_path, metainfo)
puts "  Updated data/org.savebutton.SaveButton.metainfo.xml.in"

# src/main.ts
main_ts_path = File.join(ROOT, "src", "main.ts")
main_ts = File.read(main_ts_path)
main_ts.sub!(/version:\s*"[^"]*"/, "version: \"#{new_version}\"")
File.write(main_ts_path, main_ts)
puts "  Updated src/main.ts"

# org.savebutton.SaveButton.json (release manifest)
manifest_path = File.join(ROOT, "org.savebutton.SaveButton.json")
manifest = JSON.parse(File.read(manifest_path))

git_source = manifest["modules"][0]["sources"].find { |s| s["type"] == "git" }
if git_source
  git_source["tag"] = new_tag
  git_source.delete("branch")
  git_source.delete("commit")
  File.write(manifest_path, JSON.pretty_generate(manifest) + "\n")
  puts "  Updated org.savebutton.SaveButton.json: tag → #{new_tag}"
else
  abort "Could not find git source in org.savebutton.SaveButton.json"
end

puts
puts run("cd #{ROOT} && git diff")
puts

confirm("Diffs look correct?")

# --- Step 3: Commit, tag, and push ---

puts
puts "=== Step 3: Commit, tag, and push ==="
puts

run("git add .")
run("git commit -m 'cut a new version: #{new_version}'")
puts "  Committed: cut a new version: #{new_version}"

run("git tag -a #{new_tag} -m 'Release #{new_tag}'")
puts "  Tagged: #{new_tag}"

# Now update the manifest with the exact commit hash for Flathub reproducibility
commit_hash = run("git rev-parse #{new_tag}^{}")
manifest = JSON.parse(File.read(manifest_path))
git_source = manifest["modules"][0]["sources"].find { |s| s["type"] == "git" }
git_source["commit"] = commit_hash
File.write(manifest_path, JSON.pretty_generate(manifest) + "\n")
puts "  Pinned manifest commit: #{commit_hash}"

run("git add #{manifest_path}")
run("git commit -m 'pin release #{new_tag} commit hash in manifest'")
puts "  Committed manifest pin"

puts
confirm("Push (with tags)?")
run("git push && git push --tags")
puts "  Pushed to remote"

# --- Step 4: macOS Intel DMG ---

puts
puts "=== Step 4: macOS Intel DMG ==="
puts

if RUBY_PLATFORM.include?("darwin")
  confirm("Build and upload Intel DMG now?")
  intel_script = File.join(ROOT, "bin", "release-macos-intel.rb")
  system("ruby", intel_script) || abort("Intel DMG build failed.")
else
  puts "  Linux detected — cannot build macOS Intel DMG on this machine."
  puts
  puts "  On your Intel Mac, run:"
  puts "    cd /path/to/savebutton-gtk"
  puts "    git pull"
  puts "    ruby bin/release-macos-intel.rb"
  puts
end

puts "=== Release #{new_version} complete ==="
