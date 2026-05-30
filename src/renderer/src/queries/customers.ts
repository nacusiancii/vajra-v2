import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type { CreateCustomerInput, Customer, Place, UpdateCustomerInput } from '@domain/types'

const KEYS = {
  customers: ['customers'] as const,
  places: ['places'] as const
}

export function useCustomersQuery(): UseQueryReturnType<Customer[], Error> {
  return useQuery({
    queryKey: KEYS.customers,
    queryFn: () => window.api.listCustomers()
  })
}

export function usePlacesQuery(): UseQueryReturnType<Place[], Error> {
  return useQuery({
    queryKey: KEYS.places,
    queryFn: () => window.api.listPlaces()
  })
}

export function useCreateCustomer(): UseMutationReturnType<
  Customer,
  Error,
  CreateCustomerInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => window.api.createCustomer(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.customers })
      void qc.invalidateQueries({ queryKey: KEYS.places })
    }
  })
}

export function useUpdateCustomer(): UseMutationReturnType<
  Customer,
  Error,
  { id: number; input: UpdateCustomerInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCustomerInput }) =>
      window.api.updateCustomer(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.customers })
      void qc.invalidateQueries({ queryKey: KEYS.places })
    }
  })
}

export function useDeleteCustomer(): UseMutationReturnType<void, Error, number, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.deleteCustomer(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.customers })
    }
  })
}
