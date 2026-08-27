import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isValidKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isValidKey ? (
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: '#8b5cf6',
            colorBackground: '#121224',
            colorInputBackground: '#1e1e36',
            colorInputText: '#ffffff',
            colorText: '#ffffff',
            colorTextSecondary: '#94a3b8',
            colorTextOnPrimaryBackground: '#ffffff',
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
          },
          elements: {
            card: 'cl-custom-card',
            userButtonPopoverCard: 'cl-custom-popover-card',
            userButtonPopoverActionButton: 'cl-custom-popover-action',
            userButtonPopoverActionButtonText: 'cl-custom-popover-action-text',
            userButtonPopoverActionButtonIcon: 'cl-custom-popover-action-icon',
            userPreviewMainIdentifier: 'cl-custom-preview-name',
            userPreviewSecondaryIdentifier: 'cl-custom-preview-email',
            userButtonPopoverFooter: 'cl-custom-popover-footer',
            formButtonPrimary: 'btn btn-primary',
          },
        }}
      >
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
