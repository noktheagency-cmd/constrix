export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) as { message?: string | string[] } : null
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login")) {
      localStorage.removeItem("afez.token")
      localStorage.removeItem("afez.user")
      if (sessionStorage.getItem("afez.auth-bounce") !== "1") {
        sessionStorage.setItem("afez.auth-bounce", "1")
        location.assign("/")
      }
    }
    const message = data?.message
    const text = Array.isArray(message) ? message.join(" ") : message || "Sorğu alınmadı"
    throw new ApiError(response.status, text)
  }
  return data as T
}

export function dec(value: unknown) {
  if (value == null || value === "") return ""
  return String(value)
}

export function dayInput(value: unknown) {
  if (!value) return ""
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function timeInput(value: unknown) {
  const day = dayInput(value)
  if (!day || !value) return ""
  const date = new Date(String(value))
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
