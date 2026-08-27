import { useUser, UserProfile } from '@clerk/clerk-react'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user } = useUser()

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header animate-fade-in">
          <h1 className="profile-title">Your Profile</h1>
          <p className="profile-subtitle">Manage your account and authentication settings via Clerk.</p>
        </div>
        <div className="profile-content animate-fade-in">
          <UserProfile
            appearance={{
              variables: {
                colorPrimary: '#7c3aed',
                colorBackground: '#0f0f1a',
                colorText: '#f1f5f9',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
