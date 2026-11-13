import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Quasar, Notify, Dialog, Loading } from 'quasar';
import langEs from 'quasar/lang/es';
import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';
import './style.css';
import App from './App.vue';
import router from './router';

createApp(App)
  .use(createPinia())
  .use(router)
  .use(Quasar, {
    plugins: { Notify, Dialog, Loading },
    lang: langEs,
    config: {
      brand: { primary: '#0f5e78', secondary: '#2a9d8f', accent: '#e76f51', positive: '#1f9d55', negative: '#c62828', warning: '#f2a007' },
      notify: { position: 'top', timeout: 3000 },
    },
  })
  .mount('#app');
