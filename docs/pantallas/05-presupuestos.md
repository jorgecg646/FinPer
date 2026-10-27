# 🎯 Pantalla: Presupuestos y Metas

- **Ruta:** `/presupuestos`
- **Archivo principal:** `app/presupuestos/page.tsx`
- **Objetivo:** Fijar límites mensuales de gasto por categorías y definir objetivos de ahorro a corto y largo plazo con seguimiento de progreso en vivo.

---

## Componentes Clave
- **`BudgetsAndGoalsManager` (`app/presupuestos/budgets-goals.tsx`):**
  - **Pestaña Presupuestos:** Configuración de topes mensuales por categoría (ej. 300€ en Alimentación, 150€ en Ocio). Muestra barras de progreso dinámicas con colores (verde: <75%, amarillo: 75-100%, rojo: >100% sobrepasado).
  - **Pestaña Metas de Ahorro:** Creación de metas con importe objetivo y fecha límite (ej. "Fondo de emergencia", "Vacaciones").
  - Métrica de dinero restante mensual y porcentaje consumido.

---

## Origen de Datos
- `getSummary(selectedYear)`
- `getTransactions()`: Sirve para cruzar el gasto real de cada mes/categoría con el límite fijado.
- Almacenamiento local o base de datos de límites definidos por el usuario.

---

## Acciones del Usuario
- Crear, editar o eliminar presupuestos por categoría.
- Crear metas con aporte acumulado y ver la proyección de meses restantes para completarlas.
- Filtrar por año y cambiar divisa de referencia.
