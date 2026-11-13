<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => $emit('update:modelValue', v)" @show="init">
    <q-card style="width: 460px; max-width: 96vw">
      <q-card-section class="row items-center">
        <div><div class="text-h6">Cobrar a {{ customer?.name }}</div><div class="text-negative text-weight-bold">Debe {{ bs(customer?.debt) }}</div></div>
        <q-space /><q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input v-model.number="amount" type="number" min="0" label="Monto que pagó" prefix="Bs" outlined autofocus>
          <template #append><q-btn flat dense no-caps label="Todo" color="primary" @click="amount = customer.debt" /></template>
        </q-input>
        <q-input v-model="date" type="date" label="Fecha" outlined dense />
        <div v-if="pending.length">
          <div class="text-caption text-grey-8">Se descuenta primero de la deuda más antigua</div>
          <q-list dense bordered separator class="rounded-borders q-mt-xs">
            <q-item v-for="s in pending" :key="s.id">
              <q-item-section>{{ fdate(s.date) }} · {{ arrobas(s.arrobas) }} {{ productName(s.product) }}</q-item-section>
              <q-item-section side class="text-negative text-weight-bold">{{ bs(s.balance) }}</q-item-section>
              <q-item-section side><q-btn flat dense no-caps size="sm" color="grey-7" label="Incobrable" @click="writeOff(s)" /></q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancelar" v-close-popup />
        <q-btn color="positive" unelevated no-caps icon="payments" label="Registrar cobro" :loading="saving" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';
import { arrobas, bs, fdate, productName, todayStr } from '../utils';

const props = defineProps({ modelValue: Boolean, customer: Object });
const emit = defineEmits(['update:modelValue', 'saved']);
const $q = useQuasar();
const amount = ref(0);
const date = ref(todayStr());
const pending = ref([]);
const saving = ref(false);

async function init() {
  amount.value = props.customer.debt;
  date.value = todayStr();
  pending.value = (await api.get('/sales', { params: { customerId: props.customer.id, pending: 'true' } })).data.reverse();
}
async function save() {
  if (!(amount.value > 0)) return $q.notify({ type: 'warning', message: 'Pon el monto cobrado' });
  saving.value = true;
  try {
    await api.post(`/customers/${props.customer.id}/pay`, { amount: Number(amount.value), date: date.value });
    $q.notify({ type: 'positive', message: 'Cobro registrado' });
    emit('saved');
    emit('update:modelValue', false);
  } catch {} finally { saving.value = false; }
}
function writeOff(s) {
  $q.dialog({ title: 'Marcar como incobrable', message: `Se dará por perdido ${bs(s.balance)}. Contará como pérdida.`, cancel: true, persistent: true }).onOk(async () => {
    await api.post(`/sales/${s.id}/write-off`);
    emit('saved');
    emit('update:modelValue', false);
  });
}
</script>
