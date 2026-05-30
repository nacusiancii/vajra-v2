import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Product } from '@domain/types'

export type SortField = 'name' | 'updatedAt'
export type TranslationFilter = 'all' | 'missing'

export const useProductMasterStore = defineStore('productMaster', () => {
  const search = ref('')
  const groupFilter = ref<string[]>([])
  const translationFilter = ref<TranslationFilter>('all')
  const sortField = ref<SortField>('name')

  const dialogOpen = ref(false)
  const editingProduct = ref<Product | null>(null)

  function openCreateDialog(): void {
    editingProduct.value = null
    dialogOpen.value = true
  }

  function openEditDialog(product: Product): void {
    editingProduct.value = product
    dialogOpen.value = true
  }

  function closeDialog(): void {
    dialogOpen.value = false
    editingProduct.value = null
  }

  function resetFilters(): void {
    search.value = ''
    groupFilter.value = []
    translationFilter.value = 'all'
  }

  return {
    search,
    groupFilter,
    translationFilter,
    sortField,
    dialogOpen,
    editingProduct,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    resetFilters
  }
})
