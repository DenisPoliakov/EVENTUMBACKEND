import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  City,
  Stadium,
  Match,
  Team,
  MatchRegistration,
  NewsItem,
  Sport,
  SportClub,
  MembershipPlan,
  UserSubscription,
  CrmOverview,
  WellnessStory,
  WorkoutProgram,
  WorkoutStep,
  TrainingBooking,
  Order,
  PremiumAdminOverview,
  PushCampaign,
  PushTemplate,
  SupportTicket,
  WorkoutAnalytics,
} from '../types'
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

export const useNews = () =>
  useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: async () => (await api.get('/news')).data,
  })

export const useUploadNewsImage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return (
        await api.post(`/news/${id}/image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  })
}

export const useWellnessStories = () =>
  useQuery<WellnessStory[]>({
    queryKey: ['wellness-stories'],
    queryFn: async () =>
      (await api.get('/wellness-stories', { params: { locale: 'ru' } })).data,
  })

export const useUploadWellnessStoryCover = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return (
        await api.post(`/wellness-stories/${id}/cover`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['wellness-stories'] }),
  })
}

export const useWorkoutPrograms = () =>
  useQuery<WorkoutProgram[]>({
    queryKey: ['workout-programs'],
    queryFn: async () => (await api.get('/workout-programs')).data,
  })

export const useWorkoutSteps = (programId?: string | null) =>
  useQuery<WorkoutStep[]>({
    queryKey: ['workout-programs', programId, 'steps'],
    queryFn: async () =>
      (await api.get(`/workout-programs/${programId}/steps`)).data.steps,
    enabled: Boolean(programId),
  })

export const useUploadWorkoutStepIllustration = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      programId,
      stepId,
      file,
    }: {
      programId: string
      stepId: string
      file: File
    }) => {
      const form = new FormData()
      form.append('file', file)
      return (
        await api.post(
          `/workout-programs/${programId}/steps/${stepId}/illustration`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
      ).data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['workout-programs'] })
      qc.invalidateQueries({
        queryKey: ['workout-programs', variables.programId, 'steps'],
      })
    },
  })
}

export const useSports = () =>
  useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: async () => (await api.get('/sports')).data,
  })

export const useClubs = (filters: { sportId?: string; cityId?: string; age?: string; tier?: string }) =>
  useQuery<SportClub[]>({
    queryKey: ['clubs', filters],
    queryFn: async () => (await api.get('/clubs', { params: filters })).data,
  })

export const useSubscriptionPlans = (filters: { sportId?: string; clubId?: string; active?: string; tier?: string }) =>
  useQuery<MembershipPlan[]>({
    queryKey: ['subscription-plans', filters],
    queryFn: async () => (await api.get('/subscription-plans', { params: filters })).data,
  })

export const useSubscriptions = (filters: { sportId?: string; clubId?: string; userId?: string; status?: string }) =>
  useQuery<UserSubscription[]>({
    queryKey: ['subscriptions', filters],
    queryFn: async () => (await api.get('/subscriptions', { params: filters })).data,
  })

export const useBookings = (filters: { clubId?: string; userId?: string; status?: string }) =>
  useQuery<TrainingBooking[]>({
    queryKey: ['bookings', filters],
    queryFn: async () => (await api.get('/bookings', { params: filters })).data,
  })

export const useOrders = (filters: {
  clubId?: string
  userId?: string
  status?: string
  paymentStatus?: string
}) =>
  useQuery<Order[]>({
    queryKey: ['orders', filters],
    queryFn: async () => (await api.get('/orders', { params: filters })).data,
  })

export const usePremiumOverview = () =>
  useQuery<PremiumAdminOverview>({
    queryKey: ['premium'],
    queryFn: async () => (await api.get('/premium')).data,
  })

export const useWorkoutAnalytics = (filters: { from: string; to: string }) =>
  useQuery<WorkoutAnalytics>({
    queryKey: ['workout-analytics', filters],
    queryFn: async () => (await api.get('/workout-analytics', { params: filters })).data,
  })

export const usePushCampaigns = () =>
  useQuery<PushCampaign[]>({
    queryKey: ['push-campaigns'],
    queryFn: async () => (await api.get('/push-campaigns')).data.campaigns,
  })

export const usePushTemplates = () =>
  useQuery<PushTemplate[]>({
    queryKey: ['push-templates'],
    queryFn: async () => (await api.get('/push-campaigns/templates')).data.templates,
  })

export const useSupportTickets = (status?: string) =>
  useQuery<SupportTicket[]>({
    queryKey: ['support-tickets', status],
    queryFn: async () => (await api.get('/support', { params: { status } })).data.tickets,
  })

export const useSupportTicket = (id?: string | null) =>
  useQuery<SupportTicket>({
    queryKey: ['support-ticket', id],
    queryFn: async () => (await api.get(`/support/${id}`)).data,
    enabled: Boolean(id),
  })

export const useCrmOverview = (sportCode?: string) =>
  useQuery<CrmOverview>({
    queryKey: ['crm-overview', sportCode || 'ALL'],
    queryFn: async () => (await api.get('/crm/overview', { params: { sportCode } })).data,
  })

// Generic mutation helper to invalidate keys
/* eslint-disable @typescript-eslint/no-explicit-any */
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
/* eslint-enable @typescript-eslint/no-explicit-any */

export const useDeleteMutation = (urlBuilder: (id: string) => string, invalidate: (string | object)[]) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(urlBuilder(id))).data,
    onSuccess: () => invalidate.forEach((key) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })),
  })
}
