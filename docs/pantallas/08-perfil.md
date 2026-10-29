# 👤 Pantalla: Perfil y Preferencias

- **Ruta:** `/perfil`
- **Archivo principal:** `app/perfil/page.tsx`
- **Objetivo:** Gestión de preferencias personales, configuración de usuario, resumen estadístico global y exportación de datos.

---

## Componentes Clave
- **Header:** Resumen del perfil y selector de año.
- **Gráficos de Perfil:**
  - `FinancialOverviewRatioChart`: Ratio global de balance entre ingresos y gastos.
  - `ExpenseCategoryProgressChart`: Gráfico de progreso de consumo por categorías en el año.
- **`ProfileForm` (`app/perfil/profile.tsx`):**
  - Formulario de configuración de usuario.
  - Muestra estadísticas históricas de cuenta (`stats`).
  - Opciones de exportación de informes (PDF, CSV).

---

## Origen de Datos
- `getSummary(targetYear)`
- `getProfileStats()`: Recopila métricas globales (número de movimientos, antigüedad de datos, categorías más usadas).
- `getTransactions()`
