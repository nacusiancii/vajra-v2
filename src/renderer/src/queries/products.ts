import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type { CreateProductInput, Product, ProductGroup, UpdateProductInput } from '@domain/types'

const KEYS = {
  products: ['products'] as const,
  productGroups: ['productGroups'] as const
}

export function useProductsQuery(): UseQueryReturnType<Product[], Error> {
  return useQuery({
    queryKey: KEYS.products,
    queryFn: () => window.api.listProducts()
  })
}

export function useProductGroupsQuery(): UseQueryReturnType<ProductGroup[], Error> {
  return useQuery({
    queryKey: KEYS.productGroups,
    queryFn: () => window.api.listProductGroups()
  })
}

export function useCreateProduct(): UseMutationReturnType<
  Product,
  Error,
  CreateProductInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => window.api.createProduct(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.products })
      void qc.invalidateQueries({ queryKey: KEYS.productGroups })
    }
  })
}

export function useUpdateProduct(): UseMutationReturnType<
  Product,
  Error,
  { id: number; input: UpdateProductInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProductInput }) =>
      window.api.updateProduct(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.products })
      void qc.invalidateQueries({ queryKey: KEYS.productGroups })
    }
  })
}

export function useDeleteProduct(): UseMutationReturnType<void, Error, number, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const check = await window.api.canDeleteProduct(id)
      if (!check.canDelete) {
        throw new Error(check.reason ?? 'Cannot delete this product')
      }
      await window.api.deleteProduct(id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.products })
    }
  })
}
