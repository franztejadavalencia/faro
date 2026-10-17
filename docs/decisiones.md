# Registro de decisiones

| # | Fecha | Decisión | Por qué | Estado |
|---|-------|----------|---------|--------|
| 1 | 2026-10-17 | Monorepo `D:\FARO` con `faro-backend/` y `faro-frontend/` | Un solo git: commits que tocan ambos lados quedan juntos, worktrees más simples, una sesión de Claude ve todo | Aceptada |
| 2 | 2026-10-17 | Mismo stack que SIAP: NestJS + TypeORM + PostgreSQL / Angular standalone + signals | Reutilizar auth, usuarios, permisos y utils ya probados | Aceptada |
| 3 | 2026-10-17 | Mismas versiones que SIAP: NestJS 10 y Angular 20 | SIAP sigue en desarrollo; compartir código entre ambos sin conflictos de versión | Aceptada |
| 4 | 2026-10-17 | Solo Angular Material (tema Material 3 propio de FARO); sin PrimeNG | Lo que se porta de SIAP ya es Material; mezclar dos librerías duplica temas, estilos y peso. Las tablas de reportes se arman una vez con `mat-table` + `mat-sort` + `mat-paginator` y se reutilizan | Aceptada |
| 5 | 2026-10-17 | Tailwind para layout y espaciado; sin Bootstrap | SIAP ya lo usa; Bootstrap choca con Material porque los dos imponen estilos de componentes | Aceptada |
| 6 | 2026-10-17 | Solo comercio (reventa); sin producción ni servicios | Plazo < 4 meses; el costo es el de compra, sin recetas | Aceptada |
| 7 | 2026-10-17 | Datos por POS propio + registro manual; sin importar Excel | El POS da costo y stock exactos por venta | Aceptada |
| 8 | 2026-10-17 | Valuación PPP o PEPS, se elige al crear el negocio y queda fija | Cambiarla obliga a recalcular el historial y rompe la comparación entre meses | Aceptada |
| 9 | 2026-10-17 | Siempre margen de contribución + prorrateo configurable (% ventas, unidades, manual por línea) | Más útil que solo MC y más simple de alimentar que ABC | Aceptada |
| 10 | 2026-10-17 | IVA/IT se descuentan del margen si el negocio factura; FARO no emite facturas (sin SIAT) | Para no sobrestimar la ganancia; SIAT es un proyecto aparte | Aceptada |
| 11 | 2026-10-17 | Recomendaciones por reglas y proyección con estadística simple; sin ML ni LLM | Pocos meses de datos; fácil de explicar al tribunal | Aceptada |
| 12 | 2026-10-17 | Planes con pago por QR + comprobante que aprueba el admin | Realista en Bolivia, sin contrato con una pasarela | Aceptada |
| 13 | 2026-10-17 | Multi-tenant y `sucursal` en el modelo desde el inicio; UI de sucursales y planes como deseable | Agregar tenant después es caro; sucursales y planes no responden la pregunta central | Aceptada |
| 14 | 2026-10-17 | Dos entregas: versión preliminar (< 4 meses) y versión completa (defensa final). Cada documento guarda su desglose completo desde la preliminar (bruto, descuento, IVA, IT, neto, costo) | Los módulos de la completa leen datos que ya existen, sin migrar ni recalcular historial | Aceptada |
| 15 | 2026-10-17 | Régimen tributario por negocio con historial `(régimen, fecha_desde)`; el cambio vale desde el primer día de un mes abierto. No hay régimen por venta | En el General se factura todo; el Simplificado no factura. Un negocio que crece migra desde una fecha. Cada documento usa el régimen de su fecha, sin recalcular | Aceptada |
| 16 | 2026-10-17 | Contabilidad básica desde la preliminar: plan de cuentas semilla y asiento automático por operación, en la misma transacción que el documento | Base sólida para los estados financieros de la completa; la rentabilidad sale de la contabilidad y se puede demostrar que cuadra | Aceptada |
| 17 | 2026-10-17 | Producto como **auxiliar** de las cuentas Inventario, Ventas, Costo de ventas, IT y Pérdidas; no una cuenta por producto | Con cientos de productos el plan de cuentas sería ilegible y cambiaría con cada alta o baja. El auxiliar da el mismo detalle por producto | Aceptada |
| 18 | 2026-10-17 | Asientos inmutables: la anulación genera un asiento inverso; nunca se borra ni se edita | Práctica contable y trazabilidad para auditoría | Aceptada |
| 19 | 2026-10-17 | Devolución ≠ anulación. Preliminar: solo anulación (error, mes abierto). Devoluciones en la completa, con asientos propios en el mes en que ocurren | La devolución es un hecho nuevo; con factura además requiere nota de crédito-débito (SIAT) | Aceptada |
| 20 | 2026-10-17 | Descuentos y promociones en la completa; la columna `descuento` existe desde la preliminar con valor 0 | Enfocar la preliminar en mostrar resultados | Aceptada |
| 21 | 2026-10-17 | Sueldos como gasto indirecto manual en la preliminar; módulo de personal en la completa que genera el mismo gasto | Los reportes no cambian cuando llegue el módulo | Aceptada |
| 22 | 2026-10-17 | Sin selección de rol operativo; el tenant sale del usuario (un usuario pertenece a un solo negocio) | No aporta en la preliminar; puede volver como módulo si hace falta | Aceptada |
| 23 | 2026-10-17 | Identidad visual: azul FARO #0B2F66 y turquesa #2FC4B2 del logo; **púrpura riqueza #5B2A91 = utilidad, ganancia y botón principal**; naranja #B4320E = pérdida y alertas (sin verde/rojo); signo + / − siempre visible; tipografía única Manrope con cifras de ancho fijo; montos como "Bs 40.740,00" | Una paleta fija, con el mismo significado en todo el sistema, da la apariencia profesional. Púrpura y naranja se distinguen también con daltonismo. Ver mockup de dashboard y POS (tarea A6) | Propuesta (revisar mockup) |
