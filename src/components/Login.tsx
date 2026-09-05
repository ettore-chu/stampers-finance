import { useState } from 'react'
import { supabase, FOUNDER_EMAIL } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState(FOUNDER_EMAIL)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 380, width: '100%' }}>
        <p style={{ fontSize: 11.5, letterSpacing: '.08em', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 10px' }}>
          주식회사 스탬퍼스
        </p>
        <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>재무 콘솔</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, margin: '0 0 20px' }}>
          대표자 전용 도구입니다. 이메일로 로그인 링크를 보내드립니다.
        </p>
        {sent ? (
          <p style={{ fontSize: 13.5, color: 'var(--accent)', lineHeight: 1.7 }}>
            {email} 주소로 로그인 링크를 보냈습니다. 메일함을 확인해 링크를 클릭하세요.
          </p>
        ) : (
          <form onSubmit={sendLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '전송 중…' : '로그인 링크 보내기'}
            </button>
            {error && <p style={{ fontSize: 12.5, color: 'var(--critical)' }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
