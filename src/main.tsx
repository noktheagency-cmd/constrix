import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

try {
  if (localStorage.getItem("afez.theme") === "dark") document.documentElement.dataset.theme = "dark"
  const lang = localStorage.getItem("afez.lang")
  if (lang === "en" || lang === "ru" || lang === "az") document.documentElement.lang = lang
} catch {
  /* saxlama bağlıdır */
}

const root = document.getElementById("root")
if (!root) throw new Error("root tapılmadı")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
