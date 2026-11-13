<template>
  <CrudPage title="Pagos a proveedores" singular="pago" icon="request_quote" endpoint="/supplier-payments" add-label="Registrar pago" date-filter sum-key="soles" sum-label="Total pagado (soles)" :columns="columns" :fields="fields" />
</template>
<script setup>
import CrudPage from '../components/CrudPage.vue';
import { fdate, sol } from '../utils';
const columns = [
  { name: 'date', label: 'Fecha', field: 'date', format: fdate },
  { name: 'supplier', label: 'Proveedor', field: (r) => r.supplier?.name },
  { name: 'soles', label: 'Pagado', field: 'soles', format: sol, align: 'right' },
  { name: 'notes', label: 'Notas', field: 'notes' },
];
const fields = [
  { name: 'date', label: 'Fecha', type: 'date', required: true },
  { name: 'supplierId', label: 'Proveedor', type: 'select', optionsUrl: '/suppliers', required: true },
  { name: 'soles', label: 'Monto pagado (soles)', type: 'number', step: '0.01', required: true },
  { name: 'notes', label: 'Notas' },
];
</script>
