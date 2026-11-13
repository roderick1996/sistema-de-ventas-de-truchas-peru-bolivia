<template>
  <CrudPage title="Proveedores (Perú)" singular="proveedor" icon="badge" endpoint="/suppliers" add-label="Nuevo proveedor" :columns="columns" :fields="fields" />
</template>
<script setup>
import CrudPage from '../components/CrudPage.vue';
import { fmt, sol } from '../utils';
const columns = [
  { name: 'name', label: 'Proveedor', field: 'name' },
  { name: 'phone', label: 'Teléfono', field: 'phone' },
  { name: 'buckets', label: 'Cubetas recibidas', field: 'buckets', format: (v) => fmt(v, 1), align: 'right' },
  { name: 'purchased', label: 'Comprado', field: 'purchased', format: sol, align: 'right' },
  { name: 'paid', label: 'Pagado', field: 'paid', format: sol, align: 'right' },
  { name: 'debt', label: 'Les debemos', field: 'debt', format: sol, align: 'right', classes: 'text-negative text-weight-bold' },
];
const fields = [
  { name: 'name', label: 'Nombre', required: true },
  { name: 'phone', label: 'Teléfono' },
  { name: 'openingDebt', label: 'Deuda anterior al sistema (soles)', type: 'number', step: '0.01', default: 0 },
  { name: 'notes', label: 'Notas' },
];
</script>
