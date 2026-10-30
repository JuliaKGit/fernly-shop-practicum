import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import type { Cart, Light, Order, Plant, PlantList, ShippingAddress, SizeLabel, Sort } from '../types';
import { apiFetch } from './client';

export interface PlantFilters {
  search: string;
  light: Light[];
  petSafe: boolean;
  sort: Sort;
  page: number;
}

function plantQueryString(filters: PlantFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.light.length) params.set('light', filters.light.join(','));
  if (filters.petSafe) params.set('petSafe', 'true');
  params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  return params.toString();
}

export function usePlants(filters: PlantFilters) {
  return useQuery({
    queryKey: ['plants', filters],
    queryFn: () => apiFetch<PlantList>(`/plants?${plantQueryString(filters)}`),
  });
}

export function useAllPlants() {
  return useQuery({
    queryKey: ['plants', 'all'],
    queryFn: () => apiFetch<PlantList>('/plants?pageSize=48'),
  });
}

export function usePlant(plantId: string) {
  return useQuery({
    queryKey: ['plant'],
    queryFn: () => apiFetch<Plant>(`/plants/${plantId}`),
  });
}

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cart'],
    queryFn: () => apiFetch<Cart>('/cart'),
    enabled: Boolean(user),
  });
}

function useCartMutation<TVariables>(request: (variables: TVariables) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => {
      queryClient.setQueryData(['cart'], cart);
    },
  });
}

export function useAddToCart() {
  return useCartMutation((line: { plantId: string; size: SizeLabel; quantity: number }) =>
    apiFetch<Cart>('/cart/lines', { method: 'POST', body: line }),
  );
}

export function useUpdateLine() {
  return useCartMutation(({ lineId, quantity }: { lineId: string; quantity: number }) =>
    apiFetch<Cart>(`/cart/lines/${lineId}`, { method: 'PATCH', body: { quantity } }),
  );
}

export function useRemoveLine() {
  return useCartMutation((lineId: string) => apiFetch<Cart>(`/cart/lines/${lineId}`, { method: 'DELETE' }));
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shippingAddress: ShippingAddress) => apiFetch<Order>('/orders', { method: 'POST', body: { shippingAddress } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: () => apiFetch<Order[]>('/orders') });
}

export function useOrder(orderId: string) {
  return useQuery({ queryKey: ['order', orderId], queryFn: () => apiFetch<Order>(`/orders/${orderId}`) });
}
