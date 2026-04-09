import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard',       icon: '▦', label: 'Dashboard'    },
  { to: '/interview/start', icon: '⊕', label: 'New Interview' },
  { to: '/history',         icon: '◷', label: 'History'      },
  { to: '/profile',         icon: '◉', label: 'Profile'      },
]

export function DashboardLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    // Full viewport height, no overflow on the root — children manage their own scroll
    <div className="h-screen flex overflow-hidden">

      {/* ── Sidebar ── fixed height, never scrolls ───────────────────────── */}
      <aside className="w-60 shrink-0 h-screen bg-white border-r border-surface-4 flex flex-col">
        {/* Logo */}
        <div className="h-16 shrink-0 flex items-center px-6 border-b border-surface-4">
          <span className="font-display text-xl font-black tracking-tight">
            prep<span className="text-brand-500">AI</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-ink-3 hover:text-ink hover:bg-surface-2'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User block — pinned to bottom */}
        <div className="shrink-0 p-3 border-t border-surface-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
              <div className="text-xs text-ink-4 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="w-full mt-1 text-left px-3 py-2 text-xs text-ink-4 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── scrolls independently of sidebar ─────────────── */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-surface-2">
        {/* Top padding so the first card is never clipped at the viewport edge */}
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
