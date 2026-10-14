import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["tesseract.js"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
})
