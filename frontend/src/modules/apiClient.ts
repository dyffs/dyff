/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
import axios from 'axios'
import { toast } from 'vue-sonner'

const resolveBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3003/api`
  }
  return 'http://localhost:3003/api'
}

const apiClient = axios.create({
  baseURL: resolveBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dyff_app_auth')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error.response)
  }
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dyff_app_auth')
      window.location.href = '/login'
    }
    return Promise.reject(error.response)
  }
)

export default apiClient
