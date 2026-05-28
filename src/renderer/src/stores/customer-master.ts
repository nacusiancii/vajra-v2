import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Customer } from '@domain/types'

export type SortField = 'name' | 'updatedAt'
export type TranslationFilter = 'all' | 'missing'

export const useCustomerMasterStore = defineStore('customerMaster', () => {
  const search = ref('')
  const placeFilter = ref<string[]>([])
  const translationFilter = ref<TranslationFilter>('all')
  const sortField = ref<SortField>('name')

  const dialogOpen = ref(false)
  const editingCustomer = ref<Customer | null>(null)

  function openCreateDialog() {
    editingCustomer.value = null
    dialogOpen.value = true
  }

  function openEditDialog(customer: Customer) {
    editingCustomer.value = customer
    dialogOpen.value = true
  }

  function closeDialog() {
    dialogOpen.value = false
    editingCustomer.value = null
  }

  function resetFilters() {
    search.value = ''
    placeFilter.value = []
    translationFilter.value = 'all'
  }

  return {
    search,
    placeFilter,
    translationFilter,
    sortField,
    dialogOpen,
    editingCustomer,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    resetFilters
  }
})
