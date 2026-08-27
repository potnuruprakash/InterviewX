import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const hasClerkKey = Boolean(PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_'))

// Base Axios instance — used for non-authenticated calls
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Singleton Authenticated Axios instance created ONCE at module level
export const authApi = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// Global active token getter callback (set by useAuthApi)
let currentTokenGetter = null

// Attach request interceptor ONCE to the singleton authApi
authApi.interceptors.request.use(async (config) => {
  try {
    let token = null
    if (currentTokenGetter) {
      token = await currentTokenGetter()
    }
    if (!token && typeof window !== 'undefined' && window.Clerk?.session) {
      token = await window.Clerk.session.getToken()
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (err) {
    console.warn('[API] Could not retrieve Clerk token:', err.message)
  }
  return config
})

// Attach response interceptor ONCE to the singleton authApi
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

// ─── Direct Helper Methods bound to singleton authApi ─────────────────────────

export const analyzeResume = (resumeId, force = false) =>
  authApi.post(`/api/resumes/${resumeId}/analyze${force ? '?force=true' : ''}`)

export const getResumeAnalysis = (resumeId) =>
  authApi.get(`/api/resumes/${resumeId}/analysis`)

export const analyzeJob = (jobId, force = false) =>
  authApi.post(`/api/jobs/${jobId}/analyze${force ? '?force=true' : ''}`)

export const getJobAnalysis = (jobId) =>
  authApi.get(`/api/jobs/${jobId}/analysis`)

export const runSkillAnalysis = (resumeId, jobDescriptionId) =>
  authApi.post('/api/skill-analysis', { resumeId, jobDescriptionId })

export const getSkillAnalysis = (id) =>
  authApi.get(`/api/skill-analysis/${id}`)

export const getUserSkillAnalyses = () =>
  authApi.get('/api/skill-analysis')

export const getSkillAnalysisByContext = (resumeId, jobDescriptionId) =>
  authApi.get(`/api/skill-analysis/by-context?resumeId=${resumeId}&jobDescriptionId=${jobDescriptionId}`)

/**
 * Hook providing access to the singleton authApi, auth state, and helper methods.
 * Ensures the token getter is synchronized without re-instantiating Axios or looping.
 */
export const useAuthApi = () => {
  let isLoaded = true
  let isSignedIn = false
  let userId = null
  let getToken = null

  if (hasClerkKey) {
    try {
      const clerkAuth = useAuth()
      isLoaded = clerkAuth.isLoaded
      isSignedIn = clerkAuth.isSignedIn
      userId = clerkAuth.userId
      getToken = clerkAuth.getToken
      if (getToken) {
        currentTokenGetter = getToken
      }
    } catch (e) {
      // Not wrapped in ClerkProvider
    }
  }

  return {
    authApi,
    isLoaded: isLoaded ?? true,
    isSignedIn: isSignedIn ?? false,
    userId,
    getToken,
    analyzeResume,
    getResumeAnalysis,
    analyzeJob,
    getJobAnalysis,
    runSkillAnalysis,
    getSkillAnalysis,
    getUserSkillAnalyses,
    getSkillAnalysisByContext,
  }
}

export default api
