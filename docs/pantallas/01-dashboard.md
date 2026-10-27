# 📊 Pantalla: Dashboard Principal

- **Ruta:** `/`
- **Archivo principal:** `app/page.tsx`
- **Objetivo:** Ofrecer una visión panorámica y en tiempo real de la salud financiera del usuario (balance de liquidez, patrimonio invertido, ahorro neto y movimientos recientes).

---

## Componentes Clave
- **`LayoutShell` (`components/finance/navigation.tsx`):** Contenedor principal con barra lateral de navegación, balance global y modo oscuro/claro.
- **`Topbar` & `CurrencySelector` (`components/finance/dashboard.tsx`):** Selector de moneda activa y filtros de año.
- **`BalanceCard`:** Muestra el balance disponible, ingresos vs. gastos mensuales y comparativa con el periodo anterior.
- **`InvestmentBalanceBanner`:** Resumen rápido de la cartera de inversión valorada a mercado sumada a la liquidez en efectivo.
- **`AnnualWrappedBanner`:** Resumen anual dinámico con hitos financieros del año seleccionado.
- **`RecentTransactions` (`components/finance/lazy-home-charts.tsx`):** Lista interactiva de los últimos movimientos con filtros rápidos.
- **Gráficos de Resumen:**
  - `FinancialOverviewRatioChart`: Distribución proporcional ingresos / gastos.
  - `MonthlyComparisonChart`: Barras comparativas de ingresos vs gastos mes a mes.
  - `NetSavingsTrendChart`: Evolución de la tasa de ahorro acumulada.
  - `MoneyFlowSankeyChart`: Diagrama de flujo del dinero desde las fuentes hasta los destinos.
- **`FinancialAiInsights`:** Tarjetas con observaciones automáticas e insights inteligentes sobre desviaciones o patrones de gasto.

---

## Origen de Datos & Server Actions
- `getSummary(targetYear)`: Calcula balances agregados, totales de ingresos y gastos, años disponibles y métricas mensuales.
- `getTransactions()`: Carga el listado completo de movimientos desde la tabla `transactions`.
- `cookies()`: Lee la divisa guardada (`DISPLAY_CURRENCY_KEY`).

---

## Acciones del Usuario
- Cambiar el año analizado (recarga parámetros de búsqueda `?year=...`).
- Cambiar la divisa de visualización.
- Registrar una transacción rápida desde el botón de acción flotante / topbar.
- Consultar el detalle de transacciones recientes o saltar a la sección de gastos/ingresos.
