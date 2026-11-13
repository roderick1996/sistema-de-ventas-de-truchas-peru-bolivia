<template>
  <q-page padding>
    <!-- Encabezado y filtros -->
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap">
        <q-icon name="request_page" size="28px" color="negative" class="q-mr-sm" />
        <div class="text-h5 text-weight-bold">Deudas (fiados)</div>
      </div>
      <q-space />
      <div class="col-auto">
        <q-btn-toggle v-model="mode" no-caps unelevated toggle-color="primary" color="grey-3" text-color="grey-9"
          :options="[{ label: 'Hoy', value: 'today' }, { label: 'Semana', value: 'week' }, { label: 'Pendientes', value: 'pending' }]"
          @update:model-value="setMode" />
      </div>
      <template v-if="mode !== 'pending'">
        <div class="col-auto"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="custom" /></div>
        <div class="col-auto"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="custom" /></div>
      </template>
    </div>

    <!-- Anotar nueva deuda -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="q-pb-none">
        <div class="text-subtitle1 text-weight-bold">
          Anotar deuda <span class="text-grey-7 text-capitalize">· {{ dayName(f.date) }}</span>
        </div>
        <div class="text-caption text-grey-7">Ejemplo: María Mamani lleva 2 arrobas que valen Bs 780. Cada deuda anotada se suma al panel.</div>
      </q-card-section>
      <q-card-section class="q-gutter-y-sm">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-4 col-md-3"><q-input v-model="f.date" type="date" label="Fecha" outlined dense /></div>
          <div class="col-12 col-sm-8 col-md-5">
            <q-select v-model="f.name" :options="shown" option-value="id" option-label="name" emit-value map-options use-input input-debounce="0"
              new-value-mode="add-unique" outlined dense label="¿Quién se lo lleva? (escribe el nombre)"
              hint="Si es una persona nueva, escribe el nombre y presiona Enter" @filter="filterCustomers" />
          </div>
          <div class="col-12 col-md-4">
            <q-btn-toggle v-model="f.product" spread no-caps unelevated toggle-color="primary" color="grey-3" text-color="grey-9"
              :options="[{ label: 'Trucha normal', value: 'NORMAL' }, { label: 'Retacos', value: 'RETACO' }]" />
          </div>
        </div>
        <div class="row q-gutter-xs">
          <q-btn v-for="q in quick" :key="q.v" no-caps dense class="q-px-md" :unelevated="f.arrobas === q.v" :outline="f.arrobas !== q.v"
            color="primary" :label="q.l" @click="f.arrobas = q.v" />
        </div>
        <div class="row q-col-gutter-sm">
          <div class="col-4"><q-input v-model.number="f.arrobas" type="number" step="0.25" min="0" outlined dense label="Arrobas" /></div>
          <div class="col-4"><q-input v-model.number="f.total" type="number" min="0" outlined dense label="Valen (Bs)" prefix="Bs" /></div>
          <div class="col-4"><q-input v-model.number="f.paid" type="number" min="0" outlined dense label="Dejó a cuenta" prefix="Bs" /></div>
        </div>
        <div class="row items-center q-gutter-md">
          <q-btn color="negative" unelevated no-caps icon="person_add" label="Anotar deuda" :loading="adding" @click="add" />
          <div v-if="f.total > 0" class="text-negative text-subtitle1 text-weight-bold">Queda debiendo: {{ bs(Math.max(0, (f.total || 0) - (f.paid || 0))) }}</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Resumen -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Deudas anotadas</div><div class="text-h6 text-weight-bold">{{ rows.length }} · {{ bs(t.given) }}</div></q-card></div>
      <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Arrobas fiadas</div><div class="text-h6 text-weight-bold">{{ fmt(t.arrobas) }}</div></q-card></div>
      <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Ya cobrado</div><div class="text-h6 text-weight-bold text-positive">{{ bs(t.paid) }}</div></q-card></div>
      <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Por cobrar</div><div class="text-h6 text-weight-bold text-negative">{{ bs(t.balance) }}</div></q-card></div>
    </div>

    <!-- Lista -->
    <q-table flat bordered :rows="rows" :columns="cols" row-key="id" :loading="loading" :pagination="{ rowsPerPage: 30 }" no-data-label="No hay deudas en este periodo">
      <template #body-cell-balance="p">
        <q-td :props="p">
          <q-badge v-if="p.row.balance > 0.004" color="negative">{{ bs(p.row.balance) }}</q-badge>
          <q-icon v-else-if="p.row.writtenOffAmount > 0" name="block" color="grey" title="Incobrable" />
          <q-icon v-else name="check_circle" color="positive" title="Pagado" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td auto-width>
          <q-btn v-if="p.row.balance > 0.004" flat dense no-caps color="positive" icon="payments" label="Cobrar" @click="pay(p.row)" />
          <q-btn flat round dense icon="edit" @click="openEdit(p.row)" />
          <q-btn flat round dense icon="delete" color="negative" @click="remove(p.row)" />
        </q-td>
      </template>
    </q-table>

    <SaleDialog v-model="dlg" :sale="editing" @saved="load" />
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import SaleDialog from '../components/SaleDialog.vue';
import { arrobas, bs, dayName, fdate, fmt, productName, todayStr, weekRange } from '../utils';

const $q = useQuasar();
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const quick = [{ l: '¼', v: 0.25 }, { l: '½', v: 0.5 }, { l: '1', v: 1 }, { l: '2', v: 2 }, { l: '3', v: 3 }, { l: '4', v: 4 }];

const mode = ref('today');
const from = ref(todayStr());
const to = ref(todayStr());
const rows = ref([]);
const loading = ref(false);
const adding = ref(false);
const dlg = ref(false);
const editing = ref(null);
const customers = ref([]);
const shown = ref([]);
const f = reactive({ date: todayStr(), name: null, product: 'NORMAL', arrobas: 1, total: null, paid: 0 });

const cols = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate, align: 'left', sortable: true },
  { name: 'customer', label: 'Persona', field: (r) => r.customer?.name || '—', align: 'left', sortable: true },
  { name: 'product', label: 'Tipo', field: (r) => productName(r.product), align: 'left' },
  { name: 'qty', label: 'Cantidad', field: (r) => arrobas(r.arrobas), align: 'left' },
  { name: 'total', label: 'Valen', field: 'total', format: (v) => bs(v), align: 'right', sortable: true },
  { name: 'paid', label: 'Pagado', field: 'paid', format: (v) => bs(v), align: 'right' },
  { name: 'balance', label: 'Saldo', field: 'balance', align: 'center' },
  { name: 'actions', label: '', align: 'right' },
];
const t = computed(() => ({
  given: r2(rows.value.reduce((a, r) => a + (r.total - r.amountPaid), 0)),
  arrobas: rows.value.reduce((a, r) => a + r.arrobas, 0),
  paid: r2(rows.value.reduce((a, r) => a + r.collected, 0)),
  balance: r2(rows.value.reduce((a, r) => a + r.balance, 0)),
}));

async function load() {
  loading.value = true;
  try {
    const params = mode.value === 'pending' ? { pending: 'true' } : { from: from.value, to: to.value };
    const all = (await api.get('/sales', { params })).data;
    // solo se muestran las ventas que dejaron deuda (fiados)
    rows.value = mode.value === 'pending' ? all : all.filter((r) => r.total - r.amountPaid > 0.004);
  } finally { loading.value = false; }
}
function setMode(m) {
  if (m === 'today') { from.value = to.value = todayStr(); }
  if (m === 'week') ({ from: from.value, to: to.value } = weekRange(todayStr()));
  load();
}
function custom() { mode.value = 'custom'; load(); }

async function loadCustomers() { customers.value = (await api.get('/customers')).data; shown.value = customers.value; }
function filterCustomers(v, update) {
  update(() => { const n = v.toLowerCase(); shown.value = customers.value.filter((c) => c.name.toLowerCase().includes(n)); });
}

async function add() {
  const total = Number(f.total) || 0;
  const paid = Number(f.paid) || 0;
  if (!f.name) return $q.notify({ type: 'warning', message: 'Escribe quién se lo lleva' });
  if (!(f.arrobas > 0)) return $q.notify({ type: 'warning', message: 'Pon las arrobas' });
  if (!(total > 0)) return $q.notify({ type: 'warning', message: 'Pon cuánto valen (Bs)' });
  if (paid >= total) return $q.notify({ type: 'warning', message: 'Si pagó todo no es deuda: debe quedar debiendo algo' });
  adding.value = true;
  try {
    let customerId = f.name;
    if (typeof customerId === 'string') {
      const existing = customers.value.find((c) => c.name.toLowerCase() === customerId.trim().toLowerCase());
      customerId = existing ? existing.id : (await api.post('/customers', { name: customerId.trim() })).data.id;
    }
    await api.post('/sales', {
      date: f.date, product: f.product, arrobas: Number(f.arrobas), pricePerArroba: r2(total / f.arrobas), total, customerId, amountPaid: paid,
    });
    $q.notify({ type: 'positive', message: 'Deuda anotada' });
    Object.assign(f, { name: null, arrobas: 1, total: null, paid: 0 }); // queda listo para la siguiente persona
    if (mode.value !== 'pending') {
      if (f.date < from.value) from.value = f.date;
      if (f.date > to.value) to.value = f.date;
    }
    await Promise.all([load(), loadCustomers()]);
  } catch {} finally { adding.value = false; }
}

function pay(r) {
  $q.dialog({
    title: `Cobrar a ${r.customer?.name || ''}`, message: `Debe ${bs(r.balance)}. ¿Cuánto pagó?`,
    prompt: { model: String(r.balance), type: 'number' }, cancel: true, ok: { label: 'Registrar cobro', color: 'positive' },
  }).onOk(async (v) => {
    const amount = Number(v);
    if (!(amount > 0)) return $q.notify({ type: 'warning', message: 'Pon un monto válido' });
    await api.post(`/sales/${r.id}/payments`, { amount, date: todayStr() });
    $q.notify({ type: 'positive', message: 'Cobro registrado' });
    load();
  });
}
function openEdit(r) { editing.value = r; dlg.value = true; }
function remove(r) {
  $q.dialog({ title: 'Eliminar deuda', message: 'Se borrará la deuda y sus cobros. ¿Seguro?', cancel: true, persistent: true, ok: { label: 'Eliminar', color: 'negative' } }).onOk(async () => {
    await api.delete(`/sales/${r.id}`);
    load();
  });
}
onMounted(() => { load(); loadCustomers(); });
</script>
