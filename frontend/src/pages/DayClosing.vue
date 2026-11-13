<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="fact_check" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Cuadre del día</div></div>
      <q-space />
      <div class="col-auto"><q-btn flat dense round icon="chevron_left" @click="shift(-1)" /><q-btn flat dense round icon="chevron_right" @click="shift(1)" /></div>
      <div class="col-auto"><q-input v-model="date" type="date" dense outlined style="width: 170px" @update:model-value="load" /></div>
      <div class="col-auto"><q-btn flat no-caps color="primary" label="Hoy" @click="date = todayStr(); load()" /></div>
    </div>

    <template v-if="d">
      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-7">
          <!-- 1. CUBETAS -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">1. Cubetas vendidas de Perú</div>
              <div class="text-caption text-grey-7">Igual que tu cuaderno: cubetas × kilos × precio por kilo (soles), y luego al tipo de cambio del día.</div>
              <div v-if="d.arrivals.length" class="text-caption text-primary q-mt-xs">Llegaron este día: {{ d.arrivals.map((a) => `${a.supplierName} ${fmt(a.buckets, 1)} cub.`).join(' · ') }}</div>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-md">
              <div v-for="(l, i) in lines" :key="i" class="line q-pa-sm rounded-borders">
                <div class="row q-col-gutter-xs items-center">
                  <div class="col-6 col-sm-3"><q-select v-model="l.supplierId" :options="suppliers" option-value="id" option-label="name" emit-value map-options outlined dense label="Proveedor" bg-color="white" /></div>
                  <div class="col-6 col-sm-3"><q-select v-model="l.product" :options="products" emit-value map-options outlined dense label="Tipo" bg-color="white" /></div>
                  <div class="col-4 col-sm-2"><q-input v-model.number="l.bucketsSold" type="number" step="0.5" min="0" outlined dense label="Cubetas" bg-color="white" /></div>
                  <div class="col-4 col-sm-2"><q-input v-model.number="l.kgPerBucket" type="number" min="0" outlined dense label="Kg/cub." bg-color="white" /></div>
                  <div class="col-4 col-sm-2"><q-input v-model.number="l.pricePerKg" type="number" step="0.5" min="0" outlined dense label="S/ por kilo" bg-color="white" /></div>
                </div>
                <div class="row items-center q-mt-xs">
                  <div class="text-caption text-grey-9 col">{{ fmt(l.bucketsSold, 1) }} cub × {{ fmt(l.kgPerBucket, 0) }} kg = <b>{{ fmt(l.bucketsSold * l.kgPerBucket, 0) }} kg</b> × S/{{ fmt(l.pricePerKg) }} = <b>{{ sol(l.bucketsSold * l.kgPerBucket * l.pricePerKg) }}</b></div>
                  <q-btn flat round dense icon="close" color="negative" size="sm" :disable="lines.length === 1" @click="lines.splice(i, 1)" />
                </div>
              </div>
              <q-btn flat no-caps color="primary" icon="add" label="Agregar otro proveedor / tipo" @click="lines.push(blank())" />
              <q-input v-model.number="rate" type="number" step="0.01" min="0" outlined dense label="Tipo de cambio del día (Bs por 1 sol)" hint="Se mueve: ponlo como esté hoy (ej. 3.50)" />
            </q-card-section>
            <q-separator />
            <q-card-section class="bg-blue-1">
              <div class="text-body1">{{ fmt(t.buckets, 1) }} cubetas · {{ fmt(t.kg, 0) }} kg → <b>{{ sol(t.soles) }}</b> × {{ fmt(rate, 2) }} =</div>
              <div class="text-h5 text-weight-bold text-primary">Bs {{ fmt(t.costBs) }} <span class="text-subtitle2 text-grey-8">que tienes que reponer</span></div>
            </q-card-section>
          </q-card>

          <!-- 2. EFECTIVO -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">2. Efectivo que tienes</div>
              <div class="text-caption text-grey-7">Cuenta el efectivo de las ventas de hoy (ya sin los gastos que pagaste). Lo que te pagaron de deudas no entra aquí (sale aparte como recogido). Este efectivo se suma al Capital al guardar el cuadre.</div>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-sm">
              <q-input v-model="cash" type="number" min="0" step="10" outlined dense label="Efectivo contado" prefix="Bs" input-class="text-h6 text-weight-bold" hint="Déjalo vacío para usar solo las ventas anotadas" />
              <q-checkbox v-if="hasCash && d.collected > 0" v-model="incl" dense :label="`En ese efectivo también está lo que me pagaron de deudas (${bs(d.collected)}); no cuenta como venta`" />
              <div v-if="hasCash" class="cover q-pa-md rounded-borders">
                <div class="row"><div class="col">Efectivo de las ventas</div><b>{{ bs(cashSales) }}</b></div>
                <div class="row"><div class="col text-negative">+ Fiado por cobrar</div><b class="text-negative">{{ bs(d.sales.credit) }}</b></div>
                <div class="row"><div class="col">= Efectivo + fiado</div><b>{{ bs(available) }}</b></div>
                <div class="row"><div class="col">− A reponer a Perú</div><b>{{ bs(t.costBs) }}</b></div>
                <q-separator class="q-my-xs" />
                <div class="row text-subtitle1 text-weight-bold" :class="result >= 0 ? 'text-positive' : 'text-negative'"><div class="col">{{ result >= 0 ? 'Sobra (ganancia)' : 'Falta' }}</div><div>{{ bs(Math.abs(result)) }}</div></div>
              </div>
              <q-input v-model="notes" outlined dense label="Notas del día (opcional)" />
            </q-card-section>
          </q-card>

          <!-- 3. FIADOS -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">3. Personas a quienes di fiado</div>
              <div class="text-caption text-grey-7">Anota aquí a cada persona que se llevó trucha a deuda. Se suma al cuadre y queda en el panel con su fecha.</div>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-sm">
              <q-list v-if="d.credits.length" bordered separator dense class="rounded-borders">
                <q-item v-for="c in d.credits" :key="c.id">
                  <q-item-section>{{ c.customer }}<q-item-label caption>{{ arrobas(c.arrobas) }} {{ productName(c.product) }}</q-item-label></q-item-section>
                  <q-item-section side class="text-negative text-weight-bold">{{ bs(c.amount) }}</q-item-section>
                  <q-item-section side><q-btn flat round dense size="sm" icon="delete" color="grey-7" @click="removeCredit(c)" /></q-item-section>
                </q-item>
                <q-item class="text-weight-bold"><q-item-section>Total fiado</q-item-section><q-item-section side class="text-negative">{{ bs(d.sales.credit) }}</q-item-section></q-item>
              </q-list>
              <div v-else class="text-grey-7">Todavía no anotaste a nadie.</div>

              <div class="fiado-form q-pa-sm rounded-borders q-gutter-y-sm">
                <q-select v-model="fiado.name" :options="shown" option-value="id" option-label="name" emit-value map-options use-input input-debounce="0" new-value-mode="add-unique"
                  outlined dense bg-color="white" label="¿Quién se lo llevó? (escribe el nombre)" hint="Si es nueva, escribe el nombre y presiona Enter" @filter="filterCustomers" />
                <q-btn-toggle v-model="fiado.product" spread no-caps unelevated dense toggle-color="primary" color="grey-3" text-color="grey-9"
                  :options="[{ label: 'Trucha normal', value: 'NORMAL' }, { label: 'Retacos', value: 'RETACO' }]" />
                <div class="row q-gutter-xs">
                  <q-btn v-for="q in quick" :key="q.v" no-caps dense class="q-px-sm" :unelevated="fiado.arrobas === q.v" :outline="fiado.arrobas !== q.v" color="primary" :label="q.l" @click="fiado.arrobas = q.v" />
                </div>
                <div class="row q-col-gutter-xs">
                  <div class="col-4"><q-input v-model.number="fiado.arrobas" type="number" step="0.25" min="0" outlined dense bg-color="white" label="Arrobas" /></div>
                  <div class="col-4"><q-input v-model.number="fiado.total" type="number" min="0" outlined dense bg-color="white" label="Total (Bs)" prefix="Bs" /></div>
                  <div class="col-4"><q-input v-model.number="fiado.paid" type="number" min="0" outlined dense bg-color="white" label="Dejó a cuenta" prefix="Bs" /></div>
                </div>
                <div v-if="fiado.total > 0" class="text-negative text-weight-bold">Queda debiendo: {{ bs(Math.max(0, (fiado.total || 0) - (fiado.paid || 0))) }}</div>
                <q-btn color="negative" unelevated no-caps icon="person_add" label="Anotar fiado" :loading="adding" @click="addFiado" />
              </div>
            </q-card-section>
          </q-card>

          <div class="row q-gutter-sm">
            <q-btn color="primary" unelevated no-caps size="lg" icon="save" :label="d.closing ? 'Actualizar cuadre' : 'Guardar cuadre'" :loading="saving" @click="save" />
            <q-btn v-if="d.closing" flat no-caps color="negative" label="Borrar cuadre" @click="removeClosing" />
          </div>
        </div>

        <!-- RESULTADO -->
        <div class="col-12 col-md-5">
          <q-card flat class="q-pa-lg q-mb-md text-white" :class="result >= 0 ? 'bg-positive' : 'bg-negative'" style="border-radius: 14px">
            <div class="text-subtitle1">{{ result >= 0 ? 'GANANCIA' : 'PÉRDIDA' }} del día</div>
            <div class="big-num q-my-sm">{{ bs(Math.abs(result)) }}</div>
            <div class="text-caption">{{ hasCash ? 'Efectivo + fiado − lo que repones a Perú' : 'Vendido − lo que repones a Perú − gastos del día' }}</div>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-weight-bold">Cómo cuadra</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>{{ hasCash ? 'Efectivo de las ventas' : 'Cobrado al contado' }}</q-item-section><q-item-section side>{{ bs(cashSales) }}</q-item-section></q-item>
              <q-item><q-item-section class="text-negative">+ Fiado (por cobrar)</q-item-section><q-item-section side class="text-negative">{{ bs(d.sales.credit) }}</q-item-section></q-item>
              <q-item v-if="hasCash && d.expenses > 0"><q-item-section class="text-grey-8">+ Gastos que salieron del efectivo</q-item-section><q-item-section side>{{ bs(d.expenses) }}</q-item-section></q-item>
              <q-item class="text-weight-bold"><q-item-section>= Vendido del día</q-item-section><q-item-section side>{{ bs(sold) }}</q-item-section></q-item>
              <q-item><q-item-section>− A reponer a Perú</q-item-section><q-item-section side>{{ bs(t.costBs) }}</q-item-section></q-item>
              <q-item><q-item-section>− Gastos del día</q-item-section><q-item-section side>{{ bs(d.expenses) }}</q-item-section></q-item>
              <q-item class="text-weight-bold"><q-item-section>= Resultado</q-item-section><q-item-section side :class="result >= 0 ? 'text-positive' : 'text-negative'">{{ bs(result) }}</q-item-section></q-item>
            </q-list>
            <q-banner v-if="hasCash && Math.abs(diffRegistered) > 1" dense class="bg-orange-1 text-orange-10">
              Tus ventas anotadas suman {{ bs(d.sales.total) }}, pero el efectivo + fiado dicen {{ bs(sold) }} ({{ diffRegistered > 0 ? 'faltan anotar' : 'sobra anotado' }} {{ bs(Math.abs(diffRegistered)) }}).
            </q-banner>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-negative text-weight-bold">Fiado: con quién completa el cuadre</q-card-section>
            <q-list dense separator>
              <q-item v-for="c in d.credits" :key="c.id"><q-item-section>{{ c.customer }}<q-item-label caption>{{ arrobas(c.arrobas) }} {{ productName(c.product) }}</q-item-label></q-item-section><q-item-section side class="text-negative text-weight-bold">{{ bs(c.amount) }}</q-item-section></q-item>
              <q-item v-if="!d.credits.length"><q-item-section class="text-grey">Nadie se llevó fiado</q-item-section></q-item>
              <q-item v-if="d.credits.length" class="text-weight-bold"><q-item-section>Total fiado</q-item-section><q-item-section side class="text-negative">{{ bs(d.sales.credit) }}</q-item-section></q-item>
            </q-list>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-positive text-weight-bold">Deudas recogidas este día <span class="text-caption text-grey-7">(solo informativo; el dinero suma al Capital)</span></q-card-section>
            <q-list dense separator>
              <q-item v-for="c in d.collections" :key="c.customer"><q-item-section>{{ c.customer }}</q-item-section><q-item-section side class="text-positive text-weight-bold">{{ bs(c.amount) }}</q-item-section></q-item>
              <q-item v-if="!d.collections.length"><q-item-section class="text-grey">No se cobró ninguna deuda</q-item-section></q-item>
            </q-list>
          </q-card>

          <q-card flat bordered class="q-mb-md capital-card">
            <q-card-section class="text-subtitle1 text-weight-bold text-positive">Se suma al Capital</q-card-section>
            <q-list dense separator>
              <q-item><q-item-section>Efectivo de las ventas</q-item-section><q-item-section side>{{ bs(capSales) }}</q-item-section></q-item>
              <q-item><q-item-section>Deudas recogidas hoy (dinero físico)</q-item-section><q-item-section side>{{ bs(d.collected) }}</q-item-section></q-item>
              <q-item class="text-weight-bold"><q-item-section>= Entra al Capital</q-item-section><q-item-section side class="text-positive">{{ bs(capSales + d.collected) }}</q-item-section></q-item>
            </q-list>
            <q-banner dense class="bg-green-1 text-green-10">{{ d.closing && hasCash ? 'Ya está sumado al Capital.' : hasCash ? 'Se suma al Capital cuando guardes el cuadre.' : 'Sin efectivo contado se suman solo las ventas al contado anotadas. Pon el efectivo para sumar el dinero real.' }}</q-banner>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-weight-bold">Dinero en mano</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>{{ hasCash ? 'Efectivo contado' : 'Contado − gastos (lo recogido va a Capital)' }}</q-item-section><q-item-section side class="text-weight-bold">{{ bs(inHand) }}</q-item-section></q-item>
              <q-item><q-item-section>Solo con efectivo cubres lo que repones</q-item-section><q-item-section side :class="inHand >= t.costBs ? 'text-positive' : 'text-negative'">{{ t.costBs ? Math.round((inHand / t.costBs) * 100) + '%' : '—' }}</q-item-section></q-item>
              <q-item v-if="inHand < t.costBs"><q-item-section class="text-negative">Falta (lo cubre el fiado)</q-item-section><q-item-section side class="text-negative">{{ bs(t.costBs - inHand) }}</q-item-section></q-item>
            </q-list>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="text-subtitle1 text-weight-bold">Control de kilos</q-card-section>
            <q-list separator dense>
              <q-item><q-item-section>Cubetas vendidas</q-item-section><q-item-section side>{{ fmt(t.kg, 0) }} kg</q-item-section></q-item>
              <q-item><q-item-section>Arrobas anotadas × 11.5</q-item-section><q-item-section side>{{ fmt(d.sales.kgByArrobas, 0) }} kg</q-item-section></q-item>
              <q-item><q-item-section>Diferencia</q-item-section><q-item-section side :class="Math.abs(t.kg - d.sales.kgByArrobas) > 5 ? 'text-warning' : 'text-positive'">{{ fmt(t.kg - d.sales.kgByArrobas, 0) }} kg</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import api from '../api';
import { addDays, arrobas, bs, fmt, productName, sol, todayStr } from '../utils';

const $q = useQuasar();
const route = useRoute();
const date = ref(/^\d{4}-\d{2}-\d{2}$/.test(route.query.date || '') ? route.query.date : todayStr());
const d = ref(null);
const lines = ref([]);
const rate = ref(3.5);
const notes = ref('');
const cash = ref('');
const incl = ref(false);
const suppliers = ref([]);
const saving = ref(false);
const adding = ref(false);
const customers = ref([]);
const shown = ref([]);
const quick = [{ l: '¼', v: 0.25 }, { l: '½', v: 0.5 }, { l: '1', v: 1 }, { l: '2', v: 2 }, { l: '3', v: 3 }, { l: '4', v: 4 }];
const fiado = reactive({ name: null, product: 'NORMAL', arrobas: 1, total: null, paid: 0 });
const products = [{ label: 'Normal', value: 'NORMAL' }, { label: 'Retacos', value: 'RETACO' }];
let kgDefault = 35;

const blank = () => ({ supplierId: suppliers.value[0]?.id || null, product: 'NORMAL', bucketsSold: 0, kgPerBucket: kgDefault, pricePerKg: 0 });
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const t = computed(() => {
  const buckets = lines.value.reduce((a, l) => a + (Number(l.bucketsSold) || 0), 0);
  const kg = lines.value.reduce((a, l) => a + (Number(l.bucketsSold) || 0) * (Number(l.kgPerBucket) || 0), 0);
  const soles = r2(lines.value.reduce((a, l) => a + (Number(l.bucketsSold) || 0) * (Number(l.kgPerBucket) || 0) * (Number(l.pricePerKg) || 0), 0));
  return { buckets, kg, soles, costBs: r2(soles * (Number(rate.value) || 0)) };
});

// Misma fórmula que el servidor: con efectivo contado, ventas = efectivo − cobros antiguos + fiado + gastos
const hasCash = computed(() => cash.value !== '' && cash.value !== null && !isNaN(Number(cash.value)));
const cashSales = computed(() => (hasCash.value ? r2(Number(cash.value) - (incl.value ? d.value.collected : 0)) : d.value.sales.cash));
const sold = computed(() => (hasCash.value ? r2(cashSales.value + d.value.sales.credit + d.value.expenses) : d.value.sales.total));
const result = computed(() => r2(sold.value - t.value.costBs - d.value.expenses));
// Lo que este día entra al Capital: efectivo de ventas (ya sin gastos) + deudas recogidas
const capSales = computed(() => (hasCash.value ? cashSales.value : r2(d.value.sales.cash - d.value.expenses)));
const available = computed(() => r2(cashSales.value + d.value.sales.credit));
const diffRegistered = computed(() => r2(sold.value - d.value.sales.total));
const inHand = computed(() => (hasCash.value ? Number(cash.value) : r2(d.value.sales.cash - d.value.expenses)));

async function load() {
  d.value = (await api.get('/closings/day', { params: { date: date.value } })).data;
  const c = d.value.closing;
  if (c) {
    lines.value = c.lines.map((l) => ({ supplierId: l.supplierId, product: l.product, bucketsSold: l.bucketsSold, kgPerBucket: l.kgPerBucket, pricePerKg: l.pricePerKg }));
    rate.value = c.rate;
    notes.value = c.notes || '';
    cash.value = c.cashCounted ?? '';
    incl.value = c.cashIncludesCollections ?? true;
  } else {
    lines.value = d.value.arrivals.map((a) => ({ supplierId: a.supplierId, product: a.product, bucketsSold: a.buckets, kgPerBucket: a.kgPerBucket, pricePerKg: a.pricePerKg }));
    if (!lines.value.length) lines.value = [blank()];
    rate.value = d.value.suggestedRate;
    notes.value = '';
    cash.value = '';
    incl.value = false;
  }
}
// Actualiza solo los datos del día (ventas, fiados) sin borrar lo que estás escribiendo en el cuadre
async function refreshDay() { d.value = (await api.get('/closings/day', { params: { date: date.value } })).data; }
async function loadCustomers() { customers.value = (await api.get('/customers')).data; shown.value = customers.value; }
function filterCustomers(v, update) {
  update(() => { const n = v.toLowerCase(); shown.value = customers.value.filter((c) => c.name.toLowerCase().includes(n)); });
}
async function addFiado() {
  const total = Number(fiado.total) || 0;
  const paid = Number(fiado.paid) || 0;
  if (!fiado.name) return $q.notify({ type: 'warning', message: 'Escribe quién se lo llevó' });
  if (!(fiado.arrobas > 0)) return $q.notify({ type: 'warning', message: 'Pon las arrobas' });
  if (!(total > 0)) return $q.notify({ type: 'warning', message: 'Pon el total en Bs' });
  if (paid >= total) return $q.notify({ type: 'warning', message: 'Si pagó todo no es fiado: debe quedar debiendo algo' });
  adding.value = true;
  try {
    let customerId = fiado.name;
    if (typeof customerId === 'string') {
      const existing = customers.value.find((c) => c.name.toLowerCase() === customerId.trim().toLowerCase());
      customerId = existing ? existing.id : (await api.post('/customers', { name: customerId.trim() })).data.id;
    }
    await api.post('/sales', {
      date: date.value, product: fiado.product, arrobas: Number(fiado.arrobas), pricePerArroba: r2(total / fiado.arrobas), total,
      customerId, amountPaid: paid,
    });
    $q.notify({ type: 'positive', message: 'Fiado anotado' });
    Object.assign(fiado, { name: null, arrobas: 1, total: null, paid: 0 });
    await Promise.all([refreshDay(), loadCustomers()]);
  } catch {} finally { adding.value = false; }
}
function removeCredit(c) {
  $q.dialog({ title: 'Quitar fiado', message: `Se borrará la venta fiada de ${c.customer} (${bs(c.amount)}). ¿Seguro?`, cancel: true, persistent: true, ok: { label: 'Quitar', color: 'negative' } }).onOk(async () => {
    await api.delete(`/sales/${c.id}`);
    refreshDay();
  });
}
function shift(n) { date.value = addDays(date.value, n); load(); }
async function save() {
  if (lines.value.some((l) => !l.supplierId || !(l.pricePerKg > 0))) return $q.notify({ type: 'warning', message: 'Cada fila necesita proveedor y precio por kilo' });
  if (!(rate.value > 0)) return $q.notify({ type: 'warning', message: 'Pon el tipo de cambio del día' });
  saving.value = true;
  try {
    await api.put(`/closings/${date.value}`, {
      rate: Number(rate.value), notes: notes.value || undefined,
      cashCounted: hasCash.value ? Number(cash.value) : undefined, cashIncludesCollections: incl.value,
      lines: lines.value.map((l) => ({ supplierId: l.supplierId, product: l.product, bucketsSold: Number(l.bucketsSold) || 0, kgPerBucket: Number(l.kgPerBucket) || kgDefault, pricePerKg: Number(l.pricePerKg) || 0 })),
    });
    $q.notify({ type: 'positive', message: 'Cuadre guardado' });
    load();
  } catch {} finally { saving.value = false; }
}
function removeClosing() {
  $q.dialog({ title: 'Borrar cuadre', message: '¿Borrar el cuadre de este día?', cancel: true, persistent: true, ok: { label: 'Borrar', color: 'negative' } }).onOk(async () => {
    await api.delete(`/closings/${date.value}`);
    load();
  });
}
onMounted(async () => {
  suppliers.value = (await api.get('/suppliers')).data;
  kgDefault = (await api.get('/settings')).data.kgPerBucket;
  loadCustomers();
  load();
});
</script>

<style scoped>
.line { background: #f3f7f9; border: 1px solid #dbe5ea; }
.fiado-form { background: #fdf3f3; border: 1px dashed #e3a5a5; }
.cover { background: #f3f7f9; border: 1px dashed #9db4c0; }
</style>
