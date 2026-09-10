/**
 * Research Evidence Layer
 * 
 * Provides empirical citations, methodological definitions, and interpretation caveats
 * grounded in organizational psychology, psycholinguistics, and nonverbal communication research.
 * 
 * IMPORTANT: This module strictly enforces empirical observation standards.
 * It strictly separates measurable physical/linguistic cues from subjective psychological inferences.
 */

const RESEARCH_EVIDENCE_MAP = {
  speech_rate_wpm: {
    id: 'speech_rate_wpm',
    category: 'Vocal Prosody',
    name: 'Words Per Minute (WPM) & Articulation Pace',
    empiricalTarget: '130 – 160 WPM',
    definition: 'Calculated ratio of total spoken word count to active speaking duration in minutes.',
    citation: {
      authors: 'DeGroot, T., & Motowidlo, S. J.',
      year: 1999,
      title: 'Why interviews predict job performance: A test of three competing models',
      journal: 'Journal of Applied Psychology, 84(4), 486–493',
      doi: '10.1037/0021-9010.84.4.486'
    },
    interpretation: 'Conversational pacing between 130 and 160 WPM optimizes listener cognitive processing and auditory comprehension in professional interviews. Pacing above 175 WPM can strain cognitive retention, while pacing below 110 WPM may prolong response duration.',
    limitations: 'Vocal pace naturally varies across native linguistic backgrounds, dialectic variations, and cognitive complexity of the technical concept being formulated.'
  },
  pause_duration_hesitation: {
    id: 'pause_duration_hesitation',
    category: 'Vocal Prosody',
    name: 'Strategic Pausing & Silent Interval Management',
    empiricalTarget: '1.0 – 2.5s intentional pauses; avoid silence > 4.0s during continuous points',
    definition: 'Average and maximum durations of silence detected between spoken utterances and thought transitions.',
    citation: {
      authors: 'Levashina, J., Hartwell, C. J., Morgeson, F. P., & Campion, M. A.',
      year: 2014,
      title: 'The structured employment interview: Narrative and quantitative review of the research literature',
      journal: 'Personnel Psychology, 67(1), 241–293',
      doi: '10.1111/peps.12052'
    },
    interpretation: 'A deliberate 1 to 2-second pause prior to answering reflects structured cognitive retrieval. Prolonged mid-sentence pauses exceeding 4 seconds can disrupt conversational momentum if not prefaced with an acknowledgment.',
    limitations: 'Extended pauses are standard when formulating complex algorithmic solutions, architectural diagrams, or recalling nuanced production incidents.'
  },
  filler_words_disfluency: {
    id: 'filler_words_disfluency',
    category: 'Linguistic Delivery',
    name: 'Verbal Disfluencies & Filled Pauses',
    empiricalTarget: '< 2.5% filler word density (fewer than 3 per 100 spoken words)',
    definition: 'Frequency and percentage of discourse filler tokens (e.g., "um", "uh", "like", "you know", "actually", "basically") relative to total word volume.',
    citation: {
      authors: 'Clark, H. H., & Fox Tree, J. E.',
      year: 2002,
      title: 'Using uh and um in spontaneous speaking',
      journal: 'Cognition, 84(1), 73–111',
      doi: '10.1016/S0010-0277(02)00017-3'
    },
    interpretation: 'Filled pauses naturally signal brief lexical planning delays in spontaneous spoken communication. In high-stakes structured evaluations, filler densities above 4% may diminish perceived clarity and structural precision.',
    limitations: 'Occasional filler tokens are completely normal in spontaneous technical discourse; the goal is disciplined pacing rather than unrealistic zero-filler expectations.'
  },
  visual_engagement_gaze: {
    id: 'visual_engagement_gaze',
    category: 'Observable Behavior',
    name: 'Camera-Directed Visual Engagement Ratio',
    empiricalTarget: '50% – 75% camera-oriented orientation',
    definition: 'Proportion of video frames wherein candidate facial orientation and eye vector align within the primary central upper-third bounding box.',
    citation: {
      authors: 'Kleinke, C. L.',
      year: 1986,
      title: 'Gaze and eye contact in human interaction',
      journal: 'Psychological Bulletin, 100(1), 78–100',
      doi: '10.1037/0033-2909.100.1.78'
    },
    interpretation: 'Periodic direct orientation toward the webcam establishes strong communicative rapport with remote interviewers. Research demonstrates that natural human gaze is intermittent (50–70%), with healthy avert-gaze patterns occurring during deep cognitive recall.',
    limitations: 'Gaze direction is strongly influenced by physical webcam angle, secondary monitors, lighting, and reference material. Averted gaze must NEVER be interpreted as dishonesty or lack of confidence.'
  },
  postural_stability: {
    id: 'postural_stability',
    category: 'Observable Behavior',
    name: 'Postural Stability & Frame Framing Consistency',
    empiricalTarget: 'Centered torso framing with steady upright orientation',
    definition: 'Tracking of upper-torso bounding box drift and frame alignment consistency across video response capture.',
    citation: {
      authors: 'Burgoon, J. K., Guerrero, L. K., & Floyd, K.',
      year: 2010,
      title: 'Nonverbal Communication (1st Edition)',
      journal: 'Routledge / Allyn & Bacon',
      doi: '10.4324/9781315663401'
    },
    interpretation: 'Maintaining a stable, upright posture centered in the camera viewport signals physical readiness and active engagement in remote workplace interactions.',
    limitations: 'Physical stillness should not be conflated with engagement; natural gestural movement and expressive nonverbal communication are positive attributes.'
  },
  star_structural_framework: {
    id: 'star_structural_framework',
    category: 'Answer Architecture',
    name: 'STAR Methodology for Behavioral Responses',
    empiricalTarget: 'Complete coverage of Situation, Task, Action, and quantifiable Result',
    definition: 'Narrative structure organizing past performance into Context (Situation), Objective (Task), Individual Contribution (Action), and Impact/Metric (Result).',
    citation: {
      authors: 'Campion, M. A., Palmer, D. K., & Campion, J. E.',
      year: 1997,
      title: 'A review of structure in the selection interview',
      journal: 'Personnel Psychology, 50(3), 655–702',
      doi: '10.1111/j.1744-6570.1997.tb00909.x'
    },
    interpretation: 'Structured behavioral interviewing substantially increases inter-rater reliability and predictive validity by focusing on concrete behavioral history rather than speculative hypothetical assertions.',
    limitations: 'STAR applies primarily to behavioral and situational prompts. Technical questions (e.g. system design, coding, algorithmic analysis) require architectural or conceptual structure instead.'
  }
};

module.exports = {
  RESEARCH_EVIDENCE_MAP,
};
