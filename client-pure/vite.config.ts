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

export default defineConfig({
  root: "src",
  build: {
    outDir: resolve("dist"), emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: pages.map(p=>'src/'+p)
    },
    target: "es2022"
  },
  server: {

    proxy: {
      "/events/health": "http://localhost",
      "/events/downloadHistory": "http://localhost",
      "/events/stats": "https://companies.stream",
      "/events": { ws: true, target: "ws://localhost:80/events" }
    }
  },
  plugins: [],
  worker: {
    format: "es"
  },
  optimizeDeps: {
    esbuildOptions : {
      target: "es2020"
    }
  }
})
