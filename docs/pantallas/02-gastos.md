# 💳 Pantalla: Control de Gastos

- **Ruta:** `/gastos`
- **Archivo principal:** `app/gastos/page.tsx`
- **Objetivo:** Desglosar, categorizar y analizar las salidas de dinero para detectar áreas de recorte y patrones temporales de gasto.

---

## Componentes Clave
- **`ExpenseCalendarHeatmap` (`app/gastos/expense-calendar.tsx`):** Mapa de calor interactivo en formato calendario que muestra los días con mayor volumen de gasto.
- **`ExpenseChart` (`components/finance/charts.tsx`):** Gráfico circular de distribución de gastos por categorías (Alimentación, Transporte, Ocio, Vivienda, etc.).
- **`ExpenseMonthlyBarChart`:** Comparativa mensual del total de gastos a lo largo del año.
- **`ExpenseCategoryProgressChart`:** Barras de progreso de consumo por categoría respecto a medias habituales.
- **`YearOverYearComparisonChart`:** Comparativa de gastos año contra año (YoY).
- **`RecentTransactions`:** Listado filtrable de gastos con opción de edición, borrado y recategorización.

---

## Lógica de Negocio Especial
- **Filtro de transferencias de inversión (`isInvestmentTx`):** Las transferencias a brokers o cuentas de inversión se excluyen del cómputo de "gastos reales de vida" (`totalLivingExpenses`) para no distorsionar la tasa de consumo con aportaciones a capital.

---

## Origen de Datos
- `getSummary(targetYear)`
- `getTransactions()`
- Filtrado por `type === "expense"` y exclusión de inversiones.

---

## Acciones del Usuario
- Registrar nuevo gasto con fecha, categoría, concepto e importe.
- Filtrar por categoría o mes haciendo clic en los gráficos.
- Explorar días concretos en el mapa de calor del calendario.
