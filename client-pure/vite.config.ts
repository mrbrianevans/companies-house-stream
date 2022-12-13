import { defineConfig } from "vite"
import { resolve } from 'node:path'
import { readdir, writeFile } from 'node:fs/promises'

const pages = await readdir('src').then(ps=>ps.filter(p=>p.endsWith('.html')))

// generate sitemap for crawlers
const sitemap = pages.map(p=>p.replace('index.html','')).map(p=>`https://companies.stream/${p.slice(0,-5)}`).join('\n')
await writeFile('src/public/sitemap.txt', sitemap)

export default defineConfig({
  root: 'src',
  build: {
    outDir: resolve("dist"), emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: pages.map(p=>'src/'+p)
    }
  },
  server: {
    proxy: {
      "/events/health": "http://localhost/events/health" ,
      "/events/downloadHistory": "http://localhost/events/downloadHistory" ,
      "/events": { ws: true, target: "ws://localhost:80/events" }
    }
  },
  plugins: [],
  worker: {
    format: "iife"
  }
})
