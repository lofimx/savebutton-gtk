// Kaya macOS GJS entry point
//
// This script replaces the Meson-configured launcher (org.savebutton.SaveButton.in)
// for the macOS .app bundle. It cannot use imports.package.init() because
// that requires a baked-in prefix path, but the .app bundle must be
// relocatable. Instead, it manually loads GResource bundles and CSS
// using the KAYA_RESOURCES_DIR environment variable set by the shell wrapper.

import { exit, programArgs } from "system";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";

// The shell launcher sets KAYA_RESOURCES_DIR to Contents/Resources
const resourcesDir = GLib.getenv("KAYA_RESOURCES_DIR");
if (!resourcesDir) {
  console.error("KAYA_RESOURCES_DIR is not set. Launch via SaveButton.app.");
  exit(1);
}

// Load GResource bundles
const srcGresourcePath = GLib.build_filenamev([
  resourcesDir,
  "share",
  "savebutton",
  "org.savebutton.SaveButton.src.gresource",
]);
const dataGresourcePath = GLib.build_filenamev([
  resourcesDir,
  "share",
  "savebutton",
  "org.savebutton.SaveButton.data.gresource",
]);

const srcResource = Gio.Resource.load(srcGresourcePath);
Gio.resources_register(srcResource);

const dataResource = Gio.Resource.load(dataGresourcePath);
Gio.resources_register(dataResource);

// Load application CSS from the data GResource.
// On Linux, imports.package.init() handles this automatically.
const display = Gdk.Display.get_default();
if (display) {
  const cssProvider = new Gtk.CssProvider();
  cssProvider.load_from_resource("/org/savebutton/SaveButton/style.css");
  Gtk.StyleContext.add_provider_for_display(
    display,
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
  );
}

// Import and run the application from the GResource
const module = await import("resource:///org/savebutton/SaveButton/js/main.js");
const exitCode = await module.main(programArgs);
exit(exitCode);
