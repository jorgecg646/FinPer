# 📚 Documentación de FinPer

Este directorio contiene la documentación técnica y funcional de **FinPer**, diseñada para ser consultada tanto por desarrolladores como por agentes de inteligencia artificial (Claude, Cursor, Codex, Gemini).

---

## 🗂️ Estructura de Documentación

### 1. Sistema y Arquitectura
- **[Arquitectura General](arquitectura.md)**: Stack tecnológico, conexión con PostgreSQL/Drizzle ORM, gestión de divisas y endpoints API.
- **[Flujo de Tareas Kanvas](../KANVAS.md)**: Metodología del tablero visual Obsidian Canvas y CLI `canvas-tool.py`.
- **[Reglas de Trabajo](../RULES.md)**: Protocolo de estados, colores y transiciones para tareas.

### 2. Especificación por Pantalla
| Pantalla | Ruta | Descripción |
|---|---|---|
| **[01. Dashboard](pantallas/01-dashboard.md)** | `/` | Vista resumen financiero, balances, métricas anuales, gráficos y AI Insights. |
| **[02. Gastos](pantallas/02-gastos.md)** | `/gastos` | Control de salidas, desglose por categorías y mapa de calor en calendario. |
| **[03. Ingresos](pantallas/03-ingresos.md)** | `/ingresos` | Fuentes de ingresos, recurrencias y comparativas temporales. |
| **[04. Inversiones](pantallas/04-inversiones.md)** | `/inversiones` | Portafolio bursátil, cotizaciones en vivo, watchlist, métricas macro y fiscalidad. |
| **[05. Presupuestos](pantallas/05-presupuestos.md)** | `/presupuestos` | Límites por categoría, alertas de desviación y metas de ahorro. |
| **[06. Suscripciones](pantallas/06-suscripciones.md)** | `/suscripciones` | Pagos recurrentes periódicos, calendario de cobros y proyección de coste. |
| **[07. Calculadoras](pantallas/07-calculadoras.md)** | `/calculadoras` | Simuladores FIRE, impacto de gastos hormiga y escenarios de ahorro. |
| **[08. Perfil](pantallas/08-perfil.md)** | `/perfil` | Preferencias de usuario, selector de divisa base y exportación. |

---

## 💡 Uso con Obsidian y Agentes
- En **Obsidian**, puedes arrastrar cualquiera de estas notas al archivo `FinPer.canvas` o enlazarlas dentro de tareas con `[[04-inversiones.md]]`.
- Al pedir trabajo a una **IA**, puedes indicarle: *"Revisa `docs/pantallas/04-inversiones.md` antes de modificar la pantalla de inversiones"*.
