import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from './components/MainLayout.vue';

const routes = [
  { path: '/login', component: () => import('./pages/Login.vue') },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', component: () => import('./pages/Dashboard.vue') },
      { path: 'ventas', component: () => import('./pages/Sales.vue') },
      { path: 'recogidos', component: () => import('./pages/Recogidos.vue') },
      { path: 'capital', component: () => import('./pages/Capital.vue') },
      { path: 'cuadre', component: () => import('./pages/DayClosing.vue') },
      { path: 'reportes', component: () => import('./pages/Reports.vue') },
      { path: 'clientes', component: () => import('./pages/Customers.vue') },
      { path: 'llegadas', component: () => import('./pages/Shipments.vue') },
      { path: 'proveedores', component: () => import('./pages/Suppliers.vue') },
      { path: 'pagos-proveedores', component: () => import('./pages/SupplierPayments.vue') },
      { path: 'cambio', component: () => import('./pages/Exchanges.vue') },
      { path: 'gastos', component: () => import('./pages/Expenses.vue') },
      { path: 'cierre', component: () => import('./pages/Closing.vue') },
      { path: 'ajustes', component: () => import('./pages/Settings.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) => {
  const logged = !!localStorage.getItem('tv_token');
  if (!logged && to.path !== '/login') return '/login';
  if (logged && to.path === '/login') return '/';
});
export default router;
