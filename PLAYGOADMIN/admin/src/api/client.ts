import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/admin'

export const api = axios.create({ baseURL })

export const setAuthCredentials = (user: string, password: string) => {
  api.defaults.headers.common.Authorization = `Basic ${btoa(`${user}:${password}`)}`
  localStorage.setItem('admin_user', user)
  localStorage.setItem('admin_pass', password)
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // сбрасываем сохранённые креды и возвращаем на логин
      localStorage.removeItem('admin_user')
      localStorage.removeItem('admin_pass')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const uploadFile = async (file: File): Promise<string> => {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data.url as string
}
