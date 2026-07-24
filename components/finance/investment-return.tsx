"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Edit3, X, Check, DollarSign, Percent, PieChart } from "lucide-react"

type AnnualRoiMap = Record<number, { roiPct: number; currentValue?: number }>

const STORAGE_KEY = "finflow_investment_roi"

function getStoredRoiMap(): AnnualRoiMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveRoiMap(map: AnnualRoiMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new Event("roi-updated"))
  } catch {
    // ignore
  }
}

export function InvestmentReturnCard({
  selectedYear,
  totalInvested,
}: {
  selectedYear: number
  totalInvested: number
}) {
  const [roiMap, setRoiMap] = useState<AnnualRoiMap>({})
  const [isEditing, setIsEditing] = useState(false)
  const [inputPct, setInputPct] = useState("")
  const [inputVal, setInputVal] = useState("")

  useEffect(() => {
    function load() {
      setRoiMap(getStoredRoiMap())
    }
    load()
    window.addEventListener("roi-updated", load)
    return () => window.removeEventListener("roi-updated", load)
  }, [])

  const yearData = roiMap[selectedYear] ?? { roiPct: 0 }
  const roiPct = yearData.roiPct || 0
  
  // Gain amount
  const gainAmount = yearData.currentValue
    ? yearData.currentValue - totalInvested
    : totalInvested * (roiPct / 100)

  const currentValue = yearData.currentValue ?? totalInvested + gainAmount
  const isPositive = roiPct >= 0

  function handleOpenEdit() {
    setInputPct(roiPct ? roiPct.toString() : "")
    setInputVal(yearData.currentValue ? yearData.currentValue.toString() : "")
    setIsEditing(true)
  }

  function handleSave() {
    const nextMap = { ...getStoredRoiMap() }
    const pctNum = parseFloat(inputPct.replace(",", "."))
    const valNum = parseFloat(inputVal.replace(",", "."))

    let finalPct = isNaN(pctNum) ? 0 : pctNum
    let finalVal: number | undefined = isNaN(valNum) ? undefined : valNum

    if (!isNaN(valNum) && totalInvested > 0 && isNaN(pctNum)) {
      finalPct = ((valNum - totalInvested) / totalInvested) * 100
    }

    nextMap[selectedYear] = {
      roiPct: Number(finalPct.toFixed(2)),
      currentValue: finalVal,
    }

    saveRoiMap(nextMap)
    setIsEditing(false)
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isPositive ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
            {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground sm:text-base">Rentabilidad de Inversiones ({selectedYear})</h2>
            <p className="text-xs text-muted-foreground">Rendimiento anual estimado de tu cartera de activos</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary hover:border-primary/40 cursor-pointer self-start sm:self-auto"
        >
          <Edit3 className="h-3.5 w-3.5 text-primary" />
          <span>Fijar Rentabilidad {selectedYear}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 text-center">
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center justify-center gap-1">
            <Percent className="h-3 w-3 text-primary" /> Rentabilidad Anual (%)
          </p>
          <p className={`text-2xl font-extrabold tracking-tight mt-1 ${isPositive ? "text-positive" : "text-destructive"}`}>
            {isPositive ? "+" : ""}{roiPct.toFixed(2)}%
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 text-center">
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center justify-center gap-1">
            <DollarSign className="h-3 w-3 text-primary" /> Ganancia / Pérdida Est.
          </p>
          <p className={`text-2xl font-extrabold tracking-tight mt-1 ${gainAmount >= 0 ? "text-positive" : "text-destructive"}`}>
            {gainAmount >= 0 ? "+" : ""}${gainAmount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 text-center">
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center justify-center gap-1">
            <PieChart className="h-3 w-3 text-primary" /> Valor Actual de Cartera
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-foreground mt-1">
            ${currentValue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Edit Modal / Form Popover */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                Ajustar Rentabilidad de Inversión ({selectedYear})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <div className="p-3 rounded-2xl bg-secondary/50 border border-border/40 text-xs text-muted-foreground">
                <p><strong>Capital invertido en {selectedYear}:</strong> ${totalInvested.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  % Rentabilidad Anual (ej. 8.5 para +8.5%, -3.2 para -3.2%)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="8.5"
                    value={inputPct}
                    onChange={(e) => setInputPct(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                  />
                  <span className="absolute right-4 text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="relative text-center my-1">
                <span className="bg-card px-2 text-[11px] font-semibold text-muted-foreground">O bien por Valor de Cartera</span>
                <div className="absolute inset-0 -z-10 flex items-center"><div className="w-full border-t border-border/50" /></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Valor Actual de la Cartera ($)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="10"
                    placeholder={(totalInvested * 1.085).toFixed(0)}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                  />
                  <span className="absolute right-4 text-xs font-bold text-muted-foreground">$</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-2xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Guardar Rentabilidad</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
