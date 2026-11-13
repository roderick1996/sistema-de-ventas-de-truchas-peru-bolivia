<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon name="local_shipping" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Llegadas de Perú</div></div>
      <q-space />
      <div class="col-auto"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="load" /></div>
      <div class="col-auto"><q-btn color="primary" unelevated no-caps icon="add" label="Registrar llegada" @click="openNew" /></div>
    </div>

    <q-table flat bordered :rows="rows" :columns="cols" row-key="id" :loading="loading" :pagination="{ rowsPerPage: 25 }" no-data-label="No hay llegadas en este periodo">
      <template #body-cell-actions="p">
        <q-td auto-width>
          <q-btn flat round dense icon="edit" @click="openEdit(p.row)" />
          <q-btn flat round dense icon="delete" color="negative" @click="remove(p.row)" />
        </q-td>
      </template>
    </q-table>
    <div class="text-subtitle1 text-weight-bold q-mt-sm text-right">Total comprado: {{ sol(rows.reduce((a, r) => a + r.totalSoles, 0)) }}</div>

    <q-dialog v-model="dlg">
      <q-card style="width: 620px; max-width: 96vw">
        <q-card-section class="text-h6">{{ editing ? 'Editar llegada' : 'Nueva llegada de Perú' }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-5"><q-input v-model="form.date" type="date" label="Fecha" outlined dense /></div>
            <div class="col-12 col-sm-7"><q-select v-model="form.supplierId" :options="suppliers" option-value="id" option-label="name" emit-value map-options outlined dense label="Proveedor" /></div>
          </div>
          <div class="text-subtitle2">Lo que mandó (cubetas × kilos × precio por kilo)</div>
          <div v-for="(it, i) in form.items" :key="i" class="row q-col-gutter-xs items-center">
            <div class="col-12 col-sm-3"><q-select v-model="it.product" :options="products" emit-value map-options outlined dense label="Tipo" /></div>
            <div class="col-4 col-sm-2"><q-input v-model.number="it.buckets" type="number" step="0.5" min="0" outlined dense label="Cubetas" /></div>
            <div class="col-4 col-sm-2"><q-input v-model.number="it.kgPerBucket" type="number" min="0" outlined dense label="Kg/cub." /></div>
            <div class="col-4 col-sm-2"><q-input v-model.number="it.pricePerKg" type="number" step="0.5" min="0" outlined dense label="S/ por kilo" /></div>
            <div class="col-12 col-sm-3 row items-center justify-end"><span class="text-caption text-grey-8 q-mr-xs">{{ fmt((it.buckets || 0) * (it.kgPerBucket || 0), 0) }} kg = {{ sol((it.buckets || 0) * (it.kgPerBucket || 0) * (it.pricePerKg || 0)) }}</span><q-btn flat round dense icon="close" color="negative" :disable="form.items.length === 1" @click="form.items.splice(i, 1)" /></div>
          </div>
          <q-btn flat no-caps color="primary" icon="add" label="Agregar otro tipo" @click="addItem" />
          <q-input v-model="form.notes" label="Notas" outlined dense />
          <div class="text-h6 text-primary">{{ fmt(totalBuckets, 1) }} cubetas · {{ fmt(totalKg, 0) }} kg · Total {{ sol(total) }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn color="primary" unelevated no-caps label="Guardar" :loading="saving" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import { addDays, fdate, fmt, sol, todayStr } from '../utils';

const $q = useQuasar();
const rows = ref([]);
const suppliers = ref([]);
const loading = ref(false);
const saving = ref(false);
const dlg = ref(false);
const editing = ref(null);
const from = ref(addDays(todayStr(), -60));
const to = ref(todayStr());
const kgDefault = ref(35);
const products = [{ label: 'Normal', value: 'NORMAL' }, { label: 'Retacos', value: 'RETACO' }];
const form = reactive({ date: todayStr(), supplierId: null, notes: '', items: [] });

const cols = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate, align: 'left', sortable: true },
  { name: 'supplier', label: 'Proveedor', field: (r) => r.supplier?.name, align: 'left' },
  { name: 'detail', label: 'Detalle', field: (r) => r.items.map((i) => `${fmt(i.buckets, 1)} cub. ${i.product === 'NORMAL' ? 'normal' : 'retaco'} × ${fmt(i.kgPerBucket, 0)} kg × S/${fmt(i.pricePerKg)}`).join(' | '), align: 'left' },
  { name: 'kg', label: 'Kg', field: 'totalKg', format: (v) => fmt(v, 0), align: 'right' },
  { name: 'total', label: 'Total', field: 'totalSoles', format: sol, align: 'right', sortable: true },
  { name: 'actions', label: '', align: 'right' },
];
const totalBuckets = computed(() => form.items.reduce((a, i) => a + (Number(i.buckets) || 0), 0));
const totalKg = computed(() => form.items.reduce((a, i) => a + (Number(i.buckets) || 0) * (Number(i.kgPerBucket) || 0), 0));
const total = computed(() => form.items.reduce((a, i) => a + (Number(i.buckets) || 0) * (Number(i.kgPerBucket) || 0) * (Number(i.pricePerKg) || 0), 0));

const blank = (product = 'NORMAL') => ({ product, buckets: 1, kgPerBucket: kgDefault.value, pricePerKg: 0 });
function addItem() { form.items.push(blank(form.items.some((i) => i.product === 'NORMAL') ? 'RETACO' : 'NORMAL')); }
async function load() {
  loading.value = true;
  try { rows.value = (await api.get('/shipments', { params: { from: from.value, to: to.value } })).data; } finally { loading.value = false; }
}
function openNew() {
  editing.value = null;
  Object.assign(form, { date: todayStr(), supplierId: suppliers.value[0]?.id || null, notes: '', items: [blank()] });
  dlg.value = true;
}
function openEdit(r) {
  editing.value = r;
  Object.assign(form, { date: r.date, supplierId: r.supplierId, notes: r.notes || '', items: r.items.map((i) => ({ product: i.product, buckets: i.buckets, kgPerBucket: i.kgPerBucket, pricePerKg: i.pricePerKg })) });
  dlg.value = true;
}
async function save() {
  if (!form.supplierId) return $q.notify({ type: 'warning', message: 'Elige el proveedor' });
  if (form.items.some((i) => !(i.buckets > 0))) return $q.notify({ type: 'warning', message: 'Pon las cubetas de cada fila' });
  saving.value = true;
  const body = { date: form.date, supplierId: form.supplierId, notes: form.notes || undefined, items: form.items.map((i) => ({ product: i.product, buckets: Number(i.buckets), kgPerBucket: Number(i.kgPerBucket) || undefined, pricePerKg: Number(i.pricePerKg) || 0 })) };
  try {
    if (editing.value) await api.put(`/shipments/${editing.value.id}`, body);
    else await api.post('/shipments', body);
    dlg.value = false;
    $q.notify({ type: 'positive', message: 'Llegada guardada' });
    load();
  } catch {} finally { saving.value = false; }
}
function remove(r) {
  $q.dialog({ title: 'Eliminar llegada', message: '¿Seguro que quieres eliminarla?', cancel: true, persistent: true, ok: { label: 'Eliminar', color: 'negative' } }).onOk(async () => {
    await api.delete(`/shipments/${r.id}`);
    load();
  });
}
onMounted(async () => {
  suppliers.value = (await api.get('/suppliers')).data;
  kgDefault.value = (await api.get('/settings')).data.kgPerBucket;
  load();
});
</script>
