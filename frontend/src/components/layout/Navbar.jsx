import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 bg-surface-2/90 backdrop-blur-md border-b border-surface-4">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={user ? '/dashboard' : '/'} className="font-display text-xl font-black tracking-tight">
          prep<span className="text-brand-500">AI</span>
        </Link>

        {/* Nav links (authenticated) */}
        {user && (
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/dashboard',  label: 'Dashboard' },
              { to: '/history',    label: 'History'   },
              { to: '/profile',    label: 'Profile'   },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-3 hover:text-ink hover:bg-surface-3'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm text-ink-3">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span>{user.name}</span>
              </div>
              <button className="btn-ghost btn-sm btn" onClick={handleLogout}>
                Sign out
              </button>
              <Link to="/interview/start" className="btn-accent btn">
                + New interview
              </Link>
            </>
          ) : (
            <>
              <Link to="/login"  className="btn-ghost btn">Sign in</Link>
              <Link to="/signup" className="btn-accent btn">Get started free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
