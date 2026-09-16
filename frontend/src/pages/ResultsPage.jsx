import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  ArrowLeft, RefreshCw, AlertCircle, Award, Activity, Video, Mic,
  Layers, FileText, BookOpen, ChevronRight, PlusCircle, Compass, Target, Bot
} from 'lucide-react'

import { adaptResults } from '../utils/resultsAdapter'
import AIAssistantDrawer from '../components/coach/AIAssistantDrawer'

// Modular Components
import ResultsHero from '../components/results/ResultsHero'
import ScoreSummary from '../components/results/ScoreSummary'
import StrengthsAndImprovements from '../components/results/StrengthsAndImprovements'
import ProgressComparison from '../components/results/ProgressComparison'
import RecommendedPractice from '../components/results/RecommendedPractice'
import QuestionReview from '../components/results/QuestionReview'
import CommunicationAnalysis from '../components/results/CommunicationAnalysis'
import VideoPresenceAnalysis from '../components/results/VideoPresenceAnalysis'
import DetailedEvaluation from '../components/results/DetailedEvaluation'
import InterviewTranscript from '../components/results/InterviewTranscript'
import MethodologyPanel from '../components/results/MethodologyPanel'
import CollapsibleSection from '../components/results/CollapsibleSection'
import EvidenceModal from '../components/results/EvidenceModal'

import './ResultsPage.css'

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()

  const [results, setResults] = useState(null)
  const [roadmap, setRoadmap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const fetchedRef = useRef(null)

  // Consolidated state for progressive disclosure sections (default closed)
  const [expandedSections, setExpandedSections] = useState({
    communication: false,
    video: false,
    details: false,
    transcript: false,
    methodology: false,
  })

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Load results and roadmap from backend
  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (fetchedRef.current === id) return
    fetchedRef.current = id

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [resRes, roadRes] = await Promise.all([
          authApi.get(`/api/interviews/${id}/results`),
          authApi.get(`/api/interviews/${id}/roadmap`).catch(() => ({ data: null })),
        ])
        setResults(resRes.data)
        setRoadmap(roadRes.data?.roadmap || null)
      } catch (err) {
        console.error('[ResultsPage] Error fetching results:', err)
        setError(err.message || 'Could not retrieve interview evaluation data.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, isLoaded, isSignedIn])

  // Adapt backend data into presentation structure via pure adapter
  const adapted = useMemo(() => {
    if (!results) return null
    return adaptResults(results, roadmap)
  }, [results, roadmap])

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="results-page-loading">
        <div className="results-loading-card glass-card animate-fade-in">
          <div className="loading-spinner" />
          <h2 className="loading-title">Generating Assessment Report</h2>
          <p className="loading-sub">
            Aggregating technical semantics, communicative pacing, and verified presence metrics...
          </p>
        </div>
      </div>
    )
  }

  // ── ERROR STATE ────────────────────────────────────────────────────────────
  if (error || !adapted) {
    return (
      <div className="results-page-error">
        <div className="results-error-card glass-card animate-fade-in">
          <AlertCircle size={36} className="error-icon" />
          <h2 className="error-title">Assessment Report Unavailable</h2>
          <p className="error-sub">{error || 'Interview session data could not be loaded.'}</p>
          <div className="error-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                fetchedRef.current = null
                window.location.reload()
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
            <Link to="/dashboard" className="btn btn-primary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const {
    interviewId,
    hero,
    scoreSummary,
    strengths,
    topImprovements,
    progress,
    recommendedPractice,
    questions,
    communication,
    video,
    detailedEvaluation,
    transcript,
    methodology,
  } = adapted

  const practiceUrl = `/create-interview?practiceFrom=${interviewId}`

  return (
    <div className="results-page">
      <div className="results-container">
        {/* ── TOP NAV BAR ─────────────────────────────────────────────────── */}
        <nav className="results-nav-bar" aria-label="Results Navigation">
          <Link to="/dashboard" className="back-link">
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <div className="nav-actions-right">
            <button
              type="button"
              className="btn-nav-action action-train-me"
              onClick={() => setCoachOpen(true)}
              title="Targeted AI Coach training based on this interview"
            >
              <Target size={13} />
              <span>🎯 Train Me</span>
            </button>
            <Link to={practiceUrl} className="btn-nav-action action-practice">
              <Compass size={13} />
              <span>Practice Weak Areas</span>
            </Link>
            <Link to="/create-interview" className="btn-nav-action action-new">
              <PlusCircle size={13} />
              <span>New Interview</span>
            </Link>
          </div>
        </nav>

        {/* ── 1. RESULTS HERO ─────────────────────────────────────────────── */}
        <ResultsHero
          hero={hero}
          onOpenEvidence={() => setShowEvidenceModal(true)}
        />

        {/* ── 2. SCORE SUMMARY (4 KEY CARDS) ──────────────────────────────── */}
        <ScoreSummary scoreSummary={scoreSummary} />

        {/* ── 3. STRENGTHS & TOP 3 IMPROVEMENTS ───────────────────────────── */}
        <StrengthsAndImprovements
          strengths={strengths}
          topImprovements={topImprovements}
          interviewId={interviewId}
        />

        {/* ── 4. PROGRESS VS PREVIOUS INTERVIEW ───────────────────────────── */}
        <ProgressComparison progress={progress} />

        {/* ── 5. RECOMMENDED PRACTICE ─────────────────────────────────────── */}
        <RecommendedPractice
          recommendedPractice={recommendedPractice}
          interviewId={interviewId}
        />

        {/* ── 6. QUESTION REVIEW (ACCORDION) ──────────────────────────────── */}
        <QuestionReview questions={questions} />

        {/* ── PROGRESSIVE DISCLOSURE SECTIONS (DEFAULT COLLAPSED) ─────────── */}
        <div className="progressive-sections-wrap">
          <div className="progressive-header">
            <h2 className="progressive-title">Deep Dive Analysis & Logs</h2>
            <p className="progressive-sub">Expand sections below to inspect acoustic waveforms, presence tracking, and raw transcripts</p>
          </div>

          {/* 7. Communication Analysis */}
          <CollapsibleSection
            id="communication"
            title="Communication & Acoustic Fluency"
            subtitle="Words per minute, verbal filler density, and pause cadence"
            icon={Mic}
            badgeText={communication.isAvailable ? `${communication.wpm || '—'} WPM` : 'Not recorded'}
            badgeType={communication.isAvailable ? 'complete' : 'muted'}
            isOpen={expandedSections.communication}
            onToggle={() => toggleSection('communication')}
          >
            <CommunicationAnalysis communication={communication} />
          </CollapsibleSection>

          {/* 8. Video & Presence Analysis */}
          <CollapsibleSection
            id="video"
            title="Video & Observable Presence (YOLOv8)"
            subtitle="Webcam presence, horizontal framing, and observable expressions"
            icon={Video}
            badgeText={video.isAvailable ? 'Analysis Complete' : 'Unavailable'}
            badgeType={video.isAvailable ? 'complete' : 'warning'}
            isOpen={expandedSections.video}
            onToggle={() => toggleSection('video')}
          >
            <VideoPresenceAnalysis video={video} />
          </CollapsibleSection>

          {/* 9. Detailed Evaluation */}
          <CollapsibleSection
            id="details"
            title="Detailed Evaluation Sub-Pillars"
            subtitle="Granular technical accuracy, relevance, completeness, and multimodal weight allocations"
            icon={Layers}
            badgeText="6 Sub-Pillars"
            badgeType="neutral"
            isOpen={expandedSections.details}
            onToggle={() => toggleSection('details')}
          >
            <DetailedEvaluation detailedEvaluation={detailedEvaluation} />
          </CollapsibleSection>

          {/* 10. Interview Transcript */}
          <CollapsibleSection
            id="transcript"
            title="Interview Transcript"
            subtitle="Chronological log of questions, candidate answers, and code submissions"
            icon={FileText}
            badgeText={`${transcript.length} Questions`}
            badgeType="neutral"
            isOpen={expandedSections.transcript}
            onToggle={() => toggleSection('transcript')}
          >
            <InterviewTranscript transcript={transcript} />
          </CollapsibleSection>

          {/* 11. Methodology */}
          <CollapsibleSection
            id="methodology"
            title="How Your Interview Was Evaluated"
            subtitle="Transparent explanation of SBERT, MFCC speech analysis, YOLOv8 framing, and multimodal fusion"
            icon={BookOpen}
            badgeText="Methodology"
            badgeType="neutral"
            isOpen={expandedSections.methodology}
            onToggle={() => toggleSection('methodology')}
          >
            <MethodologyPanel
              methodology={methodology}
              onOpenEvidence={() => setShowEvidenceModal(true)}
            />
          </CollapsibleSection>
        </div>

        {/* ── 12. NEXT ACTION FOOTER ──────────────────────────────────────── */}
        <div className="results-action-footer glass-card">
          <div className="footer-left">
            <span className="footer-callout">Ready for your next mock session?</span>
            <p className="footer-desc">
              Practice weak areas directly or challenge yourself with an increased difficulty level.
            </p>
          </div>
          <div className="footer-right">
            <Link to={practiceUrl} className="btn btn-primary">
              <Compass size={14} /> Practice Weak Areas
            </Link>
            <Link to="/create-interview" className="btn btn-secondary">
              <PlusCircle size={14} /> Start New Interview
            </Link>
            <Link to="/dashboard" className="btn btn-ghost">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* ── EVIDENCE MODAL (OPTIONAL POPUP) ─────────────────────────────── */}
        <EvidenceModal
          isOpen={showEvidenceModal}
          onClose={() => setShowEvidenceModal(false)}
          researchEvidence={methodology.researchEvidence}
        />

        {/* ── AI COACH DRAWER (RESULTS → TRAIN ME) ─────────────────────────── */}
        <AIAssistantDrawer
          isOpen={coachOpen}
          onClose={() => setCoachOpen(false)}
          initialSourceInterviewId={id}
        />
      </div>
    </div>
  )
}
