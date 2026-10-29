import type { ReactNode } from "react"
import { Icon, type IconName } from "../icons"

export function badgeIcon(tone: string): IconName {
  if(tone === "pine" || tone === "ok") return "check"
  if(tone === "rose" || tone === "stop") return "close"
  if(tone === "gold" || tone === "wait") return "clock"
  return "files"
}

export function ToneBadge({ tone = "stone", children, className = "" }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={`badge ${tone} ${className}`.trim()}><Icon name={badgeIcon(tone)} />{children}</span>
}
