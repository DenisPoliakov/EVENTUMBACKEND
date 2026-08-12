import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CitiesPage from './pages/CitiesPage'
import StadiumsPage from './pages/StadiumsPage'
import MatchesPage from './pages/MatchesPage'
import TeamsPage from './pages/TeamsPage'
import RegistrationsPage from './pages/RegistrationsPage'
import UsersPage from './pages/UsersPage'
import NewsPage from './pages/NewsPage'
import ClubsPage from './pages/ClubsPage'
import CoachClubLinksPage from './pages/CoachClubLinksPage'
import SubscriptionPlansPage from './pages/SubscriptionPlansPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import CrmPage from './pages/CrmPage'
import LoginPage from './pages/LoginPage'
import WellnessStoriesPage from './pages/WellnessStoriesPage'
import WorkoutProgramsPage from './pages/WorkoutProgramsPage'
import BookingsPage from './pages/BookingsPage'
import OrdersPage from './pages/OrdersPage'
import PremiumPage from './pages/PremiumPage'
import PushCampaignsPage from './pages/PushCampaignsPage'
import SupportPage from './pages/SupportPage'
import WorkoutAnalyticsPage from './pages/WorkoutAnalyticsPage'
import { api, setAuthCredentials } from './api/client'
import './App.css'

function App() {
  const [isAuthed, setAuthed] = useState(() => {
    const savedUser = localStorage.getItem('admin_user')
    const savedPass = localStorage.getItem('admin_pass')
    if (!savedUser || !savedPass) return false
    setAuthCredentials(savedUser, savedPass)
    return true
  })
  const [error, setError] = useState<string | undefined>()

  const handleLogin = async (user: string, password: string) => {
    try {
      setAuthCredentials(user, password)
      // Проверяем на защищённом эндпоинте, чтобы отсеять неверные креды
      await api.get('/cities')
      setError(undefined)
      setAuthed(true)
    } catch {
      setError('Неверные учётные данные или сервер недоступен')
      setAuthed(false)
    }
  }

  if (!isAuthed) {
    return <LoginPage onLogin={handleLogin} error={error} />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/cities" element={<CitiesPage />} />
        <Route path="/stadiums" element={<StadiumsPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/registrations" element={<RegistrationsPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/wellness-stories" element={<WellnessStoriesPage />} />
        <Route path="/workout-programs" element={<WorkoutProgramsPage />} />
        <Route path="/workout-analytics" element={<WorkoutAnalyticsPage />} />
        <Route path="/push-campaigns" element={<PushCampaignsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/clubs" element={<ClubsPage />} />
        <Route path="/coach-club-links" element={<CoachClubLinksPage />} />
        <Route path="/subscription-plans" element={<SubscriptionPlansPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/" element={<Navigate to="/cities" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
