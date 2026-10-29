import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react"

/** Animate the shared page surface without remounting route content or forms. */
export function usePageTransition(ref: RefObject<HTMLElement | null>, transitionKey: string, skipInitial = false) {
  const initial = useRef(true)
  useLayoutEffect(() => {
    const skip = initial.current && skipInitial
    initial.current = false
    if (skip) return
    const element = ref.current
    if (!element) return
    const viewport = element.closest("main") ?? element
    viewport.scrollTo({ top: 0, behavior: "instant" })
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // Opacity preserves the viewport positioning of dialogs inside the page.
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 320,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    })
    return () => animation.cancel()
  }, [ref, transitionKey, skipInitial])
}

export function PageTransition({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  usePageTransition(ref, transitionKey)

  return <main ref={ref} className="content" id="main-content" tabIndex={-1}>{children}</main>
}
