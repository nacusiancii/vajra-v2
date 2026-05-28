import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { CreateCustomerInput, UpdateCustomerInput } from '@domain/types'

const KEYS = {
  customers: ['customers'] as const,
  places: ['places'] as const
}

export function useCustomersQuery() {
  return useQuery({
    queryKey: KEYS.customers,
    queryFn: () => window.api.listCustomers()
  })
}

export function usePlacesQuery() {
  return useQuery({
    queryKey: KEYS.places,
    queryFn: () => window.api.listPlaces()
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => window.api.createCustomer(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.customers })
      qc.invalidateQueries({ queryKey: KEYS.places })
    }
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCustomerInput }) =>
      window.api.updateCustomer(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.customers })
      qc.invalidateQueries({ queryKey: KEYS.places })
    }
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.customers })
    }
  })
}
