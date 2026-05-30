import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/sale', name: 'sale', component: () => import('./views/SalePlaceholder.vue') },
    {
      path: '/purchase',
      name: 'purchase',
      component: () => import('./views/PurchasePlaceholder.vue')
    },
    {
      path: '/receipt',
      name: 'receipt',
      component: () => import('./views/ReceiptPlaceholder.vue')
    },
    {
      path: '/payment',
      name: 'payment',
      component: () => import('./views/PaymentPlaceholder.vue')
    },
    {
      path: '/expense',
      name: 'expense',
      component: () => import('./views/ExpensePlaceholder.vue')
    },
    { path: '/income', name: 'income', component: () => import('./views/IncomePlaceholder.vue') },
    {
      path: '/stock-transfer',
      name: 'stock-transfer',
      component: () => import('./views/StockTransferPlaceholder.vue')
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('./views/TransactionsPlaceholder.vue')
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
    {
      path: '/inventory',
      name: 'inventory',
      component: () => import('./views/InventoryPlaceholder.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsPlaceholder.vue')
    },
    {
      path: '/rollover',
      name: 'rollover',
      component: () => import('./views/RolloverPlaceholder.vue')
    }
  ]
})

export default router
