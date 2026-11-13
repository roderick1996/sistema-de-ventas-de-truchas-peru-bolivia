<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col-auto row items-center no-wrap"><q-icon :name="icon" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">{{ title }}</div></div>
      <q-space />
      <template v-if="dateFilter">
        <div class="col-auto"><q-input v-model="from" type="date" dense outlined label="Desde" style="width: 160px" @update:model-value="load" /></div>
        <div class="col-auto"><q-input v-model="to" type="date" dense outlined label="Hasta" style="width: 160px" @update:model-value="load" /></div>
      </template>
      <div class="col-auto"><q-btn color="primary" unelevated no-caps icon="add" :label="addLabel" @click="openNew" /></div>
    </div>

    <q-table flat bordered :rows="rows" :columns="allColumns" row-key="id" :loading="loading" :pagination="{ rowsPerPage: 25 }" no-data-label="Todavía no hay registros">
      <template #body-cell-actions="p">
        <q-td auto-width>
          <slot name="row-actions" :row="p.row" />
          <q-btn flat round dense icon="edit" @click="openEdit(p.row)" />
          <q-btn flat round dense icon="delete" color="negative" @click="remove(p.row)" />
        </q-td>
      </template>
    </q-table>
    <div v-if="sumKey" class="text-subtitle1 text-weight-bold q-mt-sm text-right">{{ sumLabel }}: {{ fmt(sum) }}</div>

    <q-dialog v-model="dlg">
      <q-card style="width: 460px; max-width: 96vw">
        <q-card-section class="text-h6">{{ editing ? 'Editar' : 'Nuevo' }}: {{ singular }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <template v-for="fl in fields" :key="fl.name">
            <q-select v-if="fl.type === 'select'" v-model="form[fl.name]" :options="opts[fl.name] || []" option-value="id" :option-label="fl.optionLabel || 'name'" emit-value map-options outlined dense :label="fl.label" />
            <q-input v-else v-model="form[fl.name]" :type="fl.type || 'text'" :step="fl.step" :prefix="fl.prefix" :label="fl.label" outlined dense />
          </template>
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
import { addDays, fmt, todayStr } from '../utils';

const props = defineProps({
  title: String, singular: String, icon: { type: String, default: 'list' }, endpoint: String,
  columns: Array, fields: Array, dateFilter: Boolean, sumKey: String, sumLabel: { type: String, default: 'Total' },
  addLabel: { type: String, default: 'Nuevo' },
});
const $q = useQuasar();
const rows = ref([]);
const loading = ref(false);
const saving = ref(false);
const dlg = ref(false);
const editing = ref(null);
const form = reactive({});
const opts = reactive({});
const from = ref(addDays(todayStr(), -60));
const to = ref(todayStr());

const allColumns = computed(() => [...props.columns.map((c) => ({ align: 'left', sortable: true, ...c })), { name: 'actions', label: '', align: 'right' }]);
const sum = computed(() => rows.value.reduce((a, r) => a + (Number(r[props.sumKey]) || 0), 0));

async function load() {
  loading.value = true;
  try {
    rows.value = (await api.get(props.endpoint, { params: props.dateFilter ? { from: from.value, to: to.value } : {} })).data;
  } finally { loading.value = false; }
}
onMounted(async () => {
  load();
  for (const fl of props.fields) if (fl.type === 'select') opts[fl.name] = (await api.get(fl.optionsUrl)).data;
});
function fill(src) {
  for (const fl of props.fields) {
    let v = src ? src[fl.name] : fl.type === 'date' ? todayStr() : fl.default ?? '';
    form[fl.name] = v ?? '';
  }
}
function openNew() { editing.value = null; fill(null); dlg.value = true; }
function openEdit(r) { editing.value = r; fill(r); dlg.value = true; }
async function save() {
  const body = {};
  for (const fl of props.fields) {
    const v = form[fl.name];
    if (fl.required && (v === '' || v === null || v === undefined)) return $q.notify({ type: 'warning', message: `Falta: ${fl.label}` });
    body[fl.name] = fl.type === 'number' || fl.type === 'select' ? (v === '' ? (fl.type === 'number' ? 0 : null) : Number(v)) : v;
  }
  saving.value = true;
  try {
    if (editing.value) await api.put(`${props.endpoint}/${editing.value.id}`, body);
    else await api.post(props.endpoint, body);
    dlg.value = false;
    $q.notify({ type: 'positive', message: 'Guardado' });
    load();
  } catch {} finally { saving.value = false; }
}
function remove(r) {
  $q.dialog({ title: 'Eliminar', message: '¿Seguro que quieres eliminar este registro?', cancel: true, persistent: true, ok: { label: 'Eliminar', color: 'negative' } }).onOk(async () => {
    await api.delete(`${props.endpoint}/${r.id}`);
    load();
  });
}
defineExpose({ reload: load });
</script>
