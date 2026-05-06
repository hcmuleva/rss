import axios, { AxiosHeaders } from 'axios'
import { authStorage } from '@/utils/authStorage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3300/api'

export const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
})

axiosClient.interceptors.request.use(async (config) => {
  const token = await authStorage.getItem('access_token')
  if (token) {
    const headers = AxiosHeaders.from(config.headers)
    headers.set('Authorization', `Bearer ${token}`)
    config.headers = headers
  }
  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // TODO: Implement token refresh flow via /auth/refresh endpoint.
    }
    return Promise.reject(error)
  }
)
