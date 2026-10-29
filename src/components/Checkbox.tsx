import { useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react"
import { Icon } from "../icons"

export function Checkbox({ label, indeterminate = false, className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return <label className={`platform-checkbox ${props.disabled ? "disabled" : ""} ${className}`.trim()}>
    <span className="platform-checkbox-control"><input {...props} ref={ref} type="checkbox" /><span className="platform-checkbox-box" aria-hidden="true">{indeterminate ? <i /> : <Icon name="check" />}</span></span>
    {label && <span className="platform-checkbox-label">{label}</span>}
  </label>
}
