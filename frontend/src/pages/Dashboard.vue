<template>
  <q-page padding>
    <q-inner-loading :showing="loading && !d" />
    <template v-if="d">
      <!-- ALERTA -->
      <q-banner v-if="d.debtors.length" rounded class="bg-red-1 text-negative q-mb-md">
        <template #avatar><q-icon name="notification_important" color="negative" class="pulse" /></template>
        <b>{{ d.debtors.length }} cliente(s) no han pagado</b> — {{ bs(d.totalDebt) }} por cobrar.
        <span v-if="d.overdueCount"> <b>{{ d.overdueCount }} vencido(s)</b> (más de {{ d.alertDays }} días): {{ bs(d.overdueAmount) }}.</span>
      </q-banner>
      <q-banner v-else rounded class="bg-green-1 text-positive q-mb-md"><template #avatar><q-icon name="check_circle" color="positive" /></template>Nadie te debe nada. Todo cobrado.</q-banner>

      <q-banner v-if="missing.length" rounded class="bg-orange-1 text-orange-10 q-mb-md">
        <template #avatar><q-icon name="event_busy" color="warning" /></template>
        <b>Falta el cuadre de:</b>
        <q-btn v-for="m in missing" :key="m.date" dense flat no-caps color="orange-10" class="text-capitalize q-ml-xs" :label="dayName(m.date)" :to="`/cuadre?date=${m.date}`" />
      </q-banner>

      <!-- HÉROE: DEUDAS + RECOGIDOS -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <div class="debt-hero q-pa-lg full-height">
            <div class="text-subtitle1">Por cobrar (deudas)</div>
            <div class="big-num q-my-sm">{{ bs(d.totalDebt) }}</div>
            <div>{{ d.debtors.length }} deudor(es) · fiado hoy: <b>{{ bs(d.creditsTodayTotal) }}</b></div>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="q-pa-lg full-height rounded-borders bg-positive text-white" style="border-radius: 14px">
            <div class="text-subtitle1">Recogido hoy (cobros de deudas)</div>
            <div class="big-num q-my-sm">{{ bs(d.collectedTodayTotal) }}</div>
            <div>{{ d.collectedToday.length }} cliente(s) pagaron hoy</div>
          </div>
        </div>
      </div>

      <!-- BOTONES -->
      <div class="row q-gutter-sm q-mb-lg">
        <q-btn color="primary" unelevated no-caps icon="add_shopping_cart" label="Nueva venta / fiado" @click="saleOpen = true" />
        <q-btn color="positive" unelevated no-caps icon="price_check" label="Recogidos (cobrar)" to="/recogidos" />
        <q-btn outline color="primary" no-caps icon="local_shipping" label="Llegada de Perú" to="/llegadas" />
        <q-btn outline color="primary" no-caps icon="request_quote" label="Pagar proveedor" to="/pagos-proveedores" />
        <q-btn outline color="primary" no-caps icon="currency_exchange" label="Cambiar a soles" to="/cambio" />
        <q-btn outline color="primary" no-caps icon="receipt_long" label="Gasto" to="/gastos" />
        <q-btn outline color="primary" no-caps icon="balance" label="Cierre y ganancias" to="/cierre" />
      </div>

      <div class="row q-col-gutter-lg">
        <!-- DEUDORES -->
        <div class="col-12 col-md-8">
          <div class="text-h6 text-weight-bold q-mb-sm">Deudores</div>
          <q-card v-for="x in d.debtors" :key="x.customerId" flat bordered class="debtor q-mb-sm" :class="{ overdue: x.overdue }">
            <q-card-section class="row items-center no-wrap">
              <q-avatar :color="x.overdue ? 'negative' : 'warning'" text-color="white" icon="person" class="q-mr-md" />
              <div class="col">
                <div class="text-subtitle1 text-weight-bold">{{ x.name }}</div>
                <div class="text-caption text-grey-8">
                  Debe desde el <b>{{ fdate(x.oldestDate) }}</b>
                  <q-badge :color="x.overdue ? 'negative' : 'warning'" :text-color="x.overdue ? 'white' : 'black'" class="q-ml-xs">{{ daysLabel(x.daysOpen) }}</q-badge>
                  <span v-if="x.phone" class="q-ml-sm"><q-icon name="call" size="14px" /> {{ x.phone }}</span>
                </div>
                <div v-for="s in x.sales" :key="s.id" class="text-caption text-grey-7">{{ fdate(s.date) }} · {{ arrobas(s.arrobas) }} {{ productName(s.product) }} · {{ bs(s.balance) }}</div>
              </div>
              <div class="text-right q-ml-sm">
                <div class="text-h6 text-negative text-weight-bold">{{ bs(x.balance) }}</div>
                <q-btn dense unelevated color="positive" no-caps icon="payments" label="Cobrar" class="q-px-sm" @click="pay(x)" />
              </div>
            </q-card-section>
          </q-card>
          <div v-if="!d.debtors.length" class="text-grey-7 q-pa-md">Sin deudores.</div>
        </div>

        <!-- RECOGIDOS / FIADOS HOY -->
        <div class="col-12 col-md-4">
          <div class="text-h6 text-weight-bold q-mb-sm">Hoy</div>
          <q-card v-if="cuadre" flat bordered class="q-mb-md">
            <q-card-section class="row items-center no-wrap">
              <div class="text-subtitle1 text-weight-bold">Cuadre de hoy</div><q-space />
              <q-btn dense unelevated no-caps color="primary" :label="cuadre.closing ? 'Ver cuadre' : 'Hacer cuadre'" to="/cuadre" />
            </q-card-section>
            <q-list dense separator>
              <q-item><q-item-section>Vendido hoy<q-item-label caption>contado {{ bs(cuadre.fig.cashSales) }} · fiado {{ bs(cuadre.sales.credit) }}</q-item-label></q-item-section><q-item-section side class="text-weight-bold">{{ bs(cuadre.fig.sold) }}</q-item-section></q-item>
              <q-item><q-item-section>Recogido hoy (va a Capital)</q-item-section><q-item-section side class="text-positive text-weight-bold">{{ bs(cuadre.collected) }}</q-item-section></q-item>
              <template v-if="cuadre.calc">
                <q-item><q-item-section>A reponer a Perú<q-item-label caption>{{ fmt(cuadre.calc.bucketsSold, 1) }} cub · {{ sol(cuadre.calc.solesCost) }} × {{ fmt(cuadre.closing.rate, 2) }}</q-item-label></q-item-section><q-item-section side class="text-weight-bold">{{ bs(cuadre.calc.costBs) }}</q-item-section></q-item>
                <q-item class="text-weight-bold"><q-item-section>{{ dayResult >= 0 ? 'Ganancia del día' : 'Pérdida del día' }}</q-item-section><q-item-section side :class="dayResult >= 0 ? 'text-positive' : 'text-negative'">{{ bs(Math.abs(dayResult)) }}</q-item-section></q-item>
              </template>
              <q-item v-else><q-item-section class="text-grey-8">Anota las cubetas vendidas para ver si cuadra.</q-item-section></q-item>
            </q-list>
          </q-card>
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-positive text-weight-bold">Recogido</q-card-section>
            <q-list dense separator>
              <q-item v-for="c in d.collectedToday" :key="c.customer"><q-item-section>{{ c.customer }}</q-item-section><q-item-section side class="text-positive text-weight-bold">{{ bs(c.amount) }}</q-item-section></q-item>
              <q-item v-if="!d.collectedToday.length"><q-item-section class="text-grey">Aún no cobraste deudas hoy</q-item-section></q-item>
            </q-list>
          </q-card>
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="text-subtitle1 text-negative text-weight-bold">Fiado hoy</q-card-section>
            <q-list dense separator>
              <q-item v-for="c in d.creditsToday" :key="c.id"><q-item-section>{{ c.customer }}<q-item-label caption>{{ arrobas(c.arrobas) }} {{ productName(c.product) }}</q-item-label></q-item-section><q-item-section side class="text-negative text-weight-bold">{{ bs(c.amount) }}</q-item-section></q-item>
              <q-item v-if="!d.creditsToday.length"><q-item-section class="text-grey">No fiaste a nadie hoy</q-item-section></q-item>
            </q-list>
          </q-card>
          <q-card flat bordered>
            <q-list separator>
              <q-item><q-item-section>Arrobas hoy</q-item-section><q-item-section side class="text-weight-bold">{{ fmt(d.todayArrobas, 2) }}</q-item-section></q-item>
              <q-item><q-item-section>Capital (Bs en efectivo)</q-item-section><q-item-section side class="text-weight-bold">{{ bs(d.position.cashBs) }}</q-item-section></q-item>
              <q-item><q-item-section>Caja (soles)</q-item-section><q-item-section side class="text-weight-bold">{{ sol(d.position.cashSoles) }}</q-item-section></q-item>
              <q-item><q-item-section>Deuda con proveedores</q-item-section><q-item-section side class="text-weight-bold text-negative">{{ sol(d.supplierDebtSoles) }}</q-item-section></q-item>
              <q-item><q-item-section>Semana: {{ d.week.profit >= 0 ? 'ganancia' : 'pérdida' }}</q-item-section><q-item-section side class="text-weight-bold" :class="d.week.profit >= 0 ? 'text-positive' : 'text-negative'">{{ bs(Math.abs(d.week.profit)) }}</q-item-section></q-item>
            </q-list>
          </q-card>
        </div>
      </div>
    </template>

    <SaleDialog v-model="saleOpen" @saved="load" />
    <PayDialog v-model="payOpen" :customer="payCustomer" @saved="load" />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import SaleDialog from '../components/SaleDialog.vue';
import PayDialog from '../components/PayDialog.vue';
import { addDays, arrobas, bs, dayName, daysLabel, fdate, fmt, productName, sol, todayStr } from '../utils';

const $q = useQuasar();
const d = ref(null);
const loading = ref(true);
const saleOpen = ref(false);
const payOpen = ref(false);
const payCustomer = ref(null);
const cuadre = ref(null);
const missing = ref([]);
const dayResult = computed(() => (cuadre.value?.fig?.result ?? 0));
let notified = false;

async function load() {
  loading.value = true;
  try {
    d.value = (await api.get('/dashboard')).data;
    cuadre.value = (await api.get('/closings/day')).data;
    const rg = (await api.get('/closings/range', { params: { from: addDays(todayStr(), -14), to: addDays(todayStr(), -1) } })).data;
    missing.value = rg.days.filter((x) => x.missing);
    if (!notified && d.value.debtors.length) {
      notified = true;
      $q.notify({
        type: 'negative', icon: 'notification_important', timeout: 6000,
        message: `${d.value.debtors.length} cliente(s) te deben ${bs(d.value.totalDebt)}` + (d.value.overdueCount ? ` · ${d.value.overdueCount} vencido(s)` : ''),
      });
    }
  } finally { loading.value = false; }
}
function pay(x) {
  payCustomer.value = { id: x.customerId, name: x.name, debt: x.balance };
  payOpen.value = true;
}
onMounted(load);
</script>
