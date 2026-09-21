import { useEffect, useRef } from "react"

/**
 * Executes a callback periodically, automatically pausing while document.hidden is true.
 * When the tab regains focus, executes the callback once if document.hidden became false.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(() => {
      if (document.hidden) return
      cbRef.current()
    }, intervalMs)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        cbRef.current()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [intervalMs, enabled])
}
