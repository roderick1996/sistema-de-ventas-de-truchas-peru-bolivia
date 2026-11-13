<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="assessment" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Reportes por día</div></div>
      <q-space />
      <div class="col-auto no-print"><q-btn-group unelevated>
        <q-btn no-caps label="Esta semana" @click="preset('week')" /><q-btn no-caps label="Semana pasada" @click="preset('last')" /><q-btn no-caps label="Este mes" @click="preset('month')" />
      </q-btn-group></div>
      <div class="col-auto no-print"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto no-print"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto no-print"><q-btn flat dense no-caps icon="print" label="Imprimir" @click="print" /><q-btn flat dense no-caps icon="download" label="Excel (CSV)" @click="csv" /></div>
    </div>

    <template v-if="r">
      <q-banner v-if="r.totals.missingDays" rounded class="bg-orange-1 text-orange-10 q-mb-md no-print">
        <template #avatar><q-icon name="event_busy" color="warning" /></template>
        Faltan <b>{{ r.totals.missingDays }}</b> cuadre(s) en este periodo. Ábrelos en los días marcados "Falta cuadre".
      </q-banner>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Vendido</div><div class="text-h6 text-weight-bold">{{ bs(r.totals.sold) }}</div><div class="text-caption text-grey-7">{{ fmt(r.totals.arrobas) }} arrobas</div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Fiado dado / Recogido</div><div class="text-subtitle1 text-weight-bold"><span class="text-negative">{{ bs(r.totals.credit) }}</span> / <span class="text-positive">{{ bs(r.totals.collected) }}</span></div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">A reponer a Perú ({{ fmt(r.totals.buckets, 1) }} cub.)</div><div class="text-h6 text-weight-bold">{{ bs(r.totals.costBs) }}</div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat class="q-pa-md text-white" :class="r.totals.result >= 0 ? 'bg-positive' : 'bg-negative'"><div class="text-caption">{{ r.totals.result >= 0 ? 'Ganancia' : 'Pérdida' }} (días con cuadre)</div><div class="text-h6 text-weight-bold">{{ bs(Math.abs(r.totals.result)) }}</div></q-card></div>
      </div>

      <div class="row items-center q-mb-sm no-print"><q-space /><q-btn flat dense no-caps color="primary" :label="allOpen ? 'Cerrar todos' : 'Abrir todos los días'" @click="toggleAll" /></div>

      <q-card v-for="x in r.days" :key="x.date" flat bordered class="q-mb-sm">
        <q-expansion-item v-model="open[x.date]" expand-separator>
          <template #header>
            <q-item-section>
              <q-item-label class="text-weight-bold text-capitalize">{{ dayName(x.date) }}</q-item-label>
              <q-item-label caption v-if="!x.idle">Vendido {{ bs(x.sold) }} · fiado {{ bs(x.credit) }} · recogido {{ bs(x.collected) }}</q-item-label>
              <q-item-label caption v-else>Sin movimiento</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="x.missing" color="warning" text-color="black" class="q-pa-xs">Falta cuadre</q-badge>
              <q-badge v-else-if="x.result !== null" :color="x.result >= 0 ? 'positive' : 'negative'" class="q-pa-xs">{{ x.result >= 0 ? 'Ganancia' : 'Pérdida' }} {{ bs(Math.abs(x.result)) }}</q-badge>
            </q-item-section>
          </template>

          <div class="q-pa-md row q-col-gutter-lg">
            <div class="col-12 col-md-6">
              <div class="text-subtitle2 text-weight-bold q-mb-xs">Cubetas de Perú</div>
              <template v-if="x.hasClosing">
                <div v-for="(l, i) in x.lines" :key="i" class="text-body2">{{ l.supplierName }} ({{ l.product === 'NORMAL' ? 'normal' : 'retacos' }}): {{ fmt(l.bucketsSold, 1) }} cub × {{ fmt(l.kgPerBucket, 0) }} kg = {{ fmt(l.bucketsSold * l.kgPerBucket, 0) }} kg × S/{{ fmt(l.pricePerKg) }} = <b>{{ sol(l.bucketsSold * l.kgPerBucket * l.pricePerKg) }}</b></div>
                <div class="q-mt-sm text-body1">{{ fmt(x.calc.bucketsSold, 1) }} cub · {{ fmt(x.calc.kgSold, 0) }} kg → {{ sol(x.calc.solesCost) }} × {{ fmt(x.rate, 2) }} = <b class="text-primary">{{ bs(x.calc.costBs) }}</b> a reponer</div>
                <div v-if="x.notes" class="text-caption text-grey-8 q-mt-xs">Nota: {{ x.notes }}</div>
              </template>
              <div v-else class="text-grey-8">Sin cuadre de cubetas<span v-if="x.arrivedBuckets"> (llegaron {{ fmt(x.arrivedBuckets, 1) }} cubetas)</span>.</div>
              <q-btn class="q-mt-sm no-print" dense unelevated no-caps color="primary" :label="x.hasClosing ? 'Editar cuadre' : 'Hacer cuadre de este día'" :to="`/cuadre?date=${x.date}`" />
            </div>

            <div class="col-12 col-md-6">
              <div class="text-subtitle2 text-weight-bold q-mb-xs">Cómo cuadró</div>
              <q-list dense separator bordered class="rounded-borders">
                <q-item v-if="x.cashCounted !== null"><q-item-section>Efectivo contado ese día</q-item-section><q-item-section side class="text-weight-bold">{{ bs(x.cashCounted) }}</q-item-section></q-item>
                <q-item><q-item-section>Vendido ({{ fmt(x.arrobas) }} arrobas)</q-item-section><q-item-section side class="text-weight-bold">{{ bs(x.sold) }}</q-item-section></q-item>
                <q-item><q-item-section class="text-grey-8">· al contado</q-item-section><q-item-section side>{{ bs(x.cash) }}</q-item-section></q-item>
                <q-item><q-item-section class="text-negative">· fiado</q-item-section><q-item-section side class="text-negative">{{ bs(x.credit) }}</q-item-section></q-item>
                <q-item><q-item-section>Recogido (informativo; suma al Capital)</q-item-section><q-item-section side class="text-positive">{{ bs(x.collected) }}</q-item-section></q-item>
                <q-item><q-item-section>Gastos</q-item-section><q-item-section side>{{ bs(x.expenses) }}</q-item-section></q-item>
                <template v-if="x.hasClosing">
                  <q-item><q-item-section>¿Lo vendido cubre lo que repones?</q-item-section><q-item-section side :class="x.covers ? 'text-positive' : 'text-negative'">{{ x.covers ? 'Sí, cubre' : 'No cubre' }}</q-item-section></q-item>
                  <q-item class="text-weight-bold"><q-item-section>{{ x.result >= 0 ? 'Ganancia' : 'Pérdida' }}</q-item-section><q-item-section side :class="x.result >= 0 ? 'text-positive' : 'text-negative'">{{ bs(Math.abs(x.result)) }}</q-item-section></q-item>
                </template>
              </q-list>
            </div>

            <div class="col-12 col-md-6">
              <div class="text-subtitle2 text-negative text-weight-bold q-mb-xs">A quién se le fio</div>
              <div v-for="(c, i) in x.credits" :key="i" class="row text-body2"><div class="col">{{ c.customer }} <span class="text-grey-7">· {{ arrobas(c.arrobas) }} {{ productName(c.product) }}<span v-if="c.legacy"> · deuda anterior</span></span></div><b class="text-negative">{{ bs(c.amount) }}</b></div>
              <div v-if="!x.credits.length" class="text-grey">Nadie.</div>
            </div>
            <div class="col-12 col-md-6">
              <div class="text-subtitle2 text-positive text-weight-bold q-mb-xs">Quiénes pagaron deudas</div>
              <div v-for="(c, i) in x.collections" :key="i" class="row text-body2"><div class="col">{{ c.customer }}</div><b class="text-positive">{{ bs(c.amount) }}</b></div>
              <div v-if="!x.collections.length" class="text-grey">Nadie pagó deudas.</div>
            </div>
          </div>
        </q-expansion-item>
      </q-card>
      <div v-if="!r.days.length" class="text-grey-7 q-pa-md">No hay días en este rango.</div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from '../api';
import { addDays, arrobas, bs, dayName, fmt, productName, sol, todayStr, weekRange } from '../utils';

const w = weekRange(todayStr());
const from = ref(w.from);
const to = ref(addDays(w.from, 5)); // lunes a sábado
const r = ref(null);
const open = reactive({});
const allOpen = computed(() => r.value?.days.length && r.value.days.every((d) => open[d.date]));

async function load() {
  r.value = (await api.get('/closings/range', { params: { from: from.value, to: to.value } })).data;
}
function preset(k) {
  const t = todayStr();
  if (k === 'week') { const x = weekRange(t); from.value = x.from; to.value = addDays(x.from, 5); }
  if (k === 'last') { const x = weekRange(addDays(t, -7)); from.value = x.from; to.value = addDays(x.from, 5); }
  if (k === 'month') { from.value = t.slice(0, 8) + '01'; to.value = t; }
  load();
}
function toggleAll() { const v = !allOpen.value; r.value.days.forEach((d) => (open[d.date] = v)); }
function print() { r.value.days.forEach((d) => (open[d.date] = true)); setTimeout(() => window.print(), 300); }
function csv() {
  const head = ['Fecha', 'Cubetas vendidas', 'Kg', 'Soles', 'Tipo de cambio', 'A reponer (Bs)', 'Vendido (Bs)', 'Contado', 'Fiado', 'Recogido', 'Gastos', 'Resultado (Bs)', 'Fiado a', 'Pagaron'];
  const rows = r.value.days.map((d) => [
    d.date, d.calc?.bucketsSold ?? '', d.calc?.kgSold ?? '', d.calc?.solesCost ?? '', d.rate ?? '', d.calc?.costBs ?? '',
    d.sold, d.cash, d.credit, d.collected, d.expenses, d.result ?? 'sin cuadre',
    d.credits.map((c) => `${c.customer} ${c.amount}`).join('; '), d.collections.map((c) => `${c.customer} ${c.amount}`).join('; '),
  ]);
  const text = [head, ...rows].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = `reporte-truchas-${from.value}_a_${to.value}.csv`;
  a.click();
}
onMounted(load);
</script>
