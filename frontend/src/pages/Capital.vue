<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="savings" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Capital</div></div>
      <q-space />
      <div class="col-auto"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="load" /></div>
    </div>

    <template v-if="d">
      <q-card flat class="q-pa-lg q-mb-md text-white" style="border-radius: 14px; background: linear-gradient(135deg, #0b6b5f, #1f9d55)">
        <div class="text-subtitle1">Capital: dinero en efectivo (bolivianos)</div>
        <div class="big-num q-my-sm">{{ bs(d.balance) }}</div>
        <div class="text-caption">Efectivo de las ventas de cada tarde + deudas recogidas + lo que agregues − cambios a soles − gastos − lo que uses.<span v-if="d.opening"> Incluye Bs {{ fmt(d.opening) }} de capital inicial.</span></div>
      </q-card>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Efectivo de ventas</div><div class="text-h6 text-weight-bold">{{ bs(d.salesCash) }}</div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Recogido de deudas</div><div class="text-h6 text-weight-bold text-positive">{{ bs(d.collected) }}</div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">Cambiado a soles + gastos</div><div class="text-h6 text-weight-bold text-negative">−{{ bs(Math.abs(d.exchanged + d.expenses)) }}</div></q-card></div>
        <div class="col-6 col-md-3"><q-card flat bordered class="q-pa-md"><div class="text-caption">A mano (agregado − usado)</div><div class="text-h6 text-weight-bold">{{ bs(d.manualIn - d.manualOut) }}</div></q-card></div>
      </div>

      <div class="row q-gutter-sm q-mb-md">
        <q-btn color="negative" unelevated no-caps icon="north_east" label="Usar capital" @click="openDlg('OUT')" />
        <q-btn outline color="primary" no-caps icon="add" label="Agregar capital" @click="openDlg('IN')" />
        <q-btn flat no-caps color="primary" icon="currency_exchange" label="Cambiar a soles" to="/cambio" />
        <q-space />
        <q-input v-model="filter" dense outlined clearable placeholder="Buscar nombre…" style="width: 220px"><template #prepend><q-icon name="search" /></template></q-input>
      </div>

      <q-table flat bordered :rows="d.entries" :columns="cols" row-key="key" :filter="filter" :pagination="{ rowsPerPage: 30 }" no-data-label="Sin movimientos en este periodo">
        <template #body-cell-kind="p">
          <q-td :props="p"><q-badge :color="color[p.row.kind]">{{ label[p.row.kind] }}</q-badge></q-td>
        </template>
        <template #body-cell-amount="p">
          <q-td :props="p" class="text-weight-bold" :class="p.row.amount < 0 ? 'text-negative' : 'text-positive'">{{ p.row.amount < 0 ? '−' : '+' }}{{ bs(Math.abs(p.row.amount)) }}</q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td auto-width><q-btn v-if="p.row.id" flat round dense icon="delete" color="negative" @click="remove(p.row)" /></q-td>
        </template>
      </q-table>
      <div class="text-subtitle1 text-weight-bold q-mt-sm text-right">Movimiento del periodo: {{ bs(d.periodTotal) }}</div>
    </template>

    <q-dialog v-model="dlg">
      <q-card style="width: 420px; max-width: 96vw">
        <q-card-section class="text-h6">{{ form.type === 'OUT' ? 'Usar capital' : 'Agregar capital' }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="form.date" type="date" label="Fecha" outlined dense />
          <q-input v-model.number="form.amount" type="number" min="0" label="Monto" prefix="Bs" outlined dense autofocus />
          <q-input v-model="form.description" label="Para qué (ej. retiro, prestamo)" outlined dense />
          <div v-if="form.type === 'OUT'" class="text-caption text-grey-8">Capital disponible: {{ bs(d?.balance) }}. Los cambios a soles y los gastos se descuentan solos: no los anotes aquí.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn :color="form.type === 'OUT' ? 'negative' : 'primary'" unelevated no-caps label="Guardar" :loading="saving" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import { addDays, bs, fdate, fmt, todayStr } from '../utils';

const $q = useQuasar();
const d = ref(null);
const from = ref(addDays(todayStr(), -30));
const to = ref(todayStr());
const filter = ref('');
const dlg = ref(false);
const saving = ref(false);
const form = reactive({ type: 'OUT', date: todayStr(), amount: null, description: '' });
const label = { VENTAS: 'Ventas (efectivo)', RECOGIDO: 'Recogido', GASTO: 'Gasto', CAMBIO: 'Cambio a soles', ENTRADA: 'Agregado', SALIDA: 'Usado' };
const color = { VENTAS: 'teal', RECOGIDO: 'positive', GASTO: 'orange', CAMBIO: 'orange', ENTRADA: 'primary', SALIDA: 'negative' };
const cols = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate, align: 'left', sortable: true },
  { name: 'kind', label: 'Tipo', field: 'kind', align: 'left' },
  { name: 'who', label: 'Persona / detalle', field: 'who', align: 'left' },
  { name: 'amount', label: 'Monto', field: 'amount', align: 'right', sortable: true },
  { name: 'actions', label: '', align: 'right' },
];

async function load() { d.value = (await api.get('/capital', { params: { from: from.value, to: to.value } })).data; }
function openDlg(type) { Object.assign(form, { type, date: todayStr(), amount: null, description: '' }); dlg.value = true; }
async function save() {
  if (!(form.amount > 0)) return $q.notify({ type: 'warning', message: 'Pon el monto' });
  saving.value = true;
  try {
    await api.post('/capital/movements', { date: form.date, type: form.type, amount: Number(form.amount), description: form.description || undefined });
    dlg.value = false;
    $q.notify({ type: 'positive', message: 'Guardado' });
    load();
  } catch {} finally { saving.value = false; }
}
function remove(r) {
  $q.dialog({ title: 'Eliminar movimiento', message: '¿Seguro?', cancel: true, persistent: true, ok: { label: 'Eliminar', color: 'negative' } }).onOk(async () => {
    await api.delete(`/capital/movements/${r.id}`);
    load();
  });
}
onMounted(load);
</script>
