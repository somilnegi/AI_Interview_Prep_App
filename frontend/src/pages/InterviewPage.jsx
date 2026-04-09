import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { interviewAPI, multimodalAPI, streamQuestion } from '../services/api'
import { EvaluationCard } from '../components/interview/EvaluationCard'
import { MultimodalPanel } from '../components/interview/MultimodalPanel'
import { ThetaMeter } from '../components/ui/ThetaMeter'
import { Spinner } from '../components/ui/Spinner'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

// ─── Multimodal sub-components ────────────────────────────────────────────────

function MultimodalOfflineCard({ onRetry, checking }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg leading-none mt-0.5">🎙️</span>
        <div>
          <div className="text-sm font-bold text-amber-800">Delivery analysis offline</div>
          <div className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            The multimodal sidecar isn't running. Start it to enable voice scoring.
          </div>
        </div>
      </div>
      <div className="bg-white/60 rounded-lg p-3 mb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          Run these commands
        </div>
        {[
          'pip install fastapi uvicorn librosa soundfile numpy spacy pydub',
          'python -m spacy download en_core_web_sm',
          'uvicorn multimodal_service:app --port 8001 --reload',
        ].map((cmd, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-amber-500 font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
            <code className="text-[10px] font-mono text-amber-900 break-all leading-relaxed">{cmd}</code>
          </div>
        ))}
      </div>
      <button
        onClick={onRetry}
        disabled={checking}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 active:scale-95 text-amber-900 text-xs font-semibold transition-all disabled:opacity-50"
      >
        {checking ? <Spinner size="sm" /> : <span>↻</span>}
        {checking ? 'Checking…' : 'Retry connection'}
      </button>
      <p className="text-[10px] text-amber-600/80 text-center mt-2">
        Text answers still work fine — voice features are optional
      </p>
    </div>
  )
}

function MultimodalReadyCard() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">🎙️</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-emerald-800">Delivery analysis ready</div>
          <div className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
            Hit the mic button to record. After submission you'll get pace, filler, STAR, and confidence scores.
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { interviewId }  = useParams()
  const { state }        = useLocation()
  const navigate         = useNavigate()
  const role             = state?.role || 'Interview'

  const [questionText,  setQuestionText]  = useState('')
  const [streamBuffer,  setStreamBuffer]  = useState('')
  const [questionNum,   setQuestionNum]   = useState(1)
  const [answer,        setAnswer]        = useState('')
  const [evaluation,    setEvaluation]    = useState(null)
  const [mmData,        setMmData]        = useState(null)
  const [mmError,       setMmError]       = useState('')
  const [theta,         setTheta]         = useState(0)
  const [thetaHistory,  setThetaHistory]  = useState([])
  const [abilityLevel,  setAbilityLevel]  = useState('Proficient (top 50%)')
  const [loadingQ,      setLoadingQ]      = useState(true)
  const [submitting,    setSubmitting]    = useState(false)
  const [ending,        setEnding]        = useState(false)
  const [finished,      setFinished]      = useState(false)
  const [mmStatus,      setMmStatus]      = useState('checking')
  const [shortWarning,  setShortWarning]  = useState(false)
  const cancelStream = useRef(null)

  const FILLER_PHRASES = [
    "i'm not sure", "i don't know", "not sure", "i have no idea",
    "no idea", "i'm unsure", "idk", "i cannot answer", "i can't answer",
    "pass", "skip", "i don't know the answer", "i am not sure",
  ]
  const isTooShort  = (t) => t.trim().split(/\s+/).length < 15
  const isNonAnswer = (t) => {
    const lower = t.trim().toLowerCase()
    return FILLER_PHRASES.some(p => lower.includes(p)) && isTooShort(t)
  }

  const {
    recording, audioBlob, audioBlobRef, speechSupported,
    start: startRec, stop: stopRec, reset: resetRec,
  } = useAudioRecorder({
    onTranscriptUpdate: (text) => {
      setAnswer(text)
      setShortWarning(false)
    },
  })

  // ── Check multimodal service ───────────────────────────────────────────────
  const checkMmService = useCallback(async () => {
    setMmStatus('checking')
    try {
      await multimodalAPI.health()
      setMmStatus('online')
    } catch {
      setMmStatus('offline')
    }
  }, [])

  useEffect(() => { checkMmService() }, [checkMmService])

  // ── Fetch next question via SSE ────────────────────────────────────────────
  const fetchQuestion = useCallback(() => {
    if (cancelStream.current) cancelStream.current()
    setLoadingQ(true)
    setStreamBuffer('')
    setQuestionText('')
    setEvaluation(null)
    setMmData(null)
    setMmError('')
    setAnswer('')
    resetRec()

    cancelStream.current = streamQuestion(
      interviewId,
      (partial) => { setStreamBuffer(partial); setLoadingQ(false) },
      (full) => {
        if (full === null) { setFinished(true); setLoadingQ(false) }
        else { setQuestionText(full); setStreamBuffer(''); setLoadingQ(false) }
      },
      () => setLoadingQ(false),
    )
  }, [interviewId, resetRec])

  useEffect(() => { fetchQuestion() }, [fetchQuestion])

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = async (force = false) => {
    if (!answer.trim() && !audioBlobRef.current) return

    if (!force && isNonAnswer(answer) && !shortWarning) {
      setShortWarning(true)
      return
    }
    setShortWarning(false)

    const finalAnswer = answer.trim() || '[Voice answer — see delivery analysis]'
    setSubmitting(true)
    setMmError('')
    try {
      const { data } = await interviewAPI.evaluate({ interviewId, answer: finalAnswer })
      setEvaluation(data)
      setTheta(data.theta)
      setThetaHistory(h => [...h, data.theta])
      setAbilityLevel(data.abilityLevel)

      const blobToAnalyse = audioBlobRef.current
      if (mmStatus === 'online' && blobToAnalyse) {
        try {
          const mm = await multimodalAPI.analyse(blobToAnalyse, finalAnswer)
          setMmData(mm)
        } catch (mmErr) {
          setMmError('Delivery analysis failed — ' + (mmErr.message || 'unknown error'))
        }
      }
    } catch {
      // evaluate failed — user sees no feedback, can retry
    } finally {
      setSubmitting(false)
    }
  }

  const nextQuestion = () => {
    setQuestionNum(n => n + 1)
    fetchQuestion()
  }

  const endInterview = async () => {
    setEnding(true)
    try {
      const { data } = await interviewAPI.end(interviewId)
      navigate('/interview/results', { state: { results: data, role } })
    } catch {
      setEnding(false)
    }
  }

  const displayQuestion = streamBuffer || questionText

  // ── All questions done ─────────────────────────────────────────────────────
  if (finished && !evaluation) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center px-6">
        <div className="bg-white border border-surface-4 rounded-2xl p-12 max-w-md w-full text-center shadow-lg animate-slide-up">
          <div className="text-5xl mb-5">🎯</div>
          <h1 className="font-display text-2xl font-black mb-2">Session complete!</h1>
          <p className="text-ink-3 text-sm mb-8 leading-relaxed">
            All questions answered. Generate your full performance report now.
          </p>
          <button className="btn btn-accent btn-lg w-full" onClick={endInterview} disabled={ending}>
            {ending ? <Spinner light /> : 'View full results →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface-2">

      {/* ══ Main panel ══════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <div className="bg-white border-b border-surface-4 px-6 py-3 flex items-center justify-between gap-4">
          <span className="font-display font-black text-lg shrink-0">
            prep<span className="text-brand-500">AI</span>
          </span>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-ink-3 truncate">{role}</span>
            <span className="shrink-0 text-xs bg-surface-3 px-2.5 py-1 rounded-full text-ink-3 font-medium">
              Q{questionNum}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm shrink-0" onClick={endInterview} disabled={ending}>
            {ending ? <Spinner size="sm" /> : 'End & get results'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-surface-3">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${Math.min((questionNum / 10) * 100, 100)}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-3xl w-full mx-auto">

          {/* Question */}
          <div className="mb-8">
            <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-3">
              Question {questionNum} · θ = {theta.toFixed(2)}
            </div>
            {loadingQ ? (
              <div className="space-y-3">
                <div className="h-6 bg-surface-3 rounded-lg animate-pulse w-3/4" />
                <div className="h-6 bg-surface-3 rounded-lg animate-pulse w-1/2" />
              </div>
            ) : (
              <h2 className="font-display text-2xl font-bold leading-snug tracking-tight text-ink">
                {displayQuestion}
              </h2>
            )}
          </div>

          {/* Answer form */}
          {!evaluation && !loadingQ && displayQuestion && (
            <div className="space-y-4">

              {/* Mic button — only when multimodal is online */}
              {mmStatus === 'online' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={recording ? stopRec : startRec}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all ${
                      recording
                        ? 'bg-brand-500 text-white animate-pulse-ring'
                        : 'bg-surface-3 text-ink-3 hover:bg-surface-4'
                    }`}
                    title={recording ? 'Stop recording' : 'Record answer for delivery analysis'}
                  >
                    🎙️
                  </button>
                  {recording && speechSupported && (
                    <span className="text-xs text-brand-500 font-semibold animate-pulse">
                      ● Recording & transcribing…
                    </span>
                  )}
                  {recording && !speechSupported && (
                    <span className="text-xs text-brand-500 font-semibold animate-pulse">
                      ● Recording…
                    </span>
                  )}
                  {audioBlob && !recording && (
                    <span className="text-xs text-emerald-600 font-medium">
                      ✅ Audio ready — delivery analysis will run on submit
                    </span>
                  )}
                </div>
              )}

              {/* Browser doesn't support SpeechRecognition */}
              {mmStatus === 'online' && !speechSupported && !recording && !audioBlob && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  <span>⚠️</span>
                  <span>Live transcription needs Chrome or Edge. You can still record audio — just also type your answer.</span>
                </div>
              )}

              <textarea
                className="textarea w-full"
                rows={6}
                value={answer}
                onChange={e => { setAnswer(e.target.value); setShortWarning(false) }}
                placeholder={
                  recording && speechSupported
                    ? 'Listening… your words will appear here as you speak'
                    : mmStatus === 'online'
                    ? 'Type your answer here, or hit the mic to record…'
                    : 'Type your answer here…'
                }
              />

              {/* Short answer warning */}
              {shortWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-sm font-bold text-amber-800 mb-1">
                    ⚠️ This doesn't look like a full answer
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">
                    Your answer is very short or seems like a placeholder. You'll get a low score. Try giving a real response for useful feedback.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-2 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold transition-colors"
                      onClick={() => setShortWarning(false)}
                    >
                      Edit my answer
                    </button>
                    <button
                      className="flex-1 py-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-semibold transition-colors"
                      onClick={() => { setShortWarning(false); submitAnswer(true) }}
                    >
                      Submit anyway
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  className="btn btn-accent btn-lg flex-1"
                  onClick={submitAnswer}
                  disabled={submitting || (!answer.trim() && !audioBlobRef.current)}
                >
                  {submitting ? <Spinner light /> : 'Submit answer →'}
                </button>
                <button className="btn btn-ghost" onClick={endInterview} disabled={ending}>
                  End session
                </button>
              </div>
            </div>
          )}

          {/* Evaluation card */}
          {evaluation && (
            <>
              <EvaluationCard evaluation={evaluation} />
              <div className="flex gap-3 mt-6">
                <button className="btn btn-accent btn-lg" onClick={nextQuestion}>
                  Next question →
                </button>
                <button className="btn btn-ghost" onClick={endInterview} disabled={ending}>
                  {ending ? <Spinner size="sm" /> : 'End & get results'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ Sidebar ═════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-surface-4 bg-white p-5 space-y-4 overflow-y-auto">

        <ThetaMeter
          theta={theta}
          abilityLevel={abilityLevel}
          showHistory
          history={thetaHistory}
        />

        {/* Session info */}
        <div className="bg-surface-2 rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-2">Session</div>
          {[
            { label: 'Role',       val: role,       green: false },
            { label: 'Question',   val: questionNum, green: false },
            { label: 'Adaptation', val: 'Active',   green: true  },
          ].map(({ label, val, green }) => (
            <div key={label} className="flex justify-between items-center text-sm">
              <span className="text-ink-4">{label}</span>
              <span className={`font-medium flex items-center gap-1.5 ${green ? 'text-emerald-600' : 'text-ink'}`}>
                {green && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Multimodal section */}
        {mmData ? (
          <MultimodalPanel data={mmData} />
        ) : mmError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-sm font-bold text-red-700 mb-1">⚠️ Delivery analysis failed</div>
            <p className="text-xs text-red-600 leading-relaxed">{mmError}</p>
            <p className="text-[10px] text-red-500 mt-2">Check that the multimodal service is still running on port 8001.</p>
          </div>
        ) : submitting && audioBlobRef.current ? (
          <div className="bg-surface-2 rounded-xl p-4 flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-xs text-ink-4">Analysing your delivery…</span>
          </div>
        ) : mmStatus === 'checking' ? (
          <div className="bg-surface-2 rounded-xl p-4 flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-xs text-ink-4">Checking delivery analysis service…</span>
          </div>
        ) : mmStatus === 'online' ? (
          <MultimodalReadyCard />
        ) : (
          <MultimodalOfflineCard
            onRetry={checkMmService}
            checking={mmStatus === 'checking'}
          />
        )}
      </div>
    </div>
  )
}
