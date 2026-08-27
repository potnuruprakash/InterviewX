import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { AlertCircle } from 'lucide-react'

import LandingPage from './pages/LandingPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import Dashboard from './pages/Dashboard'
import CreateInterview from './pages/CreateInterview'
import InterviewPage from './pages/InterviewPage'
import ResultsPage from './pages/ResultsPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'
import SkillGapPage from './pages/SkillGapPage'
import Navbar from './components/Navbar'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const hasClerkKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_')

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
      <SignedIn>{children}</SignedIn>
      <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
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
      <div className="page-wrapper">
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
              <ResultsPage />
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
      </div>
    </BrowserRouter>
  )
}
