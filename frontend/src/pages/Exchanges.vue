<template>
  <CrudPage title="Cambio de bolivianos a soles" singular="cambio" icon="currency_exchange" endpoint="/exchanges" add-label="Registrar cambio" date-filter :columns="columns" :fields="fields" />
</template>
<script setup>
import CrudPage from '../components/CrudPage.vue';
import { bs, fdate, fmt, sol } from '../utils';
const columns = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate },
  { name: 'bolivianos', label: 'Bolivianos entregados', field: 'bolivianos', format: bs, align: 'right' },
  { name: 'soles', label: 'Soles recibidos', field: 'soles', format: sol, align: 'right' },
  { name: 'rate', label: 'Bs por sol', field: (r) => (r.soles ? r.bolivianos / r.soles : 0), format: (v) => fmt(v, 3), align: 'right' },
  { name: 'notes', label: 'Notas', field: 'notes' },
];
const fields = [
  { name: 'date', label: 'Fecha', type: 'date', required: true },
  { name: 'bolivianos', label: 'Bolivianos que cambiaste', type: 'number', step: '0.01', required: true },
  { name: 'soles', label: 'Soles que recibiste', type: 'number', step: '0.01', required: true },
  { name: 'notes', label: 'Notas' },
];
</script>
