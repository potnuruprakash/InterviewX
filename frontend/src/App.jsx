import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, ClerkLoaded, ClerkLoading } from '@clerk/clerk-react'
import { AlertCircle, BrainCircuit } from 'lucide-react'

import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ResultsErrorBoundary from './components/ResultsErrorBoundary'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CreateInterview = lazy(() => import('./pages/CreateInterview'))
const InterviewPage = lazy(() => import('./pages/InterviewPage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SkillGapPage = lazy(() => import('./pages/SkillGapPage'))

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const hasClerkKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_')

function PageTransitionLoader() {
  const location = useLocation()
  const showBrainLoader = ['/', '/dashboard', '/progress'].includes(location.pathname)
  const [visible, setVisible] = useState(showBrainLoader)

  useEffect(() => {
    if (!showBrainLoader) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timeoutId = window.setTimeout(() => setVisible(false), 420)
    return () => window.clearTimeout(timeoutId)
  }, [location.pathname, showBrainLoader])

  if (!showBrainLoader || !visible) return null

  return (
    <div className="page-transition-loader page-transition-loader-brain" role="status" aria-live="polite" aria-label="Loading page">
      <div className="page-loader-orbit page-loader-orbit-outer" />
      <div className="page-loader-orbit page-loader-orbit-inner" />
      <div className="page-loader-brand-icon"><BrainCircuit size={30} strokeWidth={1.8} /></div>
      <div className="page-loader-brand">Interview<span>X</span></div>
      <p className="page-loader-title">Loading<span className="page-loader-ellipsis">...</span></p>
    </div>
  )
}

const ProtectedRoute = ({ children }) => {
  if (!hasClerkKey) {
    return (
      <>
        {children}
      </>
    )
  }
  return (
    <>
      <ClerkLoading>
        <div className="results-loading" style={{ minHeight: '60vh' }}>
          <div className="spinner" />
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>{children}</SignedIn>
        <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
      </ClerkLoaded>
    </>
  )
}

const AuthRoute = ({ children }) => {
  if (!hasClerkKey) {
    return children
  }
  return (
    <>
      <SignedOut>{children}</SignedOut>
      <SignedIn><Navigate to="/dashboard" replace /></SignedIn>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-wrapper">\n        <PageTransitionLoader />
        {!hasClerkKey && (
          <div style={{
            background: '#7c3aed',
            color: '#fff',
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            position: 'sticky',
            top: 0,
            zIndex: 9999
          }}>
            <AlertCircle size={18} />
            <span>Clerk Setup Required: Please add valid <code>VITE_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to <code>frontend/.env</code> and <code>backend/.env</code></span>
          </div>
        )}

        <Suspense fallback={<div className="page-transition-suspense"><PageTransitionLoader /></div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in" element={<AuthRoute><SignInPage /></AuthRoute>} />
            <Route path="/sign-up" element={<AuthRoute><SignUpPage /></AuthRoute>} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/create-interview" element={
              <ProtectedRoute>
                <Navbar />
                <CreateInterview />
              </ProtectedRoute>
            } />
            <Route path="/interview/:id" element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            } />
            <Route path="/interview/:id/results" element={
              <ProtectedRoute>
                <Navbar />
                <ResultsErrorBoundary>
                  <ResultsPage />
                </ResultsErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute>
                <Navbar />
                <ProgressPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Navbar />
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/skill-analysis" element={
              <ProtectedRoute>
                <Navbar />
                <SkillGapPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}
