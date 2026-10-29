import { ToneBadge } from "./components/ToneBadge"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import * as SelectPrimitive from "@radix-ui/react-select"
import { moneyShort } from "./format"
import { usePrefs } from "./i18n"
import { Icon } from "./icons"

const labels: Record<string, string> = {
  aktiv: "Aktiv",
  gecikir: "Gecikir",
  plan: "Planlaşdırılır",
  tehvil: "Təhvilə yaxın",
  odenilib: "Ödənilib",
  gonderilib: "Göndərilib",
  qaralama: "Qaralama",
  sahede: "Sahədə",
  istehsalda: "İstehsalatda",
  ezamiyyetde: "Ezamiyyətdə",
  telim: "Təlimdə",
  cixis: "İşdən çıxıb",
  servis: "Servisdə",
  bos: "Boş",
  icarede: "İcarədə",
  gedir: "Gedir",
  novbede: "Növbədə",
  hazir: "Hazır",
  gonderildi: "Sahədə",
  legv: "Ləğv",
  yoldadir: "Yoldadır",
  tesdiq: "Təsdiqlənib",
  qebul: "Qəbul edilib",
  isti: "İsti",
  ilik: "İlıq",
  soyuq: "Soyuq",
  ofisde: "Ofisdə",
  mezuniyyet: "Məzuniyyətdə",
  geldi: "Gəldi",
  gec: "Gecikdi",
  gelmedi: "Gəlmədi",
  ezamiyyet: "Ezamiyyət",
  illik: "İllik",
  xestelik: "Xəstəlik",
  odenissiz: "Ödənişsiz",
  maas: "Maaş",
  avans: "Avans",
  mukafat: "Mükafat",
  cerime: "Cərimə",
  online: "Onlayn",
  offline: "Oflayn",
  medaxil: "Mədaxil",
  mexaric: "Məxaric",
  transfer: "Köçürmə",
  faktura: "Fakturalanıb",
  duzelis: "Düzəliş",
  gozleyir: "Gözləyir",
  sifaris: "Sifarişdə",
  razilasma: "Razılaşma",
  anbar: "Anbardan",
  teklif: "Təklif",
  secildi: "Seçildi",
  redd: "Rədd",
  acik: "Açıq",
  bitdi: "Bitdi",
  asagi: "Aşağı",
  orta: "Orta",
  yuksek: "Yüksək",
  tecili: "Təcili",
  zeng: "Zəng",
  gorus: "Görüş",
  takip: "İzləmə",
  sened: "Sənəd",
  arxiv: "Arxiv",
  cizgi: "Çizgi",
  mektub: "Məktub",
  sexsiyyet: "Şəxsiyyət",
  akt: "Akt",
  email: "E-poçt",
  qeyd: "Qeyd",
  ziyaret: "Ziyarət",
  bina: "Bina",
  villa: "Villa",
  heyet: "Həyət evi",
  plaza: "Biznes plaza",
  bagli: "Bağlı",
  bron: "Bron",
  muqavile: "Müqavilə",
  satilib: "Satılıb",
  acar: "Açar təhvili",
  araliq: "Aralıq",
  yekun: "Yekun",
  nagd: "Nağd",
  daxili: "Daxili kredit",
  ipoteka: "İpoteka",
  menzil: "Mənzil",
  ofis: "Ofis",
  zavod: "Zavod",
  tikinti: "Tikinti şöbəsi",
  parking: "Parking",
  istifade: "İstifadədə",
  anbarda: "Anbarda",
  yoxlamada: "Yoxlamada",
  deyisme: "Dəyişilir",
  kohnelmis: "Köhnəlmiş",
  itki: "İtki",
  yolda: "Yolda",
  catdi: "Çatdı",
  dayandirilib: "Dayandırılıb",
  sigorta: "Sığorta",
  baxis: "Texniki baxış",
  qeydiyyat: "Qeydiyyat",
  icaze: "İcazə",
  oz: "Öz",
  icare: "İcarə",
  elcatan: "Əlçatan",
  axtarir: "Axtarır",
  layihede: "Layihədə",
  elcatmaz: "Əlçatmaz",
}

const tones: Record<string, string> = {
  aktiv: "pine",
  odenilib: "pine",
  hazir: "pine",
  gonderildi: "pine",
  legv: "rose",
  qebul: "pine",
  sahede: "pine",
  istehsalda: "pine",
  ezamiyyetde: "copper",
  telim: "gold",
  cixis: "stone",
  medaxil: "pine",
  ofisde: "pine",
  gecikir: "rose",
  servis: "rose",
  isti: "rose",
  mexaric: "copper",
  transfer: "copper",
  faktura: "pine",
  gedir: "copper",
  yoldadir: "copper",
  tehvil: "copper",
  plan: "gold",
  gonderilib: "gold",
  tesdiq: "gold",
  elcatan: "pine",
  axtarir: "gold",
  layihede: "copper",
  elcatmaz: "stone",
  novbede: "gold",
  icarede: "gold",
  ilik: "gold",
  mezuniyyet: "stone",
  geldi: "pine",
  gec: "gold",
  gelmedi: "rose",
  ezamiyyet: "copper",
  illik: "gold",
  xestelik: "rose",
  odenissiz: "stone",
  maas: "pine",
  avans: "copper",
  mukafat: "gold",
  cerime: "rose",
  online: "pine",
  offline: "stone",
  bos: "stone",
  soyuq: "stone",
  qaralama: "stone",
  duzelis: "gold",
  gozleyir: "gold",
  sifaris: "copper",
  razilasma: "pine",
  anbar: "pine",
  teklif: "gold",
  secildi: "pine",
  redd: "rose",
  acik: "gold",
  bitdi: "pine",
  asagi: "stone",
  orta: "gold",
  yuksek: "copper",
  tecili: "rose",
  zeng: "copper",
  gorus: "gold",
  takip: "stone",
  sened: "gold",
  arxiv: "stone",
  cizgi: "copper",
  mektub: "gold",
  sexsiyyet: "stone",
  akt: "pine",
  email: "copper",
  qeyd: "stone",
  ziyaret: "gold",
  bina: "copper",
  villa: "pine",
  heyet: "gold",
  plaza: "stone",
  bagli: "pine",
  bron: "gold",
  muqavile: "copper",
  satilib: "pine",
  acar: "pine",
  araliq: "gold",
  yekun: "pine",
  nagd: "stone",
  daxili: "copper",
  ipoteka: "gold",
  menzil: "copper",
  ofis: "gold",
  zavod: "copper",
  tikinti: "pine",
  parking: "stone",
  istifade: "pine",
  anbarda: "stone",
  yoxlamada: "gold",
  deyisme: "copper",
  kohnelmis: "stone",
  itki: "rose",
  yolda: "copper",
  catdi: "pine",
  dayandirilib: "rose",
  sigorta: "gold",
  baxis: "copper",
  qeydiyyat: "stone",
  icaze: "gold",
  oz: "pine",
  icare: "gold",
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · CONSTRIX`
  }, [title])
}

export function Badge({ status }: { status: string }) {
  const { t } = usePrefs()
  const key = `status.${status}`
  const label = labels[status] ? t(key) : status
  return <ToneBadge tone={tones[status] || "stone"}>{label}</ToneBadge>
}

const EMPTY = "\u0000"

export type SelectOption = { value: string; label: string }
export type SelectGroup = { label: string; options: SelectOption[] }

export function Select({
  value,
  defaultValue = "",
  onValueChange,
  options = [],
  groups,
  placeholder,
  name,
  disabled,
  ariaLabel,
  compact,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options?: SelectOption[]
  groups?: SelectGroup[]
  placeholder?: string
  name?: string
  disabled?: boolean
  ariaLabel?: string
  compact?: boolean
}) {
  const { t } = usePrefs()
  const [inner, setInner] = useState(defaultValue)
  const current = value !== undefined ? value : inner
  const flat = [...options, ...(groups?.flatMap((group) => group.options) ?? [])]
  const known = flat.some((option) => option.value === current)
  const radixValue = known ? (current === "" ? EMPTY : current) : ""

  function change(next: string) {
    const plain = next === EMPTY ? "" : next
    if (value === undefined) setInner(plain)
    onValueChange?.(plain)
  }

  function item(option: SelectOption) {
    return (
      <SelectPrimitive.Item key={`${option.value}:${option.label}`} value={option.value === "" ? EMPTY : option.value} className="ui-select-item">
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator className="ui-select-check">
          <Icon name="check" />
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    )
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <SelectPrimitive.Root value={radixValue} onValueChange={change} disabled={disabled}>
        <SelectPrimitive.Trigger className={compact ? "ui-select sm" : "ui-select"} aria-label={ariaLabel}>
          <SelectPrimitive.Value placeholder={placeholder ?? t("choose")} />
          <SelectPrimitive.Icon className="ui-select-chev">
            <Icon name="chevron" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="ui-select-pop" position="popper" sideOffset={6} align="start">
            <SelectPrimitive.Viewport>
              {groups?.length ? options.map(item) : null}
              {groups?.length
                ? groups.map((group) => (
                    <SelectPrimitive.Group key={group.label}>
                      <SelectPrimitive.Label className="ui-select-label">{group.label}</SelectPrimitive.Label>
                      {group.options.map(item)}
                    </SelectPrimitive.Group>
                  ))
                : options.map(item)}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </>
  )
}

export function PageHead({
  title,
  text,
  children,
}: {
  kicker?: string
  title: string
  text?: string
  children?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {text && <p className="lede">{text}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export function Meter({ value, tone = "copper" }: { value: number; tone?: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className={`meter ${tone}`} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  )
}

export function StockBar({ qty, min }: { qty: number; min: number }) {
  const pct = Math.min(100, (qty / (min * 1.8)) * 100)
  return (
    <div className="stockbar" aria-hidden="true">
      <span className={qty < min ? "low" : ""} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

export function Tabs({ value, onChange, options }: {
  value: string
  onChange: (id: string) => void
  options: { id: string; label: string }[]
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const optionKey = JSON.stringify(options)

  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    let live = true
    const measure = () => {
      if (!live) return
      const selected = list.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      indicator.style.visibility = selected ? "visible" : "hidden"
      if (!selected) return
      indicator.style.width = `${selected.offsetWidth}px`
      indicator.style.transform = `translateX(${selected.offsetLeft}px)`
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    list.querySelectorAll("button").forEach((button) => observer.observe(button))
    void document.fonts.ready.then(measure)
    return () => { live = false; observer.disconnect() }
  }, [value, optionKey])

  return (
    <div className="tabs" role="tablist" ref={listRef} onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
      event.preventDefault()
      const current = options.findIndex((option) => option.id === value)
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length
      const option = options[next]
      if (!option) return
      onChange(option.id)
      listRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus()
    }}>
      <span className="tabs-indicator" aria-hidden="true" ref={indicatorRef} />
      {options.map((option) => (
        <button key={option.id} type="button" role="tab" aria-selected={value === option.id} tabIndex={value === option.id ? 0 : -1} className={value === option.id ? "on" : ""} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Columns({ rows }: { rows: { label: string; value: number; tone?: string }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  if (!rows.length) return null
  return (
    <div className="hbars">
      {rows.map((row) => (
        <div key={row.label} className="hbar">
          <span title={row.label}>{row.label}</span>
          <div className="hbar-track" aria-hidden="true">
            <i className={row.tone || ""} style={{ width: `${row.value > 0 ? Math.max(3, (row.value / max) * 100) : 0}%` }} />
          </div>
          <b>{moneyShort(row.value)}</b>
        </div>
      ))}
    </div>
  )
}

export function FlowBars({ rows }: { rows: { label: string; inn: number; out: number }[] }) {
  const shown = rows.filter((row) => row.inn > 0 || row.out > 0)
  const max = Math.max(...shown.flatMap((row) => [row.inn, row.out]), 1)
  const height = (value: number) => (value > 0 ? Math.max(4, Math.round((value / max) * 132)) : 0)
  const inn = shown.reduce((sum, row) => sum + row.inn, 0)
  const out = shown.reduce((sum, row) => sum + row.out, 0)
  if (!shown.length) return null
  return (
    <div className="flow">
      <div className={shown.length < 5 ? "flow-plot few" : "flow-plot"}>
        {shown.map((row) => (
          <div key={row.label} className="flow-col">
            <div className="flow-pair" aria-hidden="true">
              <i className="in" title={moneyShort(row.inn)} style={{ height: height(row.inn) }} />
              <i className="out" title={moneyShort(row.out)} style={{ height: height(row.out) }} />
            </div>
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      <div className="chart-key">
        <span><i style={{ background: "var(--pine)" }} />Mədaxil {moneyShort(inn)}</span>
        <span><i style={{ background: "var(--copper)" }} />Məxaric {moneyShort(out)}</span>
      </div>
    </div>
  )
}

export function Confirm({ title, text, yes = "Sil", onClose, onYes }: { title: string; text: string; yes?: string; onClose: () => void; onYes: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Ləğv et</button>
        <button type="button" className="btn" onClick={onYes}>{yes}</button>
      </div>
    </Modal>
  )
}

export function RowMenu({ label = "Əməliyyat", items }: { label?: string; items: { id: string; label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 196
    const height = items.length * 36 + 16
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const below = rect.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below
    setPos({ top, left })
  }

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    function close() {
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [open, items.length])

  if (!items.length) return null
  return (
    <div className="row-menu" onClick={(event) => event.stopPropagation()}>
      <button ref={buttonRef} type="button" className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => { if (open) setOpen(false); else { place(); setOpen(true) } }}>
        <Icon name="more" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="row-menu-pop" role="menu" style={{ top: pos.top, left: pos.left }}>
          {items.map((item) => (
            <button key={item.id} type="button" role="menuitem" onClick={() => { setOpen(false); item.onClick() }}>
              {item.id === "edit" && <Icon name="edit" />}
              {item.id === "delete" && <Icon name="trash" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function useDialogFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled") && element.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => (focusable()[0] ?? dialog).focus({ preventScroll: true }))
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab" || [...document.querySelectorAll('[aria-modal="true"]')].at(-1) !== dialog) return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first || !last) { event.preventDefault(); dialog?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener("keydown", trap)
    return () => {
      cancelAnimationFrame(frame)
      dialog.removeEventListener("keydown", trap)
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return ref
}

export function Modal({ title, onClose, children, className = "", wide = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; wide?: boolean }) {
  const { t } = usePrefs()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="overlay center" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={`modal ${wide ? "wide" : ""} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const { t } = usePrefs()
  const dialogRef = useDialogFocus<HTMLElement>()
  const closeRef = useRef(onClose)
  const leaveTimer = useRef(0)
  const leaving = useRef(false)
  const [closing, setClosing] = useState(false)
  const [entered, setEntered] = useState(false)
  closeRef.current = onClose

  useLayoutEffect(() => {
    let nextFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setEntered(true))
    })
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(nextFrame) }
  }, [])

  function requestClose() {
    if (leaving.current) return
    leaving.current = true
    setClosing(true)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => closeRef.current(), reduce ? 0 : 520)
  }

  const requestRef = useRef(requestClose)
  requestRef.current = requestClose

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  return (
    <div className={`overlay drawer-overlay${entered ? " entered" : ""}${closing ? " out" : ""}`} onClick={requestClose}>
      <aside ref={dialogRef} tabIndex={-1} className={`drawer ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={requestClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
