import { createElement, forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react"
import { Icon } from "../icons"

type SurfaceProps = HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }

/** Shared surfaces keep domain-specific layouts without giving every page its own UI. */
export const Panel = forwardRef<HTMLElement, SurfaceProps>(function Panel({ as = "section", className = "", ...props }, ref) {
  return createElement(as, { ...props, ref, className: `panel ${className}`.trim() })
})

export function Toolbar({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`toolbar ${className}`.trim()} {...props} />
}

export const TableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function TableContainer({ className = "", ...props }, ref) {
  return <div ref={ref} className={`table-wrap ${className}`.trim()} {...props} />
})

export function SectionHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel-head ${className}`.trim()} {...props} />
}

export function StatGrid({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`statstrip ${className}`.trim()} {...props} />
}

export function Metric({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`metric ${className}`.trim()} {...props} />
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function Button({ className = "", type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={`btn ${className}`.trim()} {...props} />
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`text-input ${className}`.trim()} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = "", ...props }, ref) {
  return <textarea ref={ref} className={`text-input ${className}`.trim()} {...props} />
})

export function SearchInput({ className = "", "aria-label": label, placeholder = "Axtar...", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <label className={`list-search ${className}`.trim()}><Icon name="search" /><input type="search" aria-label={label ?? placeholder} placeholder={placeholder} {...props} /></label>
}

/** Secondary analysis is available on demand so the working table remains first. */
export function Disclosure({ title, children, className = "" }: { title: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`disclosure ${className}`.trim()}><summary>{title}<Icon name="chevron" /></summary><div className="disclosure-body">{children}</div></details>
}
