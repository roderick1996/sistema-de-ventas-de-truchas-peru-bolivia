<template>
  <div>
    <CrudPage ref="crud" title="Clientes" singular="cliente" icon="groups" endpoint="/customers" add-label="Nuevo cliente" :columns="columns" :fields="fields">
      <template #row-actions="{ row }">
        <q-btn v-if="row.debt > 0" flat dense no-caps color="positive" icon="payments" label="Cobrar" @click="pay(row)" />
      </template>
    </CrudPage>
    <PayDialog v-model="open" :customer="sel" @saved="crud.reload()" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import CrudPage from '../components/CrudPage.vue';
import PayDialog from '../components/PayDialog.vue';
import { bs } from '../utils';

const crud = ref(null);
const open = ref(false);
const sel = ref(null);
const columns = [
  { name: 'name', label: 'Nombre', field: 'name' },
  { name: 'phone', label: 'Teléfono', field: 'phone' },
  { name: 'debt', label: 'Debe', field: 'debt', format: (v) => (v > 0 ? bs(v) : '—'), align: 'right', classes: 'text-negative text-weight-bold' },
];
const fields = [
  { name: 'name', label: 'Nombre', required: true },
  { name: 'phone', label: 'Teléfono' },
  { name: 'notes', label: 'Notas' },
];
function pay(r) { sel.value = r; open.value = true; }
</script>
