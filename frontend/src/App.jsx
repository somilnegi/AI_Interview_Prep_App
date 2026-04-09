import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, PublicRoute } from './components/layout/ProtectedRoute'

import LandingPage         from './pages/LandingPage'
import LoginPage           from './pages/LoginPage'
import SignupPage          from './pages/SignupPage'
import DashboardPage       from './pages/DashboardPage'
import ProfilePage         from './pages/ProfilePage'
import HistoryPage         from './pages/HistoryPage'
import InterviewDetailPage from './pages/InterviewDetailPage'
import StartInterviewPage  from './pages/StartInterviewPage'
import InterviewPage       from './pages/InterviewPage'
import ResultsPage         from './pages/ResultsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />

        {/* ── Protected routes ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <InterviewDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/start"
          element={
            <ProtectedRoute>
              <StartInterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/:interviewId"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
