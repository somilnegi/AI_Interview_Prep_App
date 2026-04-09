import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const MULTIMODAL_BASE = import.meta.env.VITE_MULTIMODAL_URL || 'http://localhost:8001'

const api = axios.create({ baseURL: API_BASE })

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login:  (data) => api.post('/auth/login', data),
}

// ─── Resume ───────────────────────────────────────────────────────────────────
export const resumeAPI = {
  upload: (file) => {
    const fd = new FormData()
    fd.append('resume', file)
    return api.post('/resume/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: () => api.delete('/resume'),
  status: () => api.get('/resume/status'),
}

// ─── Interview ────────────────────────────────────────────────────────────────
export const interviewAPI = {
  start:        (data)        => api.post('/interview/start', data),
  evaluate:     (data)        => api.post('/interview/evaluate', data),
  end:          (interviewId) => api.post('/interview/end', { interviewId }),
  getOne:       (id)          => api.get(`/interview/${id}`),
  history:      ()            => api.get('/interview/history'),
  stats:        ()            => api.get('/interview/stats'),
  nextQuestion: (interviewId) => api.post('/interview/next-question', { interviewId }),
}

// ─── Job Description ──────────────────────────────────────────────────────────
export const jdAPI = {
  analyze:     (data) => api.post('/job-description/analyze', data),
  startFromJD: (data) => api.post('/job-description/start-from-jd', data),
}

// ─── Multimodal (FastAPI sidecar on port 8001) ────────────────────────────────
export const multimodalAPI = {
  analyse: async (audioBlob, transcript = '') => {
    const fd = new FormData()
    // Set correct file extension based on actual mime type so ffmpeg
    // in multimodal_service.py picks the right decoder
    const ext = audioBlob.type.includes('ogg') ? 'ogg'
              : audioBlob.type.includes('wav') ? 'wav'
              : 'webm'
    fd.append('audio', audioBlob, `answer.${ext}`)
    // transcript must be a Form field (not JSON) because the FastAPI endpoint
    // mixes File() and Form() — requires explicit Form() on the Python side
    fd.append('transcript', transcript || '')
    const res = await fetch(`${MULTIMODAL_BASE}/analyse`, { method: 'POST', body: fd })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody?.detail || 'Multimodal analysis failed')
    }
    return res.json()
  },
  health: () => fetch(`${MULTIMODAL_BASE}/health`).then((r) => r.json()),
}

// ─── SSE helper for streaming questions ───────────────────────────────────────
export function streamQuestion(interviewId, onToken, onDone, onError) {
  const token = localStorage.getItem('token')
  const url   = `${API_BASE}/interview/next-question-stream/${interviewId}`

  // EventSource doesn't support custom headers so we use fetch + ReadableStream
  const controller = new AbortController()

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal:  controller.signal,
  })
    .then(async (res) => {
      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let full     = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = dec.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]')     { onDone(full); return }
          if (payload === '[FINISHED]') { onDone(null); return }
          try {
            const chunk = JSON.parse(payload)
            full += chunk
            onToken(full)
          } catch {}
        }
      }
      onDone(full)
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err)
    })

  return () => controller.abort()
}

export default api
