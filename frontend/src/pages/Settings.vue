<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><q-icon name="settings" size="28px" color="primary" class="q-mr-sm" /><div class="text-h5 text-weight-bold">Ajustes</div></div>
    <q-card flat bordered style="max-width: 560px">
      <q-card-section class="q-gutter-md">
        <q-input v-model.number="f.kgPerArroba" type="number" step="0.1" label="Kilos por arroba" outlined dense hint="En Bolivia una arroba son 11.5 kg" />
        <q-input v-model.number="f.kgPerBucket" type="number" label="Kilos por cubeta (por defecto)" outlined dense />
        <q-input v-model.number="f.debtAlertDays" type="number" label="Alerta roja: días sin pagar" outlined dense hint="Si fiaste un sábado y cobras el siguiente, deja 7" />
        <q-input v-model.number="f.defaultRate" type="number" step="0.01" label="Tipo de cambio de referencia (Bs por sol)" outlined dense hint="Ejemplo: 3.50. Se usa mientras no registres cambios de moneda" />
        <q-input v-model.number="f.priceNormal" type="number" step="0.5" label="Precio sugerido por arroba — normal (Bs)" outlined dense />
        <q-input v-model.number="f.priceRetaco" type="number" step="0.5" label="Precio sugerido por arroba — retacos (Bs)" outlined dense />
        <q-input v-model.number="f.openingCashBs" type="number" label="Dinero en caja al empezar (Bs)" outlined dense />
        <q-input v-model.number="f.openingCashSoles" type="number" label="Dinero en caja al empezar (soles)" outlined dense />
      </q-card-section>
      <q-card-actions align="right"><q-btn color="primary" unelevated no-caps label="Guardar ajustes" :loading="saving" @click="save" /></q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import api from '../api';

const $q = useQuasar();
const f = ref({});
const saving = ref(false);
onMounted(async () => { f.value = (await api.get('/settings')).data; });
async function save() {
  saving.value = true;
  try {
    f.value = (await api.put('/settings', f.value)).data;
    $q.notify({ type: 'positive', message: 'Ajustes guardados' });
  } finally { saving.value = false; }
}
</script>
