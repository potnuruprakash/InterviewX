import { memo } from 'react'
import { AlertCircle, AlertTriangle, LogOut, CheckCircle } from 'lucide-react'

/**
 * Dialogs for End Interview & Skip Question confirmation
 */
export const EndInterviewModal = memo(function EndInterviewModal({
  isOpen,
  onClose,
  onConfirm,
  ending = false,
}) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop animate-fade-in" role="dialog" aria-modal="true">
      <div className="skip-confirm-modal glass-card animate-scale-up">
        <div className="skip-modal-icon">
          <AlertCircle size={32} color="#ef4444" />
        </div>
        <h3 className="skip-modal-title">End Interview Session?</h3>
        <p className="skip-modal-text">
          Are you sure you want to finish now? Your submitted answers will be finalized, and your comprehensive evaluation report will be generated.
        </p>
        <div className="skip-modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={ending}
          >
            Continue Interview
          </button>
          <button
            type="button"
            className="btn btn-danger-skip"
            style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }}
            onClick={onConfirm}
            disabled={ending}
          >
            {ending ? 'Finalizing...' : 'End & View Results'}
          </button>
        </div>
      </div>
    </div>
  )
})

export const SkipConfirmModal = memo(function SkipConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  skipping = false,
}) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop animate-fade-in" role="dialog" aria-modal="true">
      <div className="skip-confirm-modal glass-card animate-scale-up">
        <div className="skip-modal-icon">
          <AlertTriangle size={32} color="#f59e0b" />
        </div>
        <h3 className="skip-modal-title">Skip this question?</h3>
        <p className="skip-modal-text">
          Your in-progress answer will not be submitted. This question will be marked as skipped and will not negatively impact your evaluation score.
        </p>
        <div className="skip-modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={skipping}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger-skip"
            onClick={onConfirm}
            disabled={skipping}
          >
            {skipping ? 'Skipping...' : 'Yes, Skip Question'}
          </button>
        </div>
      </div>
    </div>
  )
})
