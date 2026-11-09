import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "hatid-frontend",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    workersDev: true,
    previewUrls: false,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
