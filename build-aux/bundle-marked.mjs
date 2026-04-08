import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["marked"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: "src/vendor/marked.js",
  external: [],
  minify: false,
});
