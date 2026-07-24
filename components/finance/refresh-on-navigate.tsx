"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Lives in the root layout so it's always mounted.
 * Listens for "data-mutated" custom events dispatched by any mutation
 * (create, update, delete transactions) and calls router.refresh()
 * to re-fetch server data for the current page.
 */
export function DataMutationListener() {
  const router = useRouter()

  useEffect(() => {
    function onMutation() {
      router.refresh()
    }
    window.addEventListener("data-mutated", onMutation)
    return () => window.removeEventListener("data-mutated", onMutation)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
