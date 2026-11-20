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

  // transformers.js charge onnxruntime-node dynamiquement : l'analyse des imports ne le
  // voit pas. On l'ajoute à la main à la fonction qui calcule l'embedding de la question,
  // avec uniquement le binaire Linux x64 (celui de Vercel) : ~45 Mo au lieu de ~300 Mo.
  outputFileTracingIncludes: {
    "/api/chat": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v*/linux/x64/**/*",
      "./node_modules/onnxruntime-common/**/*",
    ],
  },

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
