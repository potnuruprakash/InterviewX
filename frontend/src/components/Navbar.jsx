import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { Brain, LayoutDashboard, PlusCircle, TrendingUp, BarChart3 } from 'lucide-react'
import './Navbar.css'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/create-interview', label: 'New Interview', icon: PlusCircle },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/skill-analysis', label: 'Resume & JD', icon: BarChart3 },
]

export default function Navbar() {
  const location = useLocation()
  const { user } = useUser()

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/dashboard" className="navbar-logo">
          <div className="navbar-logo-icon">
            <Brain size={20} />
          </div>
          <span className="navbar-logo-text">InterviewX</span>
        </Link>

        {/* Nav Links */}
        <div className="navbar-links">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        {/* User & Clerk UserButton */}
        <div className="navbar-user">
          {user && (
            <span className="navbar-username">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress?.split('@')[0]}
            </span>
          )}
          <div className="user-button-wrapper">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'navbar-avatar',
                  userButtonPopoverCard: 'cl-custom-popover-card',
                  userButtonPopoverActionButton: 'cl-custom-popover-action',
                  userButtonPopoverActionButtonText: 'cl-custom-popover-action-text',
                  userButtonPopoverActionButtonIcon: 'cl-custom-popover-action-icon',
                  userPreviewMainIdentifier: 'cl-custom-preview-name',
                  userPreviewSecondaryIdentifier: 'cl-custom-preview-email',
                  userButtonPopoverFooter: 'cl-custom-popover-footer',
                },
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}
