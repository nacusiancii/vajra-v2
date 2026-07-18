import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  // Window scroll is shared across routes; tall carts (Sale/Purchase) leave
  // scrollY mid-page so Home after finish/cancel can land in Recent/Masters.
  // Reset to top on push/replace; honor browser back/forward saved positions.
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/sale', name: 'sale', component: () => import('./views/Sale.vue') },
    { path: '/purchase', name: 'purchase', component: () => import('./views/Purchase.vue') },
    { path: '/receipt', name: 'receipt', component: () => import('./views/MoneyTxn.vue') },
    { path: '/payment', name: 'payment', component: () => import('./views/MoneyTxn.vue') },
    { path: '/expense', name: 'expense', component: () => import('./views/MoneyTxn.vue') },
    { path: '/income', name: 'income', component: () => import('./views/MoneyTxn.vue') },
    {
      path: '/stock-transfer',
      name: 'stock-transfer',
      component: () => import('./views/StockTransfer.vue')
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('./views/Transactions.vue')
    },
    {
      path: '/product-master',
      name: 'product-master',
      component: () => import('./views/ProductMaster.vue')
    },
    {
      path: '/customer-master',
      name: 'customer-master',
      component: () => import('./views/CustomerMaster.vue')
    },
    { path: '/inventory', name: 'inventory', component: () => import('./views/Inventory.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/Settings.vue') },
    { path: '/rollover', name: 'rollover', component: () => import('./views/Rollover.vue') }
  ]
})

export default router
