<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menú" @click="drawer = !drawer" />
        <q-toolbar-title class="text-weight-bold">🐟 Truchas ViKI</q-toolbar-title>
        <q-btn flat no-caps icon="account_circle" :label="$q.screen.gt.xs ? auth.user?.name?.split(' ')[0] : ''">
          <q-menu>
            <q-list style="min-width: 200px">
              <q-item clickable v-close-popup @click="pwOpen = true"><q-item-section avatar><q-icon name="lock" /></q-item-section><q-item-section>Cambiar contraseña</q-item-section></q-item>
              <q-item clickable v-close-popup @click="logout"><q-item-section avatar><q-icon name="logout" /></q-item-section><q-item-section>Salir</q-item-section></q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above bordered :width="250">
      <q-list padding>
        <template v-for="m in menu" :key="m.to">
          <q-separator v-if="m.sep" class="q-my-sm" />
          <q-item clickable :to="m.to" exact active-class="text-primary bg-blue-1 text-weight-bold">
            <q-item-section avatar><q-icon :name="m.icon" /></q-item-section>
            <q-item-section>{{ m.label }}</q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-drawer>

    <q-page-container><router-view :key="$route.fullPath" /></q-page-container>

    <q-dialog v-model="pwOpen">
      <q-card style="width: 380px; max-width: 95vw">
        <q-card-section class="text-h6">Cambiar contraseña</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="pw.current" type="password" label="Contraseña actual" outlined dense />
          <q-input v-model="pw.next" type="password" label="Nueva contraseña (mínimo 6)" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn color="primary" unelevated label="Guardar" @click="changePw" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import api from '../api';
import { useAuth } from '../stores/auth';

const $q = useQuasar();
const auth = useAuth();
const router = useRouter();
const drawer = ref(false);
const pwOpen = ref(false);
const pw = reactive({ current: '', next: '' });
const menu = [
  { to: '/', icon: 'dashboard', label: 'Panel (deudas)' },
  { to: '/ventas', icon: 'request_page', label: 'Deudas (fiados)' },
  { to: '/recogidos', icon: 'price_check', label: 'Recogidos (cobrar)' },
  { to: '/cuadre', icon: 'fact_check', label: 'Cuadre del día' },
  { to: '/reportes', icon: 'assessment', label: 'Reportes por día' },
  { to: '/clientes', icon: 'groups', label: 'Deudores y clientes' },
  { to: '/llegadas', icon: 'local_shipping', label: 'Llegadas de Perú', sep: true },
  { to: '/proveedores', icon: 'badge', label: 'Proveedores' },
  { to: '/pagos-proveedores', icon: 'request_quote', label: 'Pagos a proveedores' },
  { to: '/cambio', icon: 'currency_exchange', label: 'Cambio Bs → Soles' },
  { to: '/gastos', icon: 'receipt_long', label: 'Gastos' },
  { to: '/capital', icon: 'savings', label: 'Capital' },
  { to: '/cierre', icon: 'balance', label: 'Cierre y ganancias', sep: true },
  { to: '/ajustes', icon: 'settings', label: 'Ajustes' },
];
async function changePw() {
  await api.post('/auth/password', pw);
  $q.notify({ type: 'positive', message: 'Contraseña actualizada' });
  pw.current = pw.next = '';
  pwOpen.value = false;
}
function logout() {
  auth.logout();
  router.push('/login');
}
</script>
