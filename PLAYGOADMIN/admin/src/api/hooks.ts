import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { City, Stadium, Match, Team, MatchRegistration } from '../types'
import type { User } from '../types'

export const useCities = () =>
  useQuery<City[]>({ queryKey: ['cities'], queryFn: async () => (await api.get('/cities')).data })

export const useStadiums = (cityId?: string) =>
  useQuery<Stadium[]>({
    queryKey: ['stadiums', cityId],
    queryFn: async () => (await api.get('/stadiums', { params: { cityId } })).data,
  })

export const useMatches = (filters: { cityId?: string; stadiumId?: string; status?: string }) =>
  useQuery<Match[]>({
    queryKey: ['matches', filters],
    queryFn: async () => (await api.get('/matches', { params: filters })).data,
  })

export const useTeams = (cityId?: string) =>
  useQuery<Team[]>({
    queryKey: ['teams', cityId],
    queryFn: async () => (await api.get('/teams', { params: { cityId } })).data,
  })

export const useRegistrations = (matchId?: string) =>
  useQuery<MatchRegistration[]>({
    queryKey: ['registrations', matchId],
    queryFn: async () => (await api.get('/registrations', { params: { matchId } })).data,
  })

export const useUsers = (filters: { cityId?: string; role?: string; q?: string; blocked?: string }) =>
  useQuery<User[]>({
    queryKey: ['users', filters],
    queryFn: async () => (await api.get('/users', { params: filters })).data,
  })

// Generic mutation helper to invalidate keys
export const usePostMutation = (url: string, invalidate: (string | object)[]) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => (await api.post(url, payload)).data,
    onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })),
  })
}

export const usePutMutation = (urlBuilder: (payload: any) => string, invalidate: (string | object)[]) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => (await api.put(urlBuilder(payload), payload)).data,
    onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })),
  })
}

export const usePatchMutation = (urlBuilder: (payload: any) => string, invalidate: (string | object)[]) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => (await api.patch(urlBuilder(payload), payload)).data,
    onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })),
  })
}

export const useDeleteMutation = (urlBuilder: (id: string) => string, invalidate: (string | object)[]) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(urlBuilder(id))).data,
    onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })),
  })
}
