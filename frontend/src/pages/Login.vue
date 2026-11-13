<template>
  <div class="login-bg flex flex-center">
    <q-card class="q-pa-md" style="width: 380px; max-width: 92vw">
      <q-card-section class="text-center">
        <div style="font-size: 54px">🐟</div>
        <div class="text-h5 text-weight-bold">Truchas ViKI</div>
        <div class="text-grey-7">Ingresa para ver tus deudas y ventas</div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input v-model="username" label="Usuario" outlined autofocus autocapitalize="none" @keyup.enter="go" />
        <q-input v-model="password" label="Contraseña" :type="show ? 'text' : 'password'" outlined @keyup.enter="go">
          <template #append><q-icon :name="show ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="show = !show" /></template>
        </q-input>
        <q-btn color="primary" unelevated size="lg" class="full-width" label="Ingresar" :loading="loading" @click="go" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

const auth = useAuth();
const router = useRouter();
const username = ref('');
const password = ref('');
const show = ref(false);
const loading = ref(false);
async function go() {
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push('/');
  } catch {} finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-bg { min-height: 100vh; background: linear-gradient(160deg, #0b4458 0%, #0f5e78 50%, #2a9d8f 100%); }
</style>
