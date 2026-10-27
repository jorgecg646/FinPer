# 📈 Pantalla: Cartera de Inversiones

- **Ruta:** `/inversiones`
- **Archivo principal:** `app/inversiones/page.tsx`
- **Objetivo:** Seguimiento en tiempo real de la cartera de inversión, posiciones en acciones/ETFs/cripto, rentabilidades latentes, eventos macroeconómicos y fiscalidad.

---

## Componentes Clave
- **`WatchlistPanel` (`app/inversiones/watchlist-panel.tsx`):** Barra lateral colapsable y responsive (drawer con overlay en móviles/tablets y acoplada en pantallas de escritorio >= xl) con lista de activos en seguimiento, cotizaciones en tiempo real, variación diaria y buscador de tickers. Minimizada por defecto y con tipografía ampliada para alta legibilidad.
- **`WatchlistContentOffset` (`app/inversiones/watchlist-content-offset.tsx`):** Wrapper que adapta automáticamente el ancho y padding del contenido principal en pantallas de escritorio según el estado abierto/cerrado del panel lateral, sin comprimir el contenido en dispositivos móviles.
- **`MarketIndicesPanel` (`app/inversiones/market-indices.tsx`):** Cinta de índices globales (S&P 500, Nasdaq, Dow Jones, DAX, IBEX) con cotizaciones en tiempo real.
- **`StockPricesPanel` (`app/inversiones/stock-prices.tsx`):**
  - Muestra las posiciones abiertas del usuario (`stockPositions`).
  - Consulta cotizaciones en vivo vía `/api/stock-price`.
  - Calcula valor actual, beneficio/pérdida no realizado (P&L) en divisa y en porcentaje.
  - Gestión de compras y ventas de posiciones.
- **`SpanishTaxCalculator` (`app/inversiones/spanish-tax-calculator.tsx`):** Simula el impacto del IRPF español sobre ganancias patrimoniales (tramos del ahorro: 19%, 21%, 23%, 27%, 28%).
- **`MacroCalendarWidget` (`app/inversiones/macro-calendar-widget.tsx`):** Calendario de anuncios de bancos centrales, tipos de interés e inflación.
- **`StockCharts` (`app/inversiones/stock-charts.tsx`):** Gráficos históricos interactivos por activo.
- **`InvestmentMonthlyBarChart`:** Aportaciones periódicas de capital mes a mes.

---

## Origen de Datos & APIs
- `getStockPositions()`: Carga las posiciones desde la tabla `stock_positions`.
- `getTransactions()` + `isInvestmentTx`: Filtra las transacciones marcadas como inversión.
- Endpoints auxiliares: `/api/stock-price`, `/api/market-indices`, `/api/macro-calendar`, `/api/fx-rate`.

---

## Acciones del Usuario
- Añadir o eliminar posiciones de acciones/ETFs con precio de compra y fecha.
- Añadir/quitar activos del panel Watchlist.
- Calcular retención fiscal estimada sobre plusvalías.
- Consultar gráficos temporales (1D, 1S, 1M, 1A, Max) de cada activo.
