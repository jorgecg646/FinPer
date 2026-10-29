# 🔁 Pantalla: Suscripciones

- **Ruta:** `/suscripciones`
- **Archivo principal:** `app/suscripciones/page.tsx`
- **Estado actual:** Redirección automática a `/calculadoras`.

---

## Situación Actual
Actualmente la ruta `/suscripciones` ejecuta un `redirect("/calculadoras")`. El análisis de gastos recurrentes y gastos hormiga está centralizado en la calculadora de impacto a largo plazo de la sección de calculadoras.

---

## Roadmap / Evolución Prevista
Si en el futuro se reactiva como pantalla independiente, su cometido previsto es:
1. **Detección automática de pagos periódicos:** Identificar transacciones con periodicidad mensual/anual (ej. Netflix, Spotify, gimnasio, telefonía).
2. **Calendario de cobros:** Fechas estimadas de la próxima renovación para evitar sorpresas.
3. **Cálculo de coste acumulado anual:** Visión agregada de cuánto cuestan todas las suscripciones activas al año.
4. **Optimización de servicios redundantes:** Identificar servicios que no se utilicen con frecuencia.
