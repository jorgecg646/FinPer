"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ShieldCheck, X, FileText, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react"
import { GoogleIcon } from "@/components/auth/netlify-auth"

export function PrivacyModal({
  isOpen,
  onClose,
  onAcceptAndLogin,
}: {
  isOpen: boolean
  onClose: () => void
  onAcceptAndLogin: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  function handleConfirm() {
    if (!accepted) return
    onAcceptAndLogin()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Política de Privacidad y Términos</h3>
              <p className="text-xs text-muted-foreground">BudgetNext — Protección de datos de usuario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Text scroll content */}
        <div className="my-4 flex-1 overflow-y-auto pr-2 text-xs text-muted-foreground space-y-3 leading-relaxed border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 text-foreground font-bold text-xs">
            <FileText className="h-4 w-4 text-primary" /> 1. Protección y Privacidad de Datos (RGPD)
          </div>
          <p>
            BudgetNext garantiza la confidencialidad de tus datos financieros. Al iniciar sesión con tu cuenta de Google, únicamente procesamos tu nombre, correo electrónico y foto de perfil para autenticarte y personalizar tu experiencia. Se emplean cookies técnicas y almacenamiento local exclusivamente para mantener tu sesión y preferencias (como moneda y tema visual).
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> 2. Seguridad y Almacenamiento
          </div>
          <p>
            Tus transacciones, presupuestos y documentos se procesan bajo conexiones cifradas SSL y bases de datos seguras. Ningún tercero tiene acceso a tu información bancaria ni a tus registros personales.
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <Sparkles className="h-4 w-4 text-primary" /> 3. Tratamiento de Datos e Inteligencia Artificial
          </div>
          <p>
            Las funciones de categorización automática y lectura de extractos analizan los conceptos de las transacciones mediante modelos de Inteligencia Artificial para facilitar tu registro, sin ceder ni comercializar tus datos a terceros.
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> 4. Exención de Responsabilidad Financiera
          </div>
          <p>
            BudgetNext es una herramienta informativa de control y estimación presupuestaria para uso personal. No constituye asesoramiento financiero, tributario o de inversión oficial ni garantiza rendimientos de carteras.
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> 5. Control y Eliminación de tus Datos
          </div>
          <p>
            Tú mantienes el control total: puedes consultar, exportar o eliminar tus movimientos y perfil en cualquier momento desde la sección de Perfil.
          </p>
        </div>

        {/* Checkbox requirement */}
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-md border-border text-primary focus:ring-primary cursor-pointer"
            />
            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              He leído y acepto la <span className="underline">Política de Privacidad</span> y los Términos de Servicio de BudgetNext.
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!accepted}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <GoogleIcon className="h-4 w-4" />
              <span>Continuar con Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
