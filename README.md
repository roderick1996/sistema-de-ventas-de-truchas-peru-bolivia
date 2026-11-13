# 🐟 Truchas ViKI

Sistema para controlar la venta de truchas: llegadas desde Perú, ventas por arroba, **deudas y cobros**, cambio Bs→Soles, pagos a proveedores, gastos y ganancias.

**Tecnología:** Vue 3 + Quasar · NestJS · PostgreSQL · Docker Compose · Login con JWT.

## Cómo encenderlo

```bash
cp .env.example .env      # cambia las claves
docker compose up -d --build
```
Abre http://localhost:8080 (o `http://IP-DEL-PC:8080` desde otro celular/PC de la red).

**Usuarios:** `rodrigo` y `gabriela` — contraseña inicial = `SEED_PASSWORD` del `.env` (por defecto `viki2026`). Cámbiala en el menú de arriba → *Cambiar contraseña*.

## Flujo diario
1. **Llegadas de Perú**: fecha, proveedor (Nubeluz, Sonia, Basilio, Roberto), cubetas (12, 13…), kg por cubeta (35 o más) y **precio por kilo en soles** (16, 15, 13…). Calcula solo: cubetas × kg × precio.
2. **Panel**: lo principal son **Por cobrar** (rojo) y **Recogido hoy** (verde). Deudores con alerta roja si pasan de 7 días (se cambia en Ajustes). Al abrir el panel sale una notificación con los deudores.
3. **Nueva venta**: botones ¼, ½, 1, 2… arrobas. Si se lo lleva fiado, activa "fiado", elige/crea cliente y lo que dejó a cuenta.
4. **Cobrar**: botón *Cobrar* en el deudor. Cuando paga todo **desaparece del panel** (queda guardado en la base de datos). Si ya no pagará, *Incobrable* lo pasa a pérdida.
5. **Cuadre del día** (pantalla nueva, como tu cuaderno): anotas las cubetas vendidas (ej. 10) → 350 kg × S/16 = S/5,600 × tipo de cambio del día (3.50) = **Bs 19,600 a reponer**. Después cuentas el **efectivo que tienes en caja** (ej. Bs 10,000): efectivo + fiado (con los nombres) se compara contra lo que repones a Perú y te dice cuánto sobra (ganancia) o falta. Así cuadra aunque no hayas anotado cada venta. Si dejas el efectivo vacío, usa solo las ventas anotadas. Compara también con las deudas recogidas y los gastos. También controla los kilos de cubetas contra las arrobas vendidas.
5b. **Recogidos** (menú, debajo de Deudas): lista a todos los que deben, con **buscador por nombre**. Cada persona muestra de qué días debe; botón *Cobrar* (cualquier monto, parcial o total, con fecha) o *Cobrar esta* para una deuda en particular. Lo recogido **no suma al cuadre ni a las ventas del día**: se acumula en **Capital**.
5c. **Capital** (menú, debajo de Gastos) = **el dinero real en bolivianos**, y se arma solo: el **efectivo contado en el cuadre de cada día** (se suma cada tarde al guardar el cuadre) + las **deudas recogidas** + lo que agregues − los **cambios a soles** − los **gastos** − lo que uses. En el cuadre del día lo recogido sale solo como *recogido* (informativo) y no suma a lo vendido, pero su dinero sí entra al Capital. Si un día no tiene cuadre, se suman las ventas al contado anotadas.
6. **Reportes por día** (lunes a sábado): para cualquier semana o rango de fechas ves, día por día, el cuaderno completo: cubetas × kilos × soles × cambio = bolivianos a reponer, lo vendido (contado y fiado), a quién se fio, quiénes pagaron deudas, gastos y si hubo ganancia o pérdida. Los días con ventas pero sin cuadre salen marcados **"Falta cuadre"** y el panel te avisa; con un clic abres ese día y lo completas con su fecha. Se puede imprimir o descargar en Excel (CSV).
7. **Fin de semana**: *Cambio Bs → Soles*, *Pagos a proveedores* y *Cierre y ganancias* (ganancia/pérdida, caja, deudas, cuánto debes a cada proveedor).

## Cómo se calcula la ganancia
`Ventas − costo de las truchas vendidas − gastos − incobrables`.
El costo sale de tus **cuadres diarios**. Los días sin cuadre usan un costo promedio estimado (precio por kilo de Perú × tipo de cambio). 1 arroba = 11.5 kg (editable en Ajustes).

## Si ya tenías deudas antes del sistema
- Clientes: registra una venta fiado y marca **"Es una deuda anterior"** (no cuenta como venta ni utilidad).
- Proveedores: pon la "Deuda anterior (soles)" en Proveedores.
- Dinero en caja inicial: en Ajustes.

## Respaldo de la base de datos
```bash
docker compose exec db pg_dump -U viki truchas_viki > respaldo.sql
```
Los datos viven en el volumen `pgdata` y no se pierden al reiniciar.

## Desarrollo sin Docker
Backend: `cd backend && npm i && npm run start:dev` (necesita PostgreSQL, variables DB_*).
Frontend: `cd frontend && npm i && npm run dev` (http://localhost:9000, proxy a :3000).
