import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CitiesPage from './pages/CitiesPage'
import StadiumsPage from './pages/StadiumsPage'
import MatchesPage from './pages/MatchesPage'
import TeamsPage from './pages/TeamsPage'
import RegistrationsPage from './pages/RegistrationsPage'
import UsersPage from './pages/UsersPage'
import NewsPage from './pages/NewsPage'
import LoginPage from './pages/LoginPage'
import { api, setAuthCredentials } from './api/client'
import './App.css'

function App() {
  const [isAuthed, setAuthed] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // пробуем взять логин из localStorage при загрузке
  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user')
    const savedPass = localStorage.getItem('admin_pass')
    if (savedUser && savedPass) {
      setAuthCredentials(savedUser, savedPass)
      setAuthed(true)
    }
  }, [])

  const handleLogin = async (user: string, password: string) => {
    try {
      setAuthCredentials(user, password)
      // Проверяем на защищённом эндпоинте, чтобы отсеять неверные креды
      await api.get('/cities')
      setError(undefined)
      setAuthed(true)
    } catch (e) {
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
        <Route path="/" element={<Navigate to="/cities" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
