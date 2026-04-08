import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["temporal-polyfill/global"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: "src/vendor/temporal.js",
  external: [], // Bundle everything
  minify: false,
});
