# 💰 Pantalla: Control de Ingresos

- **Ruta:** `/ingresos`
- **Archivo principal:** `app/ingresos/page.tsx`
- **Objetivo:** Monitorizar las fuentes de ingresos (nómina, dividendos, freelance, rentas), la recurrencia y su estabilidad mensual.

---

## Componentes Clave
- **Header resumen:** Total ingresado en el año seleccionado con indicador visual positivo.
- **`YearSelector`:** Selector de año para comparar ejercicios pasados.
- **`IncomeChart` (`components/finance/charts.tsx`):** Gráfico de barras o área con la evolución mensual de los ingresos a lo largo del año.
- **`IncomeCategoryChart`:** Desglose porcentual por categorías de ingresos (Nómina, Inversiones, Ventas, etc.).
- **`RecentTransactions` (`components/finance/transactions.tsx`):** Tabla detallada de movimientos filtrada estrictamente por `type: "income"`.

---

## Origen de Datos
- `getSummary(targetYear)`
- `getTransactions()`
- Filtrado por `type === "income"` y año de ocurrencia.

---

## Acciones del Usuario
- Registrar nuevo ingreso (origen, categoría, importe y fecha).
- Analizar qué fuentes de ingresos aportan la mayor parte del flujo de caja.
