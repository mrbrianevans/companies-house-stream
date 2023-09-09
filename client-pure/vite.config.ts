import { defineConfig } from "vite"
import { resolve } from "node:path"
import { readdir, writeFile } from "node:fs/promises"

// could change page structure to this:
// package.json
// vite.config.ts
// index.html
// index.ts
// samples/
//   index.html
//   samples.ts
// about/
//   index.html
//   about.ts
const pages = await readdir("src").then(ps => ps.filter(p => p.endsWith(".html")))

// generate sitemap for crawlers
const sitemap = pages.map(p => p.replace("index.html", "")).map(p => `https://companies.stream/${p.slice(0, -5)}`).join("\n")
await writeFile("src/public/sitemap.txt", sitemap)

const useLocalBackend = true
const backendHttpUrl = useLocalBackend ? "http://localhost" : "https://companies.stream"

export default defineConfig({
  root: "src",
  build: {
    outDir: resolve("dist"), emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: pages.map(p => "src/" + p)
    },
    target: "es2022"
  },
  server: {

    proxy: {
      "/events/health": backendHttpUrl,
      "/events/downloadHistory": backendHttpUrl,
      "/events/stats": backendHttpUrl,
      "/events/visitors": backendHttpUrl,
      "/events": { ws: true, target: "ws://localhost/events" } // can't be proxied to companies.stream
    }
  },
  plugins: [],
  worker: {
    format: "es"
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2020"
    }
  }
})
