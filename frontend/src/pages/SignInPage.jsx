import { SignIn } from '@clerk/clerk-react'
import { Brain } from 'lucide-react'
import './AuthPage.css'

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />

      <div className="auth-brand">
        <div className="auth-brand-icon"><Brain size={24} /></div>
        <span className="auth-brand-name">InterviewX</span>
      </div>

      <div className="auth-container">
        <SignIn
          routing="hash"
          signUpUrl="/sign-up"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  )
}
