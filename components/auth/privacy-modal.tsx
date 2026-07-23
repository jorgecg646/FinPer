"use client"

import { useState } from "react"
import { ShieldCheck, X, FileText, CheckCircle2 } from "lucide-react"
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

  if (!isOpen) return null

  function handleConfirm() {
    if (!accepted) return
    onAcceptAndLogin()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
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
            BudgetNext garantiza la confidencialidad absoluta de tus datos financieros. Al iniciar sesión con tu cuenta de Google, únicamente procesamos tu nombre, dirección de correo electrónico y foto de perfil autorizada para personalizar tu experiencia de usuario.
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> 2. Seguridad e Historial Financiero
          </div>
          <p>
            Tus transacciones, presupuestos y documentos PDF se cifran y almacenan en servidores seguros con conexiones SSL de alta protección. Ningún tercero ni agente externo tiene acceso a tus información bancaria o registros financieros.
          </p>

          <div className="flex items-center gap-2 text-foreground font-bold text-xs mt-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> 3. Control y Eliminación de Datos
          </div>
          <p>
            Puedes cerrar tu sesión o solicitar la eliminación total de tus registros en cualquier momento desde el apartado de Perfil de la plataforma.
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
    </div>
  )
}
