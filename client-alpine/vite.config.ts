import {
  defineConfig
} from "vite";

export default defineConfig({
  build: {
    outDir: "dist"
  },
  server: {proxy: {
    '/events': { ws: true, target: "ws://localhost:80/events" }
    }},
  plugins: [],
  worker:{
    format: 'iife'
  }
});
