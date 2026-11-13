<template>
  <CrudPage title="Gastos" singular="gasto" icon="receipt_long" endpoint="/expenses" add-label="Nuevo gasto" date-filter sum-key="amount" sum-label="Total gastos (Bs)" :columns="columns" :fields="fields" />
</template>
<script setup>
import CrudPage from '../components/CrudPage.vue';
import { bs, fdate } from '../utils';
const columns = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate },
  { name: 'description', label: 'Descripción', field: 'description' },
  { name: 'amount', label: 'Monto', field: 'amount', format: bs, align: 'right' },
];
const fields = [
  { name: 'date', label: 'Fecha', type: 'date', required: true },
  { name: 'description', label: 'Descripción (transporte, hielo, bolsas...)', required: true },
  { name: 'amount', label: 'Monto (Bs)', type: 'number', step: '0.01', required: true },
];
</script>
