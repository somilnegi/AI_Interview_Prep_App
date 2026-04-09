// Replace the whole file content with this:
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
const GROQ_BASE    = 'https://api.groq.com/openai/v1'

async function groqRequest(messages, stream = false) {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, stream, temperature: 0 }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq error ${res.status}: ${text}`)
  }
  return res
}

export async function chat(messages) {
  const res  = await groqRequest(messages, false)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from Groq')
  return content.trim()
}

export async function chatStream(messages, res) {
  const groqRes = await groqRequest(messages, true)
  let fullText  = ''
  const decoder = new TextDecoder()

  for await (const chunk of groqRes.body) {
    const lines = decoder.decode(chunk).split('\n').filter(Boolean)
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') { res.write('data: [DONE]\n\n'); res.end(); return fullText }
      try {
        const parsed = JSON.parse(payload)
        const token  = parsed?.choices?.[0]?.delta?.content ?? ''
        if (token) { fullText += token; res.write(`data: ${JSON.stringify(token)}\n\n`) }
      } catch {}
    }
  }
  res.write('data: [DONE]\n\n')
  res.end()
  return fullText
}