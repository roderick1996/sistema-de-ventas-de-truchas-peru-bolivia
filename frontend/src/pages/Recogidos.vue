<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="price_check" size="28px" color="positive" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Recogidos (cobrar deudas)</div></div>
      <q-space />
      <div class="col-auto text-right"><div class="text-caption text-grey-7">Por cobrar</div><div class="text-h6 text-negative text-weight-bold">{{ bs(totalDebt) }}</div></div>
      <div class="col-auto text-right q-ml-md"><div class="text-caption text-grey-7">Recogido hoy</div><div class="text-h6 text-positive text-weight-bold">{{ bs(todayTotal) }}</div></div>
    </div>

    <q-input v-model="q" outlined clearable autofocus bg-color="white" placeholder="Buscar por nombre…" input-class="text-h6" class="q-mb-md">
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-8">
        <div class="text-caption text-grey-8 q-mb-sm">{{ filtered.length }} persona(s) con deuda{{ q ? ' que coinciden con "' + q + '"' : '' }}</div>

        <q-card v-for="x in filtered" :key="x.customerId" flat bordered class="debtor q-mb-md" :class="{ overdue: x.overdue }">
          <q-card-section class="row items-center no-wrap">
            <q-avatar :color="x.overdue ? 'negative' : 'warning'" text-color="white" icon="person" class="q-mr-md" />
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">{{ x.name }}</div>
              <div class="text-caption text-grey-8">
                Debe desde el <b>{{ fdate(x.oldest) }}</b>
                <q-badge :color="x.overdue ? 'negative' : 'warning'" :text-color="x.overdue ? 'white' : 'black'" class="q-ml-xs">{{ daysLabel(x.days) }}</q-badge>
                <span v-if="x.phone" class="q-ml-sm"><q-icon name="call" size="14px" /> {{ x.phone }}</span>
              </div>
            </div>
            <div class="text-right q-ml-sm">
              <div class="text-h6 text-negative text-weight-bold">{{ bs(x.balance) }}</div>
              <q-btn dense unelevated color="positive" no-caps icon="payments" label="Cobrar" class="q-px-sm" @click="pay(x)" />
            </div>
          </q-card-section>
          <q-separator />
          <q-list dense separator>
            <q-item v-for="s in x.sales" :key="s.id">
              <q-item-section>
                <q-item-label class="text-capitalize">{{ dayName(s.date) }}</q-item-label>
                <q-item-label caption>{{ arrobas(s.arrobas) }} {{ productName(s.product) }} · valían {{ bs(s.total) }}<span v-if="s.paid > 0"> · ya pagó {{ bs(s.paid) }}</span></q-item-label>
              </q-item-section>
              <q-item-section side class="text-negative text-weight-bold">{{ bs(s.balance) }}</q-item-section>
              <q-item-section side><q-btn flat dense no-caps size="sm" color="positive" label="Cobrar esta" @click="payOne(s, x)" /></q-item-section>
            </q-item>
          </q-list>
        </q-card>

        <div v-if="!filtered.length && !loading" class="text-grey-7 q-pa-lg text-center">
          <q-icon :name="q ? 'search_off' : 'check_circle'" size="40px" :color="q ? 'grey' : 'positive'" />
          <div class="q-mt-sm">{{ q ? 'Nadie con ese nombre debe algo.' : 'Nadie te debe nada. Todo cobrado.' }}</div>
        </div>
      </div>

      <div class="col-12 col-md-4">
        <q-card flat bordered>
          <q-card-section class="text-subtitle1 text-positive text-weight-bold">Recogido hoy <span class="text-caption text-grey-7">(va a Capital)</span></q-card-section>
          <q-list dense separator>
            <q-item v-for="e in todayList" :key="e.key"><q-item-section>{{ e.who }}</q-item-section><q-item-section side class="text-positive text-weight-bold">{{ bs(e.amount) }}</q-item-section></q-item>
            <q-item v-if="!todayList.length"><q-item-section class="text-grey">Aún no recogiste nada hoy</q-item-section></q-item>
            <q-item v-if="todayList.length" class="text-weight-bold"><q-item-section>Total</q-item-section><q-item-section side class="text-positive">{{ bs(todayTotal) }}</q-item-section></q-item>
          </q-list>
          <q-card-actions><q-btn flat dense no-caps color="primary" icon="savings" label="Ver Capital" to="/capital" /></q-card-actions>
        </q-card>
      </div>
    </div>

    <PayDialog v-model="payOpen" :customer="sel" @saved="afterPay" />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import PayDialog from '../components/PayDialog.vue';
import { arrobas, bs, dayName, daysLabel, daysSince, fdate, productName, todayStr } from '../utils';

const $q = useQuasar();
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const q = ref('');
const sales = ref([]);
const todayList = ref([]);
const alertDays = ref(7);
const loading = ref(true);
const payOpen = ref(false);
const sel = ref(null);

const debtors = computed(() => {
  const m = new Map();
  for (const s of sales.value) {
    if (!s.customerId) continue;
    let g = m.get(s.customerId);
    if (!g) { g = { customerId: s.customerId, name: s.customer?.name || '(sin nombre)', phone: s.customer?.phone, balance: 0, oldest: s.date, sales: [] }; m.set(s.customerId, g); }
    g.balance = r2(g.balance + s.balance);
    if (s.date < g.oldest) g.oldest = s.date;
    g.sales.push(s);
  }
  return [...m.values()]
    .map((g) => ({ ...g, days: daysSince(g.oldest), overdue: daysSince(g.oldest) >= alertDays.value, sales: g.sales.sort((a, b) => (a.date < b.date ? -1 : 1)) }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.days - a.days || a.name.localeCompare(b.name));
});
const filtered = computed(() => {
  const n = norm(q.value);
  return n ? debtors.value.filter((d) => norm(d.name).includes(n) || (d.phone || '').includes(q.value)) : debtors.value;
});
const totalDebt = computed(() => r2(debtors.value.reduce((a, d) => a + d.balance, 0)));
const todayTotal = computed(() => r2(todayList.value.reduce((a, e) => a + e.amount, 0)));

async function load() {
  loading.value = true;
  try {
    const [s, c, st] = await Promise.all([
      api.get('/sales', { params: { pending: 'true' } }),
      api.get('/capital', { params: { from: todayStr(), to: todayStr() } }),
      api.get('/settings'),
    ]);
    sales.value = s.data;
    todayList.value = c.data.entries.filter((e) => e.kind === 'RECOGIDO');
    alertDays.value = st.data.debtAlertDays;
  } finally { loading.value = false; }
}
function pay(x) { sel.value = { id: x.customerId, name: x.name, debt: x.balance }; payOpen.value = true; }
function afterPay() { load(); }
function payOne(s, x) {
  $q.dialog({
    title: `Cobrar a ${x.name}`, message: `Deuda del ${fdate(s.date)}: ${bs(s.balance)}. ¿Cuánto pagó?`,
    prompt: { model: String(s.balance), type: 'number' }, cancel: true, ok: { label: 'Registrar cobro', color: 'positive' },
  }).onOk(async (v) => {
    const amount = Number(v);
    if (!(amount > 0)) return $q.notify({ type: 'warning', message: 'Pon un monto válido' });
    await api.post(`/sales/${s.id}/payments`, { amount, date: todayStr() });
    $q.notify({ type: 'positive', message: 'Cobro registrado' });
    load();
  });
}
onMounted(load);
</script>
