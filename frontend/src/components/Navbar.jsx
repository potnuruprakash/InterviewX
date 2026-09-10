import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { Brain, LayoutDashboard, PlusCircle, TrendingUp, BarChart3, Sun, Moon, Menu, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
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
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile drawer whenever user navigates
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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
          <button
            type="button"
            className="navbar-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

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
          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer animate-slide-down" id="navbar-mobile-drawer">
          <div className="navbar-mobile-links">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`navbar-mobile-link ${location.pathname === to ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
