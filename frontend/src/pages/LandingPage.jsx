import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Brain, Mic, Video, FileText, ChevronRight, Zap, Shield, BarChart3, Sparkles } from 'lucide-react'
import './LandingPage.css'

const features = [
  {
    icon: FileText,
    title: 'Resume-Powered Questions',
    description: 'AI analyzes your resume and target job description to generate personalized, relevant interview questions.',
    color: 'purple',
    badge: 'Personalized',
  },
  {
    icon: Mic,
    title: 'Speech & Audio Analysis',
    description: 'Acoustic feature extraction evaluates delivery indicators, speaking pace, pauses, and clarity.',
    color: 'cyan',
    badge: 'Audio Intelligence',
  },
  {
    icon: Video,
    title: 'Video Analysis',
    description: 'YOLOv8 person presence detection and frame analysis provide holistic visual engagement metrics.',
    color: 'green',
    badge: 'Visual Analytics',
  },
  {
    icon: Zap,
    title: 'Adaptive Questioning',
    description: 'Question difficulty dynamically adjusts in real-time based on your concept coverage and answer depth.',
    color: 'yellow',
    badge: 'Adaptive Engine',
  },
  {
    icon: BarChart3,
    title: 'Skill Gap & Progress Tracking',
    description: 'Track your improvement across multiple sessions with longitudinal trend charts and radar analytics.',
    color: 'cyan',
    badge: 'Analytics',
  },
  {
    icon: Shield,
    title: 'Secure & Multi-Tenant',
    description: 'Every interview session is private to you. Verified Clerk authentication ensures complete data isolation.',
    color: 'purple',
    badge: 'Enterprise Security',
  },
]

const colorMap = {
  purple: 'badge-purple',
  cyan: 'badge-cyan',
  green: 'badge-green',
  yellow: 'badge-yellow',
}

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Navigation */}
      <header className="landing-header">
        <div className="container">
          <div className="landing-nav">
            <div className="landing-nav-logo">
              <div className="landing-nav-icon"><Brain size={20} /></div>
              <span>InterviewX</span>
            </div>
            <div className="landing-nav-actions">
              <SignedOut>
                <Link to="/sign-in" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link to="/sign-up" className="btn btn-primary btn-sm">Get Started</Link>
              </SignedOut>
              <SignedIn>
                <Link to="/dashboard" className="btn btn-primary btn-sm">Go to Dashboard</Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero section">
        <div className="container">
          <div className="hero-badge">
            <span className="badge badge-purple"><Sparkles size={13} /> AI-Powered Mock Interview Platform</span>
          </div>
          <h1 className="hero-title">
            Master Your Next Interview with <span className="gradient-text">InterviewX</span>
          </h1>
          <p className="hero-subtitle">
            The next generation of interview preparation. Personalized question generation from your resume and job description,
            multimodal analysis (text, speech, and video), and targeted improvement roadmaps.
          </p>
          <div className="hero-actions">
            <SignedOut>
              <Link to="/sign-up" className="btn btn-primary btn-lg">
                Start Free <ChevronRight size={18} />
              </Link>
              <Link to="/sign-in" className="btn btn-secondary btn-lg">
                Sign In
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Open Dashboard <ChevronRight size={18} />
              </Link>
            </SignedIn>
          </div>
          <div className="hero-badges">
            <span className="badge badge-gray">✨ Personalized Questions</span>
            <span className="badge badge-gray">🔒 Verified Clerk Auth</span>
            <span className="badge badge-gray">📝 SBERT Semantic Evaluation</span>
            <span className="badge badge-gray">🎯 Real-time Adaptive Engine</span>
          </div>
        </div>

        {/* Decorative orbs */}
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </section>

      {/* Pipeline visualization */}
      <section className="pipeline section">
        <div className="container">
          <h2 className="section-title">System Architecture</h2>
          <div className="pipeline-flow">
            {['Resume + JD', 'Skill Analysis', 'Question Generation', 'Candidate Response', 'Multimodal Evaluation', 'Fusion', 'Feedback & Roadmap'].map((step, i) => (
              <div key={step} className="pipeline-step">
                <div className="pipeline-node">{step}</div>
                {i < 6 && <div className="pipeline-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features section">
        <div className="container">
          <h2 className="section-title">Core Capabilities</h2>
          <div className="features-grid">
            {features.map(({ icon: Icon, title, description, color, badge }) => (
              <div key={title} className="feature-card glass-card">
                <div className={`feature-icon feature-icon-${color}`}>
                  <Icon size={22} />
                </div>
                <div className="feature-content">
                  <div className="feature-header">
                    <h3 className="feature-title">{title}</h3>
                    {badge && <span className={`badge ${colorMap[color]}`}>{badge}</span>}
                  </div>
                  <p className="feature-desc">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta section">
        <div className="container">
          <div className="cta-card glass-card-accent">
            <h2 className="cta-title">Ready to ace your next interview?</h2>
            <p className="cta-subtitle">Upload your resume, paste the job description, and let InterviewX guide you.</p>
            <SignedOut>
              <Link to="/sign-up" className="btn btn-primary btn-lg">
                Create Free Account <ChevronRight size={18} />
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/create-interview" className="btn btn-primary btn-lg">
                Create Interview <ChevronRight size={18} />
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">
          <p>InterviewX — Personalized Multimodal Interview Intelligence System</p>
        </div>
      </footer>
    </div>
  )
}
