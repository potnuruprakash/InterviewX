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

// ─── AI Coach & Assistant API Helpers ───────────────────────────────────────
export const getCoachProfile = () => authApi.get('/api/ai/coach/profile')
export const getCoachProgress = () => authApi.get('/api/ai/coach/progress')
export const getCoachSessions = () => authApi.get('/api/ai/coach/sessions')
export const getCoachSession = (id) => authApi.get(`/api/ai/coach/sessions/${id}`)
export const createCoachSession = (payload = {}) => authApi.post('/api/ai/coach/sessions', payload)
export const sendCoachMessage = (sessionId, content) =>
  authApi.post(`/api/ai/coach/sessions/${sessionId}/messages`, { content })
export const triggerCoachAction = (sessionId, action) =>
  authApi.post(`/api/ai/coach/sessions/${sessionId}/action`, { action })

// ChatGPT-Style Conversations (Legacy AI Coach)
export const getConversations = () => authApi.get('/api/ai/coach/conversations')
export const getConversation = (id) => authApi.get(`/api/ai/coach/conversations/${id}`)
export const createConversation = (payload = {}) => authApi.post('/api/ai/coach/conversations', payload)
export const deleteConversation = (id) => authApi.delete(`/api/ai/coach/conversations/${id}`)
export const sendConversationMessage = (id, payload) =>
  authApi.post(`/api/ai/coach/conversations/${id}/messages`, payload)

export const uploadChatAttachment = (file) => {
  const form = new FormData()
  form.append('file', file)
  return authApi.post('/api/ai/coach/upload-attachment', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const rateMessageFeedback = (msgId, rating) =>
  authApi.post(`/api/ai/coach/messages/${msgId}/feedback`, { rating })

// ─── Separate Chatbot APIs (Dashboard AI & Results AI) ──────────────────────
// Dashboard Chatbot
export const getDashboardChatSessions = () => authApi.get('/api/chat/dashboard/sessions')
export const createDashboardChatSession = () => authApi.post('/api/chat/dashboard/sessions')
export const getDashboardChatSession = (id) => authApi.get(`/api/chat/dashboard/sessions/${id}`)
export const deleteDashboardChatSession = (id) => authApi.delete(`/api/chat/dashboard/sessions/${id}`)
export const sendDashboardChatMessage = (id, payload) =>
  authApi.post(`/api/chat/dashboard/sessions/${id}/messages`, payload)
export const regenerateDashboardChatResponse = (id) =>
  authApi.post(`/api/chat/dashboard/sessions/${id}/regenerate`)

// Results Chatbot
export const getResultChatSessions = (resultId) => authApi.get(`/api/chat/results/${resultId}/sessions`)
export const createResultChatSession = (resultId) => authApi.post(`/api/chat/results/${resultId}/sessions`)
export const getResultChatSession = (resultId, id) =>
  authApi.get(`/api/chat/results/${resultId}/sessions/${id}`)
export const deleteResultChatSession = (resultId, id) =>
  authApi.delete(`/api/chat/results/${resultId}/sessions/${id}`)
export const sendResultChatMessage = (resultId, id, payload) =>
  authApi.post(`/api/chat/results/${resultId}/sessions/${id}/messages`, payload)
export const regenerateResultChatResponse = (resultId, id) =>
  authApi.post(`/api/chat/results/${resultId}/sessions/${id}/regenerate`)


/**
 * Hook providing access to the singleton authApi, auth state, and helper methods.
 * Ensures the token getter is synchronized without re-instantiating Axios or looping.
 */
export const useAuthApi = () => {
  const clerkAuth = useAuth()
  const isLoaded = clerkAuth.isLoaded ?? true
  const isSignedIn = clerkAuth.isSignedIn ?? false
  const userId = clerkAuth.userId || null
  if (userId) {
    currentUserId = userId
  }
  const getToken = clerkAuth.getToken || null
  if (getToken) {
    currentTokenGetter = getToken
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
    getCoachProfile,
    getCoachProgress,
    getCoachSessions,
    getCoachSession,
    createCoachSession,
    sendCoachMessage,
    triggerCoachAction,
    getConversations,
    getConversation,
    createConversation,
    deleteConversation,
    sendConversationMessage,
    uploadChatAttachment,
    rateMessageFeedback,
    getDashboardChatSessions,
    createDashboardChatSession,
    getDashboardChatSession,
    deleteDashboardChatSession,
    sendDashboardChatMessage,
    regenerateDashboardChatResponse,
    getResultChatSessions,
    createResultChatSession,
    getResultChatSession,
    deleteResultChatSession,
    sendResultChatMessage,
    regenerateResultChatResponse,
  }
}

export default api
