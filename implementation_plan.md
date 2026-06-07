# Plan de Implementación: Fletes Locales y Herramientas Especiales

## User Review Required
> [!NOTE]
> Estaré agregando la casilla "Inland / Flete Local" para cada equipo de manera individual. ¿Debe sumarse al bloque de la oferta del equipo exportado, o debe desglosarse en la propuesta visual de ventas como un servicio aparte? Por defecto lo sumaré de manera transparente al costo interno de cada Unidad.

## Proposed Changes

### Modificación del Estado Global
#### [MODIFY] src/store/useQuoterStore.ts
- En la interfaz `Equipment` añadiremos `localFreight?: number`.
- En la interfaz `Services` añadiremos `specialEquipment: number`.
- Validaremos su estado inicial (ej. un valor de `0`).

### Sección de Equipos y Flete Interno
#### [MODIFY] src/components/EquipmentForm.tsx
- Introduciré un nuevo _input_ numérico en el formulario llamado **"Flete Local ($)"** para imputar directamente desde la recolección si el equipo incurre en flete nacional directo a bodega/sitio.
- Esto influirá en el `Total Landed Cost`.

### Sección de Equipos Especiales
#### [MODIFY] src/components/ProjectBuilder.tsx
- En el tercer tablerito de **Special Services**, que ahora tiene Instalación y Arranque, colocaré una tercera caja fuerte: **"Equipos Especiales ($)"** (perras hidráulicas, grúas, montacargas, etc).

### Motor de Exportación y Totales
#### [MODIFY] src/components/QuoteSummary.tsx
- En el costo `grandTotalCost`, haré que los Servicios extra se sumen holgadamente.
- El costo nacionalizado de los equipos absorberá el flete local si existe.

#### [MODIFY] src/components/ExportModal.tsx
- Si los servicios suman, actualizaré la línea "Servicios: Instalación, Mano de Obra y Puesta en Marcha" del PDF para que englobe los Equipos Especiales presupuestados.
