import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')
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

// In-flight GET promise deduplication to prevent duplicate concurrent network calls
const inFlightGetPromises = new Map()
const originalAuthGet = authApi.get.bind(authApi)
authApi.get = (url, config = {}) => {
  if (!config.params && !config.responseType) {
    const key = `${url}`
    if (inFlightGetPromises.has(key)) {
      return inFlightGetPromises.get(key)
    }
    const promise = originalAuthGet(url, config).finally(() => {
      inFlightGetPromises.delete(key)
    })
    inFlightGetPromises.set(key, promise)
    return promise
  }
  return originalAuthGet(url, config)
}

// Global active token and user ID getters (set by useAuthApi)
let currentTokenGetter = null
let currentUserId = null

// Attach request interceptor ONCE to the singleton authApi
authApi.interceptors.request.use(async (config) => {
  try {
    let token = null
    if (currentTokenGetter) {
      token = await currentTokenGetter()
    }
    if (!token && typeof window !== 'undefined') {
      if (window.Clerk?.session) {
        token = await window.Clerk.session.getToken()
      } else if (window.Clerk && !window.Clerk.loaded) {
        // Wait briefly for Clerk to finish hydration
        await new Promise((resolve) => setTimeout(resolve, 150))
        if (window.Clerk?.session) {
          token = await window.Clerk.session.getToken()
        }
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

  } catch (err) {
    console.warn('[API] Could not retrieve Clerk token:', err.message)
  }
  return config
})

// Attach response interceptor ONCE to the singleton authApi with single retry on 401
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        let freshToken = null
        if (currentTokenGetter) {
          freshToken = await currentTokenGetter({ skipCache: true }).catch(() => null)
        }
        if (!freshToken && typeof window !== 'undefined' && window.Clerk?.session) {
          freshToken = await window.Clerk.session.getToken({ skipCache: true }).catch(() => null)
        }
        if (freshToken) {
          originalRequest.headers.Authorization = `Bearer ${freshToken}`
          return authApi(originalRequest)
        }
      } catch (retryErr) {
        console.warn('[API] Token refresh retry failed:', retryErr.message)
      }
    }
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

export const trainInterview = (interviewId) =>
  authApi.post(`/api/interviews/${interviewId}/train`)

export const getTrainingSession = (trainingId) =>
  authApi.get(`/api/interviews/training/${trainingId}`)

export const sendCoachMessage = (payload) =>
  authApi.post('/api/coach/chat', payload)

export const getCoachState = () =>
  authApi.get('/api/coach/state')

export const resetCoach = () =>
  authApi.post('/api/coach/reset')

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
      if (userId) {
        currentUserId = userId
      }
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
    trainInterview,
    getTrainingSession,
    sendCoachMessage,
    getCoachState,
    resetCoach,
  }
}

export default api
