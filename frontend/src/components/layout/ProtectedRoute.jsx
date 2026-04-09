import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/** Redirect to /login if not authenticated */
export function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Redirect to /dashboard if already logged in */
export function PublicRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}
