<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => $emit('update:modelValue', v)" @show="init">
    <q-card style="width: 540px; max-width: 96vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ sale ? 'Editar venta' : 'Nueva venta' }}</div>
        <q-space /><q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-input v-model="f.date" type="date" label="Fecha" outlined dense />
        <q-btn-toggle v-model="f.product" spread no-caps unelevated toggle-color="primary" color="grey-3" text-color="grey-9"
          :options="[{ label: 'Trucha normal', value: 'NORMAL' }, { label: 'Retacos', value: 'RETACO' }]" @update:model-value="applyPrice" />

        <div>
          <div class="text-caption text-grey-8 q-mb-xs">Cantidad</div>
          <div class="row q-gutter-xs q-mb-sm">
            <q-btn v-for="q in quick" :key="q.v" no-caps dense class="q-px-md" :unelevated="f.arrobas === q.v" :outline="f.arrobas !== q.v" color="primary" :label="q.l" @click="setArrobas(q.v)" />
          </div>
          <q-input :model-value="f.arrobas" type="number" step="0.25" min="0" outlined dense suffix="arrobas" @update:model-value="(v) => setArrobas(Number(v))" />
        </div>

        <div class="row q-col-gutter-sm">
          <div class="col-6"><q-input :model-value="f.pricePerArroba" type="number" step="0.5" min="0" label="Precio por arroba" prefix="Bs" outlined dense @update:model-value="(v) => setPrice(Number(v))" /></div>
          <div class="col-6"><q-input :model-value="f.total" type="number" step="1" min="0" label="TOTAL (puedes escribirlo)" prefix="Bs" outlined dense input-class="text-weight-bold text-primary" @update:model-value="(v) => setTotal(Number(v))" /></div>
        </div>
        <div class="text-caption text-grey-7" style="margin-top: -6px">Ejemplo: 2 arrobas que valen 780 → escribe 2 y en TOTAL pon 780.</div>

        <q-toggle v-model="fiado" color="negative" label="Se lo lleva fiado (queda deuda)" @update:model-value="onFiado" />

        <q-select v-if="fiado || f.customerId" v-model="f.customerId" :options="shown" option-value="id" option-label="name" emit-value map-options
          use-input input-debounce="0" new-value-mode="add-unique" outlined dense label="¿Quién se lo lleva? (escribe el nombre)" hint="Si es nueva, escribe el nombre y presiona Enter" @filter="filterCustomers" />

        <q-input v-if="fiado" v-model.number="f.amountPaid" type="number" min="0" label="Pagó ahora (si dejó algo a cuenta)" prefix="Bs" outlined dense />
        <div v-if="debt > 0.004" class="text-negative text-subtitle1 text-weight-bold">Queda debiendo: {{ bs(debt) }}</div>
        <q-checkbox v-if="debt > 0.004" v-model="f.legacy" dense label="Es una deuda anterior (saldo inicial, no cuenta como venta ni utilidad)" />
        <q-input v-model="f.notes" label="Notas (opcional)" outlined dense />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancelar" v-close-popup />
        <q-btn color="primary" unelevated no-caps label="Guardar venta" :loading="saving" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import { bs, todayStr } from '../utils';

const props = defineProps({ modelValue: Boolean, sale: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue', 'saved']);
const $q = useQuasar();
const quick = [{ l: '¼', v: 0.25 }, { l: '½', v: 0.5 }, { l: '1', v: 1 }, { l: '2', v: 2 }, { l: '3', v: 3 }, { l: '4', v: 4 }];
const f = reactive({ date: todayStr(), product: 'NORMAL', arrobas: 1, pricePerArroba: 0, total: 0, customerId: null, amountPaid: 0, legacy: false, notes: '' });
const fiado = ref(false);
const saving = ref(false);
const customers = ref([]);
const shown = ref([]);
const cfg = ref({});

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const debt = computed(() => Math.max(0, f.total - (fiado.value ? Number(f.amountPaid) || 0 : f.total)));

function recalc() { f.total = r2((Number(f.arrobas) || 0) * (Number(f.pricePerArroba) || 0)); if (!fiado.value) f.amountPaid = f.total; }
function setArrobas(v) { f.arrobas = v; recalc(); }
function setPrice(v) { f.pricePerArroba = v; recalc(); }
function setTotal(v) {
  f.total = v || 0;
  if (f.arrobas > 0) f.pricePerArroba = r2(f.total / f.arrobas);
  if (!fiado.value) f.amountPaid = f.total;
}

async function loadCustomers() {
  customers.value = (await api.get('/customers')).data;
  shown.value = customers.value;
}
function filterCustomers(v, update) {
  update(() => { const n = v.toLowerCase(); shown.value = customers.value.filter((c) => c.name.toLowerCase().includes(n)); });
}
function applyPrice() {
  if (props.sale) return;
  f.pricePerArroba = Number(localStorage.getItem('tv_price_' + f.product)) || cfg.value[f.product === 'NORMAL' ? 'priceNormal' : 'priceRetaco'] || 0;
  recalc();
}
async function init() {
  cfg.value = (await api.get('/settings')).data;
  await loadCustomers();
  const s = props.sale;
  if (s) {
    Object.assign(f, { date: s.date, product: s.product, arrobas: s.arrobas, pricePerArroba: s.pricePerArroba, total: s.total, customerId: s.customerId || null, amountPaid: s.amountPaid, legacy: s.legacy, notes: s.notes || '' });
    fiado.value = s.total - s.amountPaid > 0.004;
  } else {
    Object.assign(f, { date: todayStr(), product: 'NORMAL', arrobas: 1, customerId: null, amountPaid: 0, legacy: false, notes: '' });
    fiado.value = false;
    applyPrice();
  }
}
function onFiado(v) { if (v && !props.sale) f.amountPaid = 0; if (!v) f.amountPaid = f.total; }

async function save() {
  if (!(f.arrobas > 0)) return $q.notify({ type: 'warning', message: 'Pon la cantidad de arrobas' });
  if (debt.value > 0.004 && !f.customerId) return $q.notify({ type: 'warning', message: 'Escribe quién se lo lleva fiado' });
  saving.value = true;
  try {
    let customerId = f.customerId || undefined;
    if (typeof customerId === 'string') {
      // nombre nuevo escrito a mano: se crea la persona al guardar
      const existing = customers.value.find((c) => c.name.toLowerCase() === customerId.trim().toLowerCase());
      customerId = existing ? existing.id : (await api.post('/customers', { name: customerId.trim() })).data.id;
    }
    const body = {
      date: f.date, product: f.product, arrobas: Number(f.arrobas), pricePerArroba: Number(f.pricePerArroba) || 0, total: Number(f.total) || 0,
      customerId, amountPaid: fiado.value ? Number(f.amountPaid) || 0 : Number(f.total) || 0,
      legacy: debt.value > 0.004 ? !!f.legacy : false, notes: f.notes || undefined,
    };
    if (props.sale) await api.put(`/sales/${props.sale.id}`, body);
    else await api.post('/sales', body);
    if (f.pricePerArroba) localStorage.setItem('tv_price_' + f.product, f.pricePerArroba);
    $q.notify({ type: 'positive', message: 'Venta guardada' });
    emit('saved');
    emit('update:modelValue', false);
  } catch {} finally { saving.value = false; }
}
</script>
