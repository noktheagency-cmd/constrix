export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if(init?.method && !['GET','HEAD'].includes(init.method.toUpperCase()) && !navigator.onLine)throw new ApiError(0,'İnternet bağlantısı yoxdur. Əməliyyat göndərilmədi.')
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  }).catch(()=>{throw new ApiError(0,'Serverlə əlaqə alınmadı. Əməliyyatın vəziyyətini yeniləyib yoxlayın.')})
  const raw = await response.text()
  let data: { message?: string | string[] } | null = null
  try { data = raw ? JSON.parse(raw) as { message?: string | string[] } : null }
  catch { throw new ApiError(response.status, response.status >= 500 ? 'API hazır deyil və ya serverə bağlantı alınmadı. Bir az sonra yeniləyin.' : 'Serverdən düzgün JSON cavabı alınmadı.') }
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
