<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="balance" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Cierre y ganancias</div></div>
      <q-space />
      <div class="col-auto"><q-btn flat dense round icon="chevron_left" @click="shift(-7)" /><q-btn flat dense round icon="chevron_right" @click="shift(7)" /></div>
      <div class="col-auto"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="load" /></div>
    </div>

    <template v-if="r">
      <q-card flat class="q-pa-lg q-mb-md text-white" :class="p.profit >= 0 ? 'bg-positive' : 'bg-negative'" style="border-radius: 14px">
        <div class="text-subtitle1">{{ p.profit >= 0 ? 'GANANCIA' : 'PÉRDIDA' }} del {{ fdate(from) }} al {{ fdate(to) }}</div>
        <div class="big-num q-my-sm">{{ bs(Math.abs(p.profit)) }}</div>
        <div class="text-caption">Ventas − costo de truchas − gastos − incobrables. El costo sale de tus cuadres diarios ({{ p.closedDays }} día(s) con cuadre)<span v-if="p.estimatedDays">; los {{ p.estimatedDays }} día(s) sin cuadre usan un costo promedio estimado</span>.</div>
      </q-card>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section class="text-subtitle1 text-weight-bold">Resultado del periodo</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>Vendido ({{ fmt(p.arrobas) }} arrobas)</q-item-section><q-item-section side class="text-weight-bold">{{ bs(p.revenue) }}</q-item-section></q-item>
              <q-item><q-item-section>− Costo de las truchas vendidas</q-item-section><q-item-section side>{{ bs(p.cogs) }}</q-item-section></q-item>
              <q-item><q-item-section>− Gastos</q-item-section><q-item-section side>{{ bs(p.expenses) }}</q-item-section></q-item>
              <q-item><q-item-section>− Deudas incobrables</q-item-section><q-item-section side>{{ bs(p.badDebt) }}</q-item-section></q-item>
              <q-item class="text-weight-bold"><q-item-section>= {{ p.profit >= 0 ? 'Ganancia' : 'Pérdida' }}</q-item-section><q-item-section side :class="p.profit >= 0 ? 'text-positive' : 'text-negative'">{{ bs(p.profit) }}</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section class="text-subtitle1 text-weight-bold">Dinero del periodo</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>Cobrado al vender</q-item-section><q-item-section side>{{ bs(p.cashSales) }}</q-item-section></q-item>
              <q-item><q-item-section>Recogido de deudas</q-item-section><q-item-section side class="text-positive">{{ bs(p.collected) }}</q-item-section></q-item>
              <q-item><q-item-section>Fiado nuevo</q-item-section><q-item-section side class="text-negative">{{ bs(p.creditGiven) }}</q-item-section></q-item>
              <q-item><q-item-section>Cambiaste a soles</q-item-section><q-item-section side>{{ bs(p.exchange.bolivianos) }} → {{ sol(p.exchange.soles) }}</q-item-section></q-item>
              <q-item><q-item-section>Compraste en Perú</q-item-section><q-item-section side>{{ sol(p.purchasedSoles) }}</q-item-section></q-item>
              <q-item><q-item-section>Pagaste a proveedores</q-item-section><q-item-section side>{{ sol(p.supplierPaidSoles) }}</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section class="text-subtitle1 text-weight-bold">Situación actual (acumulada)</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>Capital (Bs en efectivo)</q-item-section><q-item-section side class="text-weight-bold">{{ bs(r.position.cashBs) }}</q-item-section></q-item>
              <q-item><q-item-section>Caja en soles</q-item-section><q-item-section side class="text-weight-bold">{{ sol(r.position.cashSoles) }}</q-item-section></q-item>
              <q-item><q-item-section>Te deben los clientes</q-item-section><q-item-section side class="text-weight-bold text-negative">{{ bs(r.position.customersDebt) }}</q-item-section></q-item>
              <q-item><q-item-section>Debes a proveedores</q-item-section><q-item-section side class="text-weight-bold text-negative">{{ sol(r.supplierDebtSoles) }} (≈ {{ bs(r.supplierDebtBs) }})</q-item-section></q-item>
              <q-item class="text-weight-bold"><q-item-section>Balance neto aproximado</q-item-section><q-item-section side :class="r.netWorthBs >= 0 ? 'text-positive' : 'text-negative'">{{ bs(r.netWorthBs) }}</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section class="row items-center"><div class="text-subtitle1 text-weight-bold">Deuda con cada proveedor</div><q-space /><q-btn flat dense no-caps color="primary" label="Pagar" to="/pagos-proveedores" /></q-card-section>
            <q-list separator dense>
              <q-item v-for="s in r.suppliers" :key="s.id"><q-item-section>{{ s.name }}<q-item-label caption>Comprado {{ sol(s.purchased) }} · pagado {{ sol(s.paid) }}</q-item-label></q-item-section><q-item-section side class="text-weight-bold" :class="s.debt > 0 ? 'text-negative' : 'text-positive'">{{ s.debt > 0 ? 'Debes ' + sol(s.debt) : 'Al día' }}</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '../api';
import { addDays, bs, fdate, fmt, sol, todayStr, weekRange } from '../utils';

const w = weekRange(todayStr());
const from = ref(w.from);
const to = ref(w.to);
const r = ref(null);
const p = computed(() => r.value.period);

async function load() { r.value = (await api.get('/dashboard/report', { params: { from: from.value, to: to.value } })).data; }
function shift(n) { from.value = addDays(from.value, n); to.value = addDays(to.value, n); load(); }
onMounted(load);
</script>
