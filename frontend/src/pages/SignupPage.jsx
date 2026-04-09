import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'

export default function SignupPage() {
  const { signup, login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      await signup(form.name, form.email, form.password)
      // Auto-login after signup
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-2 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-ink p-12">
        <Link to="/" className="font-display text-2xl font-black text-white tracking-tight">
          prep<span className="text-brand-500">AI</span>
        </Link>
        <div className="space-y-6">
          {[
            { icon: '🧠', text: 'Adaptive difficulty using IRT — questions match your exact ability level' },
            { icon: '🎙️', text: 'Voice analysis: pace, filler words, STAR structure, vocabulary richness' },
            { icon: '📊', text: '6-dimension rubric scoring with anchor-calibrated few-shot grading' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                {icon}
              </div>
              <p className="text-white/70 text-sm leading-relaxed pt-1.5">{text}</p>
            </div>
          ))}
        </div>
        <div className="text-white/20 text-xs">© {new Date().getFullYear()} prepAI</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-slide-up">
          <Link to="/" className="lg:hidden block font-display text-xl font-black mb-10">
            prep<span className="text-brand-500">AI</span>
          </Link>

          <h1 className="font-display text-3xl font-black tracking-tight mb-1">Create account</h1>
          <p className="text-ink-3 text-sm mb-8">Start practising smarter today — it's free</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="Alex Johnson"
                value={form.name}
                onChange={set('name')}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn btn-accent btn-lg w-full"
              disabled={loading}
            >
              {loading ? <Spinner light /> : 'Create account →'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-3 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-500 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
