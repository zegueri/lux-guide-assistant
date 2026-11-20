import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  // Paquets chargés avec le `require` natif de Node au lieu d'être empaquetés :
  // PGlite embarque des fichiers WebAssembly, transformers.js et onnxruntime-node
  // des binaires natifs. Les empaqueter casserait leurs chemins de fichiers.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@huggingface/transformers",
    "onnxruntime-node",
    "@electric-sql/pglite-pgvector",
  ],

  // Sur Vercel (Linux x64), on n'embarque pas les binaires ONNX des autres
  // plateformes : ils pèsent ~240 Mo et dépasseraient la limite de 250 Mo.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v*/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v*/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v*/linux/arm64/**",
      "node_modules/onnxruntime-web/**",
      "node_modules/@playwright/**",
      "node_modules/playwright-core/**",
      ".data/**",
    ],
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
