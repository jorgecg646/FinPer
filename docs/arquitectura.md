# 🏗️ Arquitectura General de FinPer

## 1. Stack Tecnológico
- **Framework:** Next.js (App Router con React Server Components y Server Actions).
- **Lenguaje:** TypeScript (`strict: true`).
- **Estilos e Interfaz:** Tailwind CSS + Radix UI / Shadcn UI + Lucide Icons.
- **Gráficos:** Recharts.
- **Base de Datos & ORM:** PostgreSQL conectado vía `pg` Pool con **Drizzle ORM**.
- **Gestión de Tareas:** Obsidian Canvas + `canvas-tool.py`.

---

## 2. Modelos de Datos Principales (`app/actions/index.ts`)

### `transactions`
Registra los movimientos financieros individuales del usuario:
- `id`: Identificador numérico autoincremental (`serial`).
- `userId`: Identificador estable de la cuenta (`netlify:<id>`) o de un perfil invitado aislado (`guest:<uuid>`).
- `name`: Concepto o descripción del movimiento.
- `category`: Categoría asignada (ej. Vivienda, Alimentación, Ocio, Inversión...).
- `type`: `"income"` (ingreso) o `"expense"` (gasto).
- `amount`: Importe numérico (precisión 12, escala 2).
- `occurredAt`: Fecha en la que tuvo lugar la transacción.
- `createdAt`: Fecha de creación en el sistema.

### `stock_positions`
Registra las posiciones abiertas en activos de inversión:
- `id`: Identificador numérico.
- `userId`: Identificador del usuario.
- `symbol`: Ticker del activo (ej. `AAPL`, `VWCE.DE`, `BTC`).
- `label`: Nombre legible del activo.
- `shares`: Número de acciones / participaciones.
- `avgPrice`: Precio medio ponderado de compra.
- `avgFxRate`: Tipo de cambio medio registrado en la compra.
- `createdAt`: Fecha de registro.

---

## 3. Sesiones, Divisas y Cookies
- La divisa activa se almacena en la cookie `finflow_display_currency`; `finflow-currency` se conserva como clave heredada.
- Monedas soportadas mediante `CURRENCY_SYMBOLS` en `lib/format.ts` (EUR `€`, USD `$`, GBP `£`, etc.).
- Las conversiones y tasas en vivo se obtienen a través del endpoint `/api/fx-rate`.
- La cookie HttpOnly `finflow_identity_token` conserva el token de Netlify Identity; el servidor lo valida con Netlify al resolver la identidad. No requiere una clave de sesión adicional.
- Los visitantes sin cuenta reciben una cookie HttpOnly con un UUID aleatorio por navegador. El servidor no usa una identidad compartida por defecto.
- Al iniciar sesion, las transacciones asociadas al correo verificado y las posiciones asociadas se trasladan a la identidad estable de Netlify dentro de una transaccion.
- Los registros antiguos con `userId = "local-user"` no se reasignan automaticamente: no es posible determinar a que persona pertenecen. Siguen en la base de datos, pero no se muestran a nuevos perfiles invitados ni cuentas.

---

## 4. Endpoints API (`app/api/`)
- `/api/stock-price`: Cotizaciones de activos en tiempo real o en diferido.
- `/api/stock-history`: Histórico de precios para gráficos interactivos.
- `/api/symbol-search`: Búsqueda y autocompletado de tickers y activos.
- `/api/market-indices`: Principales índices bursátiles globales (S&P 500, Nasdaq, IBEX, etc.).
- `/api/macro-calendar`: Eventos económicos y calendario macro (tipos de interés, IPC, etc.).
- `/api/earnings`: Calendario de resultados empresariales.
- `/api/fear-greed`: Índice de Miedo y Codicia del mercado.
- `/api/ai-insights`: Análisis y recomendaciones financieras generadas por IA.
- `/api/parse-pdf`: Extracción y parseo de extractos bancarios en PDF.
