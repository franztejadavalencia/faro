# FARO · Especificación funcional

> Estado: **aprobada (tarea A1)**. Fecha: 2026-10-17.
> Las decisiones de alcance están registradas en `docs/decisiones.md`.
> FARO: Sistema de Rentabilidad y Visibilidad Financiera para Pequeños Negocios.
> *"Para que cada dueño de negocio sepa, mes a mes, en qué gana y en qué pierde."*

## 1. Qué es FARO

### Problema
Los dueños de pequeños comercios en Bolivia suelen saber cuánto venden, pero no qué productos
les dejan ganancia. El costo de la mercadería cambia con cada compra. Los gastos fijos
(alquiler, sueldos, luz) no se asignan a nada, y los impuestos se confunden con la ganancia.
Por eso un producto que "se vende mucho" puede estar perdiendo plata sin que nadie lo note.

### Objetivo general
Desarrollar un sistema web SaaS de gestión y análisis de rentabilidad para que los dueños de
pequeños comercios en Bolivia identifiquen, mes a mes, qué productos y líneas generan ganancia
y cuáles generan pérdida.

### Objetivos específicos
1. Registrar ventas (punto de venta) y compras, y mantener el inventario valorado por PPP o PEPS.
2. Generar automáticamente el asiento contable de cada operación sobre un plan de cuentas
   básico, con detalle por producto, para que la rentabilidad cuadre con la contabilidad.
3. Registrar los gastos indirectos del mes y distribuirlos entre productos con un criterio
   configurable.
4. Calcular cada mes el estado de resultados por producto y por línea: margen de contribución y
   utilidad neta, sin impuestos cuando el negocio factura.
5. Mostrar el ranking de productos y líneas y su evolución entre meses en un dashboard.
6. Calcular el punto de equilibrio y generar alertas y recomendaciones basadas en reglas
   explícitas *(deseable)*.
7. Ofrecer el sistema como servicio para varios negocios, con los datos de cada negocio aislados
   y con registro autoservicio.

### Dos entregas
- **Versión preliminar (P)**: la que se presenta en menos de 4 meses. Se enfoca en mostrar
  resultados de rentabilidad sobre una base sólida.
- **Versión completa (C)**: la de la defensa final. Agrega módulos sobre la misma base.

**Regla de diseño**: la versión preliminar guarda los datos completos aunque todavía no los use.
Cada documento (venta, compra, gasto, ajuste) guarda su desglose entero (bruto, descuento, IVA,
IT, neto, costo) y su asiento contable. Los módulos de la versión completa leen datos que ya
existen: no se migra ni se recalcula historial. Ejemplo: la columna `descuento` existe desde el
inicio y vale 0 hasta que llegue el módulo de promociones.

## 2. Usuarios y roles

| Rol | Ámbito | Qué hace |
|-----|--------|----------|
| **Administrador de plataforma** | Toda la plataforma | Gestiona negocios registrados, planes y aprobación de pagos; da soporte. **No ve** la información comercial de los negocios. |
| **Dueño** | Su negocio | Configura el negocio, gestiona empleados, registra todo y es el único que ve el análisis de rentabilidad completo y la contabilidad. |
| **Empleado** | Su negocio (y sucursal) | Vende en el POS y, según los permisos que le dé el dueño, registra compras, gastos o ajustes. No ve costos, rentabilidad ni contabilidad salvo que tenga ese permiso. |

Los permisos finos se manejan con el esquema de roles y permisos portado de SIAP (módulos,
opciones y roles). Dueño y Empleado son roles semilla que se crean en cada negocio.

Un usuario pertenece a un solo negocio y el negocio (tenant) sale del usuario logueado. **No hay
selección de "rol operativo"** como en SIAP; si alguna vez hace falta, será un módulo posterior.

## 3. Glosario

- **Negocio (tenant)**: comercio registrado en FARO. Todo dato comercial pertenece a un negocio.
- **Sucursal**: punto físico del negocio. Cada negocio tiene al menos una (la principal).
- **Persona**: ficha única de una persona natural o jurídica dentro de un negocio (nombre o razón
  social, documento, contacto). La misma persona puede ser empleado con usuario y proveedor (y
  cliente en la versión completa) sin repetir sus datos. Un negocio no ve las personas de otro.
- **Usuario**: cuenta de acceso de una persona. Su identificador de login es único en toda la
  plataforma, y el negocio sale del usuario.
- **Proveedor**: persona a la que el negocio le compra mercadería; guarda solo sus datos
  comerciales.
- **Bitácora**: registro, de solo inserción, de las acciones sensibles (quién, cuándo, desde
  dónde y qué hizo).
- **Línea**: categoría de productos que define el dueño (p. ej. "Bebidas"). Un solo nivel.
- **Producto**: artículo que se compra y se revende. Pertenece a una línea.
- **Régimen tributario**: *General* (factura todas sus ventas; IVA e IT) o *Simplificado* (no
  factura; paga un impuesto fijo). El negocio guarda un historial de régimen con fecha de inicio.
- **Compra**: ingreso de mercadería de un proveedor; genera entradas al inventario.
- **Venta**: salida de mercadería a un cliente, por POS o por registro manual.
- **Ajuste de inventario**: entrada o salida por merma, pérdida, rotura o conteo físico.
- **Inventario inicial**: stock y costo con los que el negocio empieza a usar FARO.
- **Anulación**: corrige un error; revierte la operación como si no hubiera ocurrido. Solo en mes
  abierto.
- **Devolución**: hecho nuevo con fecha propia (el cliente devuelve mercadería). *(Versión
  completa)*
- **Gasto indirecto**: gasto del mes que no es mercadería (alquiler, sueldos, servicios,
  impuesto fijo del régimen simplificado, etc.), clasificado por categoría.
- **Plan de cuentas**: lista de cuentas contables del negocio. FARO crea uno básico (§5.8).
- **Asiento**: registro contable de partida doble (Σ debe = Σ haber) que FARO genera solo.
- **Auxiliar por producto**: cada línea de asiento de Inventarios, Ventas, Costo de ventas, IT y
  Pérdidas lleva el producto. Así no hace falta una cuenta por producto.
- **Venta neta**: venta sin impuestos (sin IVA ni IT si el negocio factura).
- **Costo de ventas**: costo de la mercadería vendida según el método de valuación.
- **Margen de contribución (MC)**: venta neta − costo de ventas.
- **Prorrateo**: reparto de los gastos indirectos del mes entre productos.
- **Utilidad neta**: MC − gastos indirectos asignados.
- **Cierre de mes**: acción del dueño que congela el mes y genera su reporte definitivo.
- **PPP**: precio promedio ponderado. **PEPS**: primero en entrar, primero en salir (FIFO).

## 4. Módulos

Nivel: **P** = versión preliminar (obligatorio); **P+** = deseable en la preliminar, en el orden
de §6; **C** = versión completa.

### 4.1 Plataforma
| Caso de uso | Nivel |
|---|---|
| Registro autoservicio: el dueño crea su cuenta y su negocio (nombre, NIT opcional, método de valuación, régimen tributario inicial, **fecha de inicio**, inventario inicial). La fecha de inicio es el día 1 de un mes entre 12 meses atrás y el actual y no se puede cambiar después: el primer mes, el régimen inicial y el inventario inicial llevan esa fecha, así el negocio puede cargar los meses que ya vivió | P |
| Admin lista negocios, ve su estado y los activa o suspende | P |
| Admin define planes (límites: sucursales, usuarios, productos) | P+ |
| Dueño elige un plan, paga por QR bancario y sube el comprobante | P+ |
| Admin aprueba o rechaza el comprobante; el plan se activa con fecha de vencimiento | P+ |

### 4.2 Seguridad (base SIAP)
| Caso de uso | Nivel |
|---|---|
| Login con JWT, cambio de contraseña, cierre de sesión (en todas las pestañas) | P |
| Dueño crea, edita y desactiva empleados y les asigna rol y sucursal. Al crear un empleado busca su persona (por documento o nombre) o la crea en el mismo formulario, y le pone un usuario y una clave temporal | P |
| Cambio de contraseña obligatorio en el primer ingreso y después de cada restablecimiento | P |
| Restablecer la contraseña: el dueño la de sus empleados y el admin de plataforma la del dueño (sin recuperación por correo) | P |
| Menú y acceso según los permisos del rol. El rol Dueño tiene todos los permisos y no se puede editar; el dueño edita los permisos de Empleado y de los roles que cree, en una matriz de módulos × opciones | P |
| Sin el permiso "ver costos", el usuario no recibe costos, márgenes ni el valor del inventario | P |
| Bitácora de acciones sensibles: login correcto y fallido, cambio y restablecimiento de clave, cambio de permisos, anulaciones, cierre y reapertura de mes, cambio de régimen | P |
| Autenticación en 2 pasos (TOTP, con app como Google Authenticator): obligatoria para el admin de plataforma, opcional para el dueño | P |
| Selección de rol operativo (si se necesitara) | C |

### 4.3 Configuración del negocio
| Caso de uso | Nivel |
|---|---|
| Método de valuación PPP o PEPS, que se elige al crear el negocio y **no se puede cambiar** | P |
| Régimen tributario con historial: se elige al crear el negocio y se puede cambiar desde el primer día de un mes abierto (§5.1) | P |
| Criterio de prorrateo: % de ventas, unidades vendidas o manual por línea | P |
| Categorías de gasto indirecto (cada una ligada a una cuenta de gasto) | P |
| Carga de inventario inicial (producto, cantidad, costo unitario) | P |
| Gestión de sucursales (alta, baja, empleados por sucursal) | P+ |

### 4.4 Catálogo
| Caso de uso | Nivel |
|---|---|
| CRUD de líneas | P |
| CRUD de productos: código, nombre, línea, unidad, precio de venta, stock mínimo | P |
| CRUD de proveedores sobre `persona`: se busca la persona (por documento o nombre) o se crea en el mismo formulario; el proveedor guarda solo sus datos comerciales | P |

### 4.5 Compras e inventario
| Caso de uso | Nivel |
|---|---|
| Registrar una compra: proveedor, fecha, con o sin factura, medio de pago (efectivo o banco), detalle de productos, cantidad y costo unitario | P |
| Anular una compra con motivo (solo en mes abierto y si no hubo salidas de esos productos en la sucursal después de ella, §5.2) | P |
| Ajuste de inventario con motivo | P |
| Kardex por producto: movimientos, saldo y costo | P |
| Stock actual valorado, con aviso de stock bajo el mínimo | P |
| Inventario por sucursal y traspasos entre sucursales | P+ |

### 4.6 Ventas
| Caso de uso | Nivel |
|---|---|
| POS: buscar producto, armar el carrito, cobrar (efectivo o QR, solo como registro) y emitir un comprobante interno imprimible | P |
| Registro manual de ventas resumidas (p. ej. por día) para quien no usa el POS | P |
| Anular una venta con motivo (en mes abierto); el stock se repone | P |
| Listado de ventas del día o del mes por empleado | P |
| Devoluciones de clientes (total o parcial, en el mes en que ocurren) | C |
| Descuentos y promociones (por ítem o por total) | C |

Toda venta descuenta stock y registra su costo según el método de valuación. **No se puede
vender sin stock suficiente.**

### 4.7 Gastos
| Caso de uso | Nivel |
|---|---|
| Registrar gastos indirectos del mes por categoría (monto, fecha, descripción, con o sin factura, medio de pago) | P |
| Copiar los gastos recurrentes del mes anterior | P |
| Personal y sueldos: planilla que genera el gasto "Sueldos" automáticamente | C |

En la preliminar los sueldos se registran a mano como gasto indirecto de la categoría "Sueldos".

### 4.8 Contabilidad básica
| Caso de uso | Nivel |
|---|---|
| Plan de cuentas semilla creado con cada negocio (§5.8), solo lectura | P |
| Asiento automático por cada operación (§5.9); la anulación genera el asiento inverso | P |
| Libro diario del mes | P |
| Libro mayor por cuenta, con filtro por producto (auxiliar) | P |
| Control de cuadre: Σ auxiliares por producto = saldo de la cuenta (§5.10) | P |
| Balance de comprobación | P+ |
| Plan de cuentas editable (agregar subcuentas) | C |
| Asientos manuales (aportes, retiros del dueño, pago de impuestos) | C |
| Estados financieros: estado de resultados contable y balance general | C |
| Liquidación mensual de IVA e IT | C |

### 4.9 Cierre mensual
| Caso de uso | Nivel |
|---|---|
| El dueño cierra el mes: se verifica el cuadre contable y se calcula y guarda el estado de resultados | P |
| Un mes cerrado no admite registros ni anulaciones con fecha de ese mes | P |
| Reabrir el último mes cerrado, con motivo (queda en auditoría) | P |

### 4.10 Análisis
| Caso de uso | Nivel |
|---|---|
| Estado de resultados del mes por producto y por línea (ver §5) | P |
| Ranking: productos y líneas que más ganan y que más pierden | P |
| Vista preliminar del mes en curso (sin cerrar) | P |
| Dashboard: evolución mensual de ventas, MC y utilidad; mes contra mes; marca del mes en que cambió el régimen | P |
| Punto de equilibrio del negocio y por producto | P+ |
| Alertas (reglas de §5.6) | P+ |
| Recomendaciones por reglas (§5.6) | P+ |
| Proyección de ventas del próximo mes (§5.7) | P+ |
| Exportar reportes a Excel/PDF | P+ |

## 5. Reglas de cálculo

Todo se calcula por negocio y por mes calendario. Montos en Bs con 2 decimales y costos unitarios
con 4 decimales (ver `math.utils` de SIAP).

### 5.1 Impuestos y régimen
Régimen **General** (factura):
- Compra con factura: costo = monto × (1 − 0,13). El IVA (13%) es crédito fiscal y no forma
  parte del costo.
- Compra sin factura: costo = monto total.
- Gasto con factura: gasto = monto × 0,87 y el resto es crédito fiscal. Sin factura: monto total.
- Venta: venta neta = monto cobrado × (1 − 0,13 − 0,03) = monto × 0,84.

Régimen **Simplificado** (no factura): venta neta = monto cobrado; costo y gasto = monto pagado.
El impuesto fijo se registra como gasto indirecto.

Las tasas 13% y 3% son parámetros del sistema y no van escritas en el código. Los regímenes son
un catálogo (se podrán agregar otros, como RAU o STI, en la versión completa).

**Cambio de régimen**:
- El negocio guarda un historial `(régimen, fecha_desde)`. El cambio vale desde el primer día de
  un mes abierto, nunca hacia atrás. Cada mes tiene un solo régimen.
- No se recalcula nada: cada documento usa el régimen vigente en su fecha. La mercadería comprada
  en el Simplificado conserva su costo completo porque no generó crédito fiscal.
- El dashboard marca el mes del cambio, porque con los mismos precios la venta neta baja al 84%.
- FARO no valida los límites del SIN para cambiar de régimen; los decide el dueño.

### 5.2 Valuación del inventario
- **PPP**: con cada compra, costo_prom = (stock × costo_prom + cant × costo_compra) /
  (stock + cant). Cada venta sale al costo_prom vigente.
- **PEPS**: cada compra crea un lote (cantidad, costo). Las ventas consumen los lotes más
  antiguos primero; una venta puede tomar varios lotes.
- El inventario inicial entra como la primera compra (PPP) o el primer lote (PEPS), con la fecha
  de inicio del negocio (§4.1).
- El costo se calcula y se guarda **al registrar** el documento; no se recalcula después.
- **Orden de fechas**: un documento que mueve stock no puede tener fecha anterior al último
  movimiento de cualquiera de sus productos en la sucursal (el mismo día sí se permite; dentro
  del día manda el orden de registro). Así el costo guardado siempre es correcto y el stock
  disponible es el stock actual. Los gastos no tienen esta regla porque no mueven stock.
  Mensaje: "El producto X ya tiene movimientos con fecha 12/10/2026; registre esta operación
  con esa fecha o una posterior".
- Las anulaciones revierten el movimiento con el mismo costo con el que se registró (en PEPS,
  sobre los lotes exactos).
- **Fecha de una anulación**: la más temprana que respete el orden de fechas, es decir la
  fecha del original o, si alguno de sus productos ya se movió después, la de ese último
  movimiento. Tiene que caer en el mismo mes que el original; si no, la anulación se rechaza
  con un mensaje que explica por qué y que el error se corrige con un ajuste de inventario
  (§7). Un gasto se anula con su misma fecha.
- **Anular una entrada** (compra, ajuste positivo, inventario inicial) solo se puede si no hubo
  salidas de esos productos en la sucursal después de ella (en PEPS: el lote no se consumió).
  Si no, en PPP podría quedar valor negativo con stock 0. Anular una salida (venta, ajuste
  negativo) siempre se puede.

### 5.3 Por producto *i* en el mes
- VN_i = Σ venta neta de sus ventas no anuladas
- CV_i = Σ costo de esas ventas
- MC_i = VN_i − CV_i; MC% = MC_i / VN_i
- Las mermas y los ajustes negativos se reportan aparte como "pérdida de inventario" del
  producto y se restan de su MC. Los sobrantes (ajuste positivo) se suman.

### 5.4 Prorrateo de gastos indirectos (G = total del mes)
- G = Σ saldos del mes de las cuentas de gasto de operación (5.2.1.xx, §5.8).
- **% de ventas**: G_i = G × VN_i / Σ VN
- **Unidades**: G_i = G × unidades_i / Σ unidades
- **Manual por línea**: el dueño asigna un % a cada línea (suma 100%); dentro de la línea se
  reparte por % de ventas.
- Los productos sin ventas en el mes no reciben gasto. Si en el mes no hubo ninguna venta, G
  aparece como pérdida del negocio sin asignar.

### 5.5 Resultado
- UN_i = MC_i − G_i. Un producto **gana** si UN_i > 0 y **pierde** si UN_i < 0.
- Línea: suma de los valores de sus productos. Negocio: Σ UN_i = Σ MC − G.

### 5.6 Punto de equilibrio, alertas y recomendaciones *(P+)*
- Equilibrio del negocio: ventas netas = G / (Σ MC / Σ VN).
- Equilibrio por producto (unidades) = G_i / (precio neto unitario − costo unitario).
- Reglas iniciales (los umbrales se pueden configurar):

| Condición | Alerta | Recomendación |
|---|---|---|
| MC_i < 0 | Vende bajo costo | Precio mínimo = costo unitario / factor neto (0,84 o 1) |
| MC_i > 0 y UN_i < 0 dos meses seguidos | No cubre su parte de los fijos | Revisar precio o volumen; mostrar las unidades de equilibrio |
| Sin ventas en el mes y con stock | Producto sin rotación | Liquidar o dejar de comprar |
| Stock < mínimo | Reponer | — |
| MC% cae más de X puntos frente al mes anterior | Margen en caída | Revisar el costo del proveedor |

### 5.7 Proyección *(P+)*
- Con 3 a 5 meses cerrados: promedio móvil de 3 meses.
- Con 6 meses o más: regresión lineal sobre los meses cerrados.
- Con menos de 3 meses no se proyecta y la pantalla lo explica.

### 5.8 Plan de cuentas semilla
Se crea con cada negocio. Los códigos siguen la estructura usual en Bolivia (1 Activo,
2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Costos y gastos). **No se crea una cuenta por producto**:
las cuentas marcadas con *aux* llevan el producto en cada línea de asiento (auxiliar).

| Código | Cuenta | Aux. producto |
|---|---|---|
| 1.1.1.01 | Caja | |
| 1.1.1.02 | Bancos (cobros y pagos por QR o transferencia) | |
| 1.1.3.01 | Crédito fiscal IVA | |
| 1.1.4.01 | Inventario de mercaderías | aux |
| 2.1.3.01 | Débito fiscal IVA | |
| 2.1.3.02 | IT por pagar | |
| 3.1.1.01 | Capital | |
| 4.1.1.01 | Ventas de mercaderías | aux |
| 4.2.1.01 | Sobrantes de inventario | aux |
| 5.1.1.01 | Costo de mercaderías vendidas | aux |
| 5.1.2.01 | Pérdidas de inventario (mermas, roturas, faltantes) | aux |
| 5.2.1.xx | Gastos de operación: una cuenta por categoría de gasto (alquileres, sueldos, servicios básicos, impuesto régimen simplificado, otros) | |
| 5.2.2.01 | Impuesto a las transacciones (IT) | aux |

¿Por qué auxiliar y no una cuenta por producto? Un negocio puede tener cientos de productos. Si
cada uno fuera una cuenta, el plan de cuentas crecería con cada alta o baja de producto y los
reportes contables serían ilegibles. Con el auxiliar, la contabilidad usa pocas cuentas y el
análisis puede filtrar cualquier cuenta por producto. Así se llevan los "mayores auxiliares" en
la práctica contable.

### 5.9 Asientos por operación
Ejemplos con monto 100 y costo 60. *[p]* = la línea lleva el producto. "Caja/Bancos" depende del
medio de pago. En una venta o compra con varios productos hay una línea *[p]* por producto.

| Operación | Debe | Haber |
|---|---|---|
| Inventario inicial | Inventario 60 [p] | Capital 60 |
| Compra con factura (General) | Inventario 87 [p]; Crédito fiscal IVA 13 | Caja/Bancos 100 |
| Compra sin factura, o régimen Simplificado | Inventario 100 [p] | Caja/Bancos 100 |
| Venta (General) | Caja/Bancos 100; IT 3 [p] | Ventas 87 [p]; Débito fiscal IVA 13; IT por pagar 3 |
| Venta (Simplificado) | Caja/Bancos 100 | Ventas 100 [p] |
| Costo de la venta (ambos) | Costo de mercaderías vendidas 60 [p] | Inventario 60 [p] |
| Gasto con factura (General) | Gasto de la categoría 87; Crédito fiscal IVA 13 | Caja/Bancos 100 |
| Gasto sin factura, o Simplificado | Gasto de la categoría 100 | Caja/Bancos 100 |
| Ajuste negativo (merma) | Pérdidas de inventario [p] | Inventario [p] |
| Ajuste positivo (sobrante) | Inventario [p] | Sobrantes de inventario [p] |
| Anulación de cualquiera | Asiento inverso del original, con la fecha de la anulación (§5.2: la del original salvo que el orden de fechas obligue a una posterior, siempre en el mismo mes) y referencia al original | |

Reglas:
- Los asientos **nunca se borran ni se editan**: una corrección es un asiento inverso.
- El asiento se genera en la misma transacción de base de datos que el documento. Si no cuadra
  (Σ debe ≠ Σ haber), la operación entera falla.
- Los redondeos de IVA/IT se calculan por línea de producto; la diferencia de centavos con el
  total se ajusta en la última línea.

*Versión completa*: devolución (Devoluciones sobre ventas e Inventario al debe; Caja/Bancos y
Costo de mercaderías vendidas al haber, en el mes en que ocurre), pago de IVA e IT al SIN,
aportes y retiros del dueño.

### 5.10 La rentabilidad sale de la contabilidad
Los valores de §5.3 se leen de los movimientos del mes en las cuentas con auxiliar:
- VN_i = Ventas[i] − IT[i]
- CV_i = Costo de mercaderías vendidas[i]
- Pérdida de inventario_i = Pérdidas[i] − Sobrantes[i]
- G = Σ cuentas 5.2.1.xx

Control de cuadre (se verifica al cerrar el mes y se muestra en la vista de contabilidad):
- Σ por producto de Inventario[i] = saldo de la cuenta Inventario = stock valorado del kardex.
- Σ por producto de Ventas[i] = saldo de la cuenta Ventas del mes.
- Σ UN_i = resultado contable del mes (ingresos − costos − gastos).

Esto permite mostrar en la defensa que el análisis de rentabilidad cuadra con la contabilidad.

## 6. Alcance

**Versión preliminar (P)**, plazo menor a 4 meses: todo lo marcado como P en §4. En resumen: un
negocio por cuenta con registro autoservicio, seguridad, catálogo, inventario inicial, compras e
inventario (PPP/PEPS), POS y ventas manuales, gastos con prorrateo, contabilidad básica con
asientos automáticos, cierre mensual, estado de resultados, ranking y dashboard, con impuestos
configurables y régimen con historial.

El modelo de datos incluye `negocio` (tenant) y `sucursal` desde el inicio. Mientras la UI de
sucursales no exista, se usa una sucursal principal creada automáticamente.

**Deseable en la preliminar (P+)**, en este orden: punto de equilibrio y alertas →
recomendaciones → proyección → balance de comprobación → sucursales (UI, inventario por
sucursal, traspasos) → planes y pago por QR → exportación.

**Versión completa (C)**: lo que quede de P+ y además devoluciones, descuentos y promociones,
personal y sueldos, contabilidad ampliada (plan editable, asientos manuales, estados
financieros, liquidación de IVA e IT), regímenes adicionales y rol operativo si se necesita.

**Fuera de alcance**: producción y recetas, negocios de servicios, facturación electrónica
(SIAT), contador con varios negocios, POS sin conexión, ML o IA generativa, pasarela de
pagos, multi-moneda, app móvil nativa, cuentas por cobrar y por pagar (ventas y compras a
crédito), activos fijos y depreciación.

## 7. Supuestos y preguntas cerradas

**Supuestos**:
- Moneda única Bs; interfaz en español; aplicación web responsive y siempre en línea.
- No se permite stock negativo: no se vende sin stock suficiente.
- El régimen tributario se aplica a todo el negocio, no a cada venta (§5.1).
- Todas las compras, ventas y gastos son al contado (caja o banco).
- El mes es el mes calendario; solo se puede reabrir el último mes cerrado.

**Limitación conocida de la preliminar**:
- Un error de un mes anterior que ya no se puede anular (§5.2) se corrige con un **ajuste de
  inventario** en el mes en curso. El ajuste corrige la cantidad y el costo, pero **no la venta
  neta del mes original**. Eso lo resuelven las devoluciones de la versión completa (§5.9).

**Preguntas cerradas** (2026-10-17):
1. Ventas con y sin factura → régimen por negocio con historial; en el General se factura todo.
2. Devoluciones → no son anulaciones; quedan para la versión completa (§5.9).
3. Descuentos → versión completa; la columna existe desde la preliminar con valor 0.
4. Sueldos → gasto indirecto manual en la preliminar; módulo de personal en la completa.
5. Rol operativo → no se usa; el tenant sale del usuario.
