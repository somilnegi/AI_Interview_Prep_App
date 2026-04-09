import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password')
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
        <div>
          <blockquote className="font-display text-3xl font-bold text-white leading-snug mb-6">
            "The only tool that adapts to <span className="text-brand-400">your</span> ability in real-time."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div>
              <div className="text-white text-sm font-medium">Adaptive Intelligence</div>
              <div className="text-white/40 text-xs">Powered by 2PL IRT</div>
            </div>
          </div>
        </div>
        <div className="text-white/20 text-xs">© {new Date().getFullYear()} prepAI</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden block font-display text-xl font-black mb-10">
            prep<span className="text-brand-500">AI</span>
          </Link>

          <h1 className="font-display text-3xl font-black tracking-tight mb-1">Welcome back</h1>
          <p className="text-ink-3 text-sm mb-8">Sign in to continue your practice</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-accent btn-lg w-full"
              disabled={loading}
            >
              {loading ? <Spinner light /> : 'Sign in →'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-3 text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-500 font-semibold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
