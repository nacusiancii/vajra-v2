import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { CreateProductInput, UpdateProductInput } from '@domain/types'

const KEYS = {
  products: ['products'] as const,
  productGroups: ['productGroups'] as const
}

export function useProductsQuery() {
  return useQuery({
    queryKey: KEYS.products,
    queryFn: () => window.api.listProducts()
  })
}

export function useProductGroupsQuery() {
  return useQuery({
    queryKey: KEYS.productGroups,
    queryFn: () => window.api.listProductGroups()
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => window.api.createProduct(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products })
      qc.invalidateQueries({ queryKey: KEYS.productGroups })
    }
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProductInput }) =>
      window.api.updateProduct(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products })
      qc.invalidateQueries({ queryKey: KEYS.productGroups })
    }
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products })
    }
  })
}
