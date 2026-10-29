# 🧮 Pantalla: Calculadoras & Simuladores

- **Ruta:** `/calculadoras`
- **Archivo principal:** `app/calculadoras/page.tsx`
- **Objetivo:** Facilitar herramientas interactivas de toma de decisiones financieras, proyecciones de libertad financiera e impacto del ahorro.

---

## Módulos y Calculadoras Incluidas

### 1. Diagnóstico de Salud Financiera · Regla 50 / 30 / 20 (`Rule503020Calculator`)
- Evalúa los ingresos reales frente al reparto clásico:
  - **50% Necesidades básicas** (vivienda, comida, suministros).
  - **30% Deseos y ocio** (restaurantes, viajes, compras personales).
  - **20% Ahorro e inversión**.
- Muestra diagnósticos de salud presupuestaria basados en el histórico del año.

### 2. Calculadora de Libertad Financiera (F.I.R.E.) (`FireCalculator`)
- Modela el tiempo restante para alcanzar la independencia financiera bajo el movimiento FIRE (Financial Independence, Retire Early).
- Aplica la **Regla del 4%** (Multiplicador x25 de gastos anuales).
- Permite ajustar: rentabilidad anual esperada, inflación y tasa de ahorro.

### 3. Simulador de Escenarios Financieros ("¿Qué pasaría si...?") (`ScenarioSimulator`)
- Simulación dinámica de cambios de vida:
  - Aumento o reducción salarial.
  - Recorte de categorías específicas de gasto.
  - Nuevas inversiones recurrentes.
- Proyecta el patrimonio neto a 1, 3, 5 y 10 años vista.

### 4. Impacto del Gasto Hormiga a Largo Plazo (`MicroExpensesLongTermCalculator`)
- Identifica pequeños desembolsos frecuentes (cafés diarios, snacks, compras impulsivas).
- Calcula cuánto supondría ese dinero invertido con interés compuesto al 7% anual en 10, 20 o 30 años.

---

## Origen de Datos
- `getSummary(selectedYear)`
- `getTransactions()`
