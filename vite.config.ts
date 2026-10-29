import { existsSync, readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Match the API's .env file and environment-variable precedence.
const backendEnvFile = new URL("./backend/.env", import.meta.url)
const backendEnv = existsSync(backendEnvFile)
  ? parseEnv(readFileSync(backendEnvFile, "utf8"))
  : {}
const apiPort = process.env.PORT ?? backendEnv.PORT ?? "3001"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["tesseract.js"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
})
