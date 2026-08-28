import { build } from "esbuild";

await build({
  entryPoints: ["src/frontend/icons-react.tsx"],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    production: JSON.stringify("production"),
  },
  outfile: "morphicon-icons.js",
});
