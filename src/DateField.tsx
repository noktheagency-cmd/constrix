import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DayPicker } from "react-day-picker"
import { az } from "react-day-picker/locale"
import "react-day-picker/style.css"
import { dateAZ } from "./format"
import { Icon } from "./icons"

export function isoToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

export function dateToIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function padTime(value: number) {
  return String(value).padStart(2, "0")
}

function splitDateTime(value: string) {
  const [day, time = ""] = value.split("T")
  const date = day ? isoToDate(day) : undefined
  const [hour, minute] = time.split(":").map(Number)
  if (!date || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { date, hour, minute }
}

function joinDateTime(date: Date, hour: number, minute: number) {
  return `${dateToIso(date)}T${padTime(hour)}:${padTime(minute)}`
}

function minuteSteps(current: number) {
  const steps = Array.from({ length: 12 }, (_, index) => index * 5)
  if (!steps.includes(current)) steps.push(current)
  return steps.sort((a, b) => a - b)
}

function faceDateTime(value: string) {
  const parsed = splitDateTime(value)
  if (!parsed) return ""
  return `${dateAZ(dateToIso(parsed.date))}, ${padTime(parsed.hour)}:${padTime(parsed.minute)}`
}

export function DateField({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const selected = value ? isoToDate(value) : undefined

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 260
    const height = 236
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const below = rect.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below
    setPos({ top, left })
  }

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.stopImmediatePropagation()
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={value ? "date-face" : "date-face empty"}
        aria-label={ariaLabel || "Tarix"}
        aria-expanded={open}
        onClick={() => {
          if (open) setOpen(false)
          else {
            place()
            setOpen(true)
          }
        }}
      >
        <span>{value ? dateAZ(value) : "Tarix seç"}</span>
        <Icon name="calendar" />
      </button>
      {open && createPortal(
        <div ref={popRef} className="date-pop" style={{ top: pos.top, left: pos.left }}>
          <DayPicker
            mode="single"
            locale={az}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              onChange(day ? dateToIso(day) : "")
              setOpen(false)
            }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}

export function DateTimeField({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const parsed = splitDateTime(value)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [hour, setHour] = useState(() => parsed?.hour ?? new Date().getHours())
  const [minute, setMinute] = useState(() => parsed?.minute ?? Math.floor(new Date().getMinutes() / 5) * 5)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect()
    const pop = popRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = pop?.width || 448
    const height = pop?.height || 348
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const below = rect.bottom + 8
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below
    setPos({ top, left })
  }

  useEffect(() => {
    const next = splitDateTime(value)
    if (!next) return
    setHour(next.hour)
    setMinute(next.minute)
  }, [value])

  useEffect(() => {
    if (!open) return
    place()
    const center = (col: HTMLDivElement | null) => {
      const item = col?.querySelector<HTMLElement>(".on")
      if (!col || !item) return
      col.scrollTop = item.offsetTop - col.clientHeight / 2 + item.clientHeight / 2
    }
    center(hourRef.current)
    center(minuteRef.current)
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.stopImmediatePropagation()
      setOpen(false)
    }
    function onScroll(event: Event) {
      if (popRef.current?.contains(event.target as Node)) return
      place()
    }
    document.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [open])

  function pickDay(day?: Date) {
    if (!day) return
    onChange(joinDateTime(day, hour, minute))
  }

  function pickHour(next: number) {
    setHour(next)
    if (parsed) onChange(joinDateTime(parsed.date, next, minute))
  }

  function pickMinute(next: number) {
    setMinute(next)
    if (parsed) onChange(joinDateTime(parsed.date, hour, next))
  }

  function today() {
    const now = new Date()
    const nextMinute = Math.floor(now.getMinutes() / 5) * 5
    setHour(now.getHours())
    setMinute(nextMinute)
    onChange(joinDateTime(now, now.getHours(), nextMinute))
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={value ? "date-face" : "date-face empty"}
        aria-label={ariaLabel || "Tarix və saat"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) setOpen(false)
          else {
            place()
            setOpen(true)
          }
        }}
      >
        <span>{value ? faceDateTime(value) : "Tarix və saat"}</span>
        <Icon name="calendar" />
      </button>
      {open && createPortal(
        <div ref={popRef} className="date-pop dt-pop" role="dialog" aria-label={ariaLabel || "Tarix və saat"} style={{ top: pos.top, left: pos.left }}>
          <DayPicker
            mode="single"
            locale={az}
            weekStartsOn={1}
            selected={parsed?.date}
            defaultMonth={parsed?.date}
            onSelect={pickDay}
          />
          <div className="dt-time">
            <div className="dt-clock">
              <span>Seçilən</span>
              <strong>{padTime(hour)}:{padTime(minute)}</strong>
            </div>
            <div className="dt-cols">
              <div>
                <span>Saat</span>
                <div className="dt-col" ref={hourRef}>
                  {Array.from({ length: 24 }, (_, item) => (
                    <button key={item} type="button" className={item === hour ? "on" : ""} onClick={() => pickHour(item)}>{padTime(item)}</button>
                  ))}
                </div>
              </div>
              <div>
                <span>Dəq</span>
                <div className="dt-col" ref={minuteRef}>
                  {minuteSteps(minute).map((item) => (
                    <button key={item} type="button" className={item === minute ? "on" : ""} onClick={() => pickMinute(item)}>{padTime(item)}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="dt-foot">
            <button type="button" onClick={() => { onChange(""); setOpen(false) }}>Təmizlə</button>
            <button type="button" onClick={today}>Bu gün</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
