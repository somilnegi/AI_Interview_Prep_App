import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🧠',
    title: 'Adaptive Difficulty (IRT)',
    desc: 'Questions adapt in real-time using 2-Parameter Logistic Item Response Theory. Your ability estimate (θ) updates after every answer via Newton–Raphson MLE.',
  },
  {
    icon: '🎙️',
    title: 'Multimodal Delivery Analysis',
    desc: 'Your voice is analysed for pace (WPM), pitch variance, filler words, hedging phrases, and vocabulary richness using librosa + spaCy.',
  },
  {
    icon: '⭐',
    title: 'STAR Structure Detection',
    desc: 'AI automatically detects Situation → Task → Action → Result compliance using NLP keyword matching — a key signal for behavioural interviews.',
  },
  {
    icon: '📊',
    title: '6-Dimension Rubric Scoring',
    desc: 'Every answer scored on clarity, depth, relevance, communication, STAR structure, and specificity with anchor-calibrated few-shot prompting.',
  },
  {
    icon: '📄',
    title: 'Resume-Based Personalisation',
    desc: 'Upload your CV and every question is tailored to your actual experience, tech stack, and projects — exactly like a real technical interview.',
  },
  {
    icon: '🎯',
    title: 'Job Description Analyser',
    desc: 'Paste any job posting to extract required skills, get tailored practice questions, and a readiness checklist specific to that exact role.',
  },
]

const STEPS = [
  { n: '01', title: 'Create account', desc: 'Upload your CV and let the system learn your background.' },
  { n: '02', title: 'Choose your role', desc: 'Pick a role or paste a JD for skill-targeted questions.' },
  { n: '03', title: 'Practice & speak', desc: 'Answer verbally or in text. Difficulty adapts live.' },
  { n: '04', title: 'Review & improve', desc: 'Get rubric scores, delivery analysis, and model answers.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-2">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-surface-2/90 backdrop-blur-md border-b border-surface-4">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-black tracking-tight">
            prep<span className="text-brand-500">AI</span>
          </span>
          <div className="flex items-center gap-3">
            <Link to="/login"  className="btn btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn btn-accent">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-14 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 text-xs font-semibold text-brand-600 mb-8">
            ✦ IRT-Powered Adaptive Interview Coach
          </div>
          <h1 className="font-display text-[clamp(42px,6vw,72px)] font-black leading-[1.0] tracking-tight text-ink mb-6">
            Ace your next<br />
            <span className="text-brand-500">interview</span><br />
            with AI
          </h1>
          <p className="text-lg text-ink-3 leading-relaxed font-light max-w-md mb-10">
            The only interview coach that adapts to your ability in real-time, analyses how you speak, and gives research-grade feedback on every answer.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/signup" className="btn btn-accent btn-lg">Start practising free →</Link>
            <Link to="/login"  className="btn btn-ghost btn-lg">Sign in</Link>
          </div>
        </div>

        {/* Hero card */}
        <div className="animate-fade-in bg-white rounded-2xl border border-surface-4 p-6 shadow-xl">
          <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-3">Live session preview</div>
          <div className="font-display text-base font-bold leading-snug mb-5">
            "Describe a time you resolved a conflict within your engineering team."
          </div>
          {[
            { label: 'Clarity',        val: 85 },
            { label: 'STAR Structure', val: 92 },
            { label: 'Specificity',    val: 78 },
          ].map(({ label, val }) => (
            <div key={label} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-3">{label}</span>
                <span className="font-semibold">{val}%</span>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${val}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-5 p-3 bg-brand-50 rounded-xl text-sm text-brand-700 font-medium">
            🎙️ Delivery score: <strong>8.2/10</strong> · 138 WPM · 2 fillers · θ = 1.24
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-ink py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-white/10">
          {[
            { num: '6×',   label: 'rubric dimensions' },
            { num: '3',    label: 'signal sources fused' },
            { num: '2PL',  label: 'IRT model' },
            { num: '∞',    label: 'adaptive questions' },
          ].map(({ num, label }) => (
            <div key={label} className="text-center py-2 px-6">
              <div className="font-display text-4xl font-black text-white tracking-tight">{num}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="mb-14">
          <div className="section-tag">What makes us different</div>
          <h2 className="font-display text-[clamp(28px,4vw,44px)] font-black tracking-tight mb-4">
            Research-grade interview science
          </h2>
          <p className="text-ink-3 text-lg max-w-lg leading-relaxed">
            Built on Item Response Theory, multimodal NLP, and calibrated rubric scoring — not just a chatbot.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-surface-4 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
            >
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center text-2xl mb-5">
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-ink-3 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-ink py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16">
            <div className="section-tag" style={{ color: '#ff6b35' }}>How it works</div>
            <h2 className="font-display text-[clamp(28px,4vw,44px)] font-black tracking-tight text-white">
              From signup to job offer
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-black mb-5 ${
                    i === 0
                      ? 'bg-brand-500 text-white'
                      : 'bg-white/10 text-white/60 border border-white/10'
                  }`}
                >
                  {s.n}
                </div>
                <h3 className="font-display font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="section-tag">Get started today</div>
        <h2 className="font-display text-[clamp(28px,4vw,44px)] font-black tracking-tight mb-4">
          Ready to practise smarter?
        </h2>
        <p className="text-ink-3 text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Join candidates who use data-driven feedback to land their dream roles.
        </p>
        <Link to="/signup" className="btn btn-accent btn-lg">
          Create free account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-4 py-8">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center text-sm text-ink-4">
          <span className="font-display font-black text-ink">
            prep<span className="text-brand-500">AI</span>
          </span>
          <span>Adaptive interview coaching powered by IRT & multimodal AI</span>
        </div>
      </footer>
    </div>
  )
}
