import { useEffect, useRef, useState, type FormEvent } from "react"
import { CompanyOnboard } from "./company-onboard"
import { DEMO_ACCOUNT, usePrefs } from "./i18n"
import { Icon } from "./icons"
import { useProcure } from "./procure/store"

type Mode = "login" | "register" | "onboard" | "register-onboard"

const DEMOS = [
  ["elvin@afez.az", "Direktor"],
  ["nigar@afez.az", "Layihə rəhbəri"],
  ["rauf@afez.az", "Sahə"],
  ["kamran@afez.az", "Anbar"],
  ["sebine@afez.az", "Təchizat"],
  ["gunel@afez.az", "Mühasib"],
  ["aysel@afez.az", "Satış"],
] as const

function RolePick({ value, onChange }: { value: string; onChange: (email: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const label = DEMOS.find(([email]) => email === value)?.[1] ?? "Rol seçin"

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div className={open ? "role-pick open" : "role-pick"} ref={box}>
      <button type="button" className="login-field role-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Icon name="user" />
        <span className={value ? "" : "is-empty"}>{label}</span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div className="role-menu" role="listbox">
          {DEMOS.map(([email, name]) => (
            <button type="button" key={email} className={email === value ? "on" : ""} role="option" aria-selected={email === value} onClick={() => { onChange(email); setOpen(false) }}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Login() {
  const { signIn, signUp } = usePrefs()
  const procure = useProcure()
  const missing = !procure.companies.some((item) => item.id === procure.activeId)
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (mode === "register") {
      if (password.length < 8) {
        setError("Şifrə ən az 8 simvol olmalıdır.")
        return
      }
      if (password !== again) {
        setError("Şifrələr üst-üstə düşmür.")
        return
      }
      setMode("register-onboard")
      return
    }
    setPending(true)
    const message = await signIn(email, password)
    if (message) setError(message)
    setPending(false)
  }

  async function finishRegister() {
    setError("")
    setPending(true)
    const message = await signUp(name, email, password)
    setPending(false)
    if (message) {
      setError(message)
      setMode("register")
    }
  }

  const heading = mode === "register" || mode === "register-onboard" ? "Hesab aç" : mode === "onboard" ? "Şirkət qeydiyyatı" : "Xoş gəldiniz"
  const lede = mode === "onboard" || mode === "register-onboard"
    ? "Şirkətin növü kabineti açır. Bu addımı sonra da bitirmək olar."
    : mode === "register"
      ? "Ad, e-poçt və şifrə kifayətdir. Təsdiq kodu bu mərhələdə göndərilmir."
      : "Davam etmək üçün e-poçt və şifrəni yazın."

  return (
    <div className="gate">
      <section className="gate-story">
        <div className="login-brand">
          <img className="brand-mark" src="/constrix-mark.svg" alt="" />
          <div>
            <strong>CONSTRIX</strong>
            <small>CONNECTED CONSTRUCTION</small>
          </div>
        </div>
        <p className="gate-kicker">Tikinti · Sifariş · Maliyyə</p>
        <h1>CONSTRIX.</h1>
        <p>Tikintidən sifarişə — hər şey bir platformada.</p>
      </section>
      <section className="gate-panel">
        <div className="gate-card">
          {mode !== "onboard" && mode !== "register-onboard" && (
            <div className="gate-tabs">
              <span className={mode === "register" ? "gate-thumb right" : "gate-thumb"} />
              <button type="button" className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError("") }}>Daxil ol</button>
              <button type="button" className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError("") }}>Qeydiyyat</button>
            </div>
          )}
          <div className="gate-body" key={mode}>
          <div className="login-copy">
            <h2>{heading}</h2>
            <p>{lede}</p>
          </div>
          {missing && mode === "login" && (
            <button type="button" className="gate-alert" onClick={() => { setError(""); setMode("onboard") }}>
              Şirkət qeydiyyatı edilməyib
            </button>
          )}
          {mode === "onboard" && (
            <CompanyOnboard onDone={() => setMode("login")} onSkip={() => setMode("login")} />
          )}
          {mode === "register-onboard" && (
            <CompanyOnboard
              initial={{ email, director: name }}
              onDone={() => void finishRegister()}
              onSkip={() => void finishRegister()}
            />
          )}
          {(mode === "login" || mode === "register") && (
            <form className="login-form" onSubmit={submit}>
              {mode === "login" && (
                <label>
                  <span>Demo hesab</span>
                  <RolePick
                    value={DEMOS.some(([value]) => value === email) ? email : ""}
                    onChange={(next) => { setEmail(next); setPassword(next ? DEMO_ACCOUNT.password : "") }}
                  />
                </label>
              )}
              {mode === "register" && (
                <label>
                  <span>Ad soyad</span>
                  <span className="login-field">
                    <Icon name="user" />
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                  </span>
                </label>
              )}
              <label>
                <span>E-poçt</span>
                <span className="login-field">
                  <Icon name="mail" />
                  <input type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </span>
              </label>
              <label>
                <span>Şifrə</span>
                <span className="login-field">
                  <Icon name="lock" />
                  <input type={showPassword ? "text" : "password"} name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button type="button" className="login-eye" aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"} onClick={() => setShowPassword((value) => !value)}>
                    <Icon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </span>
              </label>
              {mode === "register" && (
                <label>
                  <span>Şifrə təkrar</span>
                  <span className="login-field">
                    <Icon name="lock" />
                    <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} required />
                  </span>
                </label>
              )}
              {error ? <p className="login-error">{error}</p> : null}
              <button type="submit" className="login-submit" disabled={pending}>
                {pending ? "Gözləyin..." : mode === "register" ? "Davam et" : "Daxil ol"}
              </button>
            </form>
          )}
          {error && (mode === "onboard" || mode === "register-onboard") ? <p className="login-error">{error}</p> : null}
          {mode === "login" && <p className="login-foot">Demo şifrəsi: {DEMO_ACCOUNT.password}</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
