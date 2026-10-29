import { forwardRef } from "react"
import { Link } from "react-router-dom"
import { Meter } from "../ui"

export const FileTile = forwardRef<HTMLAnchorElement, {
  name: string
  extension: string
  metadata: string
  progress: number
  to: string
}>(function FileTile({ name, extension, metadata, progress, to }, ref) {
  const tone = /xlsx?/.test(extension) ? "sheet" : extension === "pdf" ? "pdf" : /dxf|dwg|ifc/.test(extension) ? "drawing" : "plain"
  return <Link ref={ref} to={to} title={name} className="document-tile">
    <span className={`document-type ${tone}`} aria-hidden="true">{extension.toUpperCase()}</span>
    <span className="document-tile-copy"><strong>{name}</strong><small>{metadata}</small><Meter value={progress} /></span>
  </Link>
})
