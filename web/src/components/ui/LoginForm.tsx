import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { Tabs } from './Tabs'
import { sendMagicLink, signInWithPassword, signUpWithPassword, verifyEmailCode } from '../../data/supabase'
import { checkNewPassword } from '../../data/editors'
import { useDataStore } from '../../store/data'

/** Email + password (or email link) sign-in. Shared by the cloud panel and the sidebar dialog. */
export function LoginForm({ onDone, autoFocus, intro }: { onDone?: () => void; autoFocus?: boolean; intro?: string }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [invite, setInvite] = useState('')
  const claimWithCode = useDataStore((s) => s.claimWithCode)
  const [mode, setMode] = useState<'password' | 'signup' | 'link'>('password')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>, ok: string, done = false) => {
    setBusy(true); setMsg(null)
    try { await fn(); setMsg(ok); if (done) onDone?.() } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <form className="flex flex-col gap-2.5 text-[13px]" onSubmit={(e) => {
      e.preventDefault()
      if (mode === 'password') void run(() => signInWithPassword(email.trim(), password), '登入成功', true)
      else if (mode === 'signup') {
        const bad = checkNewPassword(password, again) ?? (invite.replace(/[^A-Za-z0-9]/g, '').length < 10 ? '請輸入紀錄員給你的 10 碼邀請碼' : null)
        if (bad) setMsg(bad)
        else void run(async () => {
          await signUpWithPassword(email.trim(), password)
          // the 邀請碼 binds this new account as the recorder for the email (without it the account can only browse)
          const a = await claimWithCode(invite)
          if (a !== 'ok') throw new Error(a === 'bad_code' ? '密碼已設定，但邀請碼不對：請在下方重新輸入' : a === 'expired' ? '密碼已設定，但邀請碼已過期：請紀錄員重發' : a === 'not_listed' ? '密碼已設定，但這個 email 不在紀錄員名單' : '密碼已設定，但還沒啟用紀錄員權限：請在下方輸入邀請碼')
        }, '已設定密碼並啟用紀錄員權限', true)
      } else void run(async () => { await sendMagicLink(email.trim()); setSent(true) }, '已寄出登入信，請開啟信中的連結（或輸入信中的 6 位數驗證碼）。')
    }}>
      <p className="text-muted">{intro ?? '紀錄員登入後才能紀錄與上傳；瀏覽不需登入。'}</p>
      <Tabs size="sm" aria-label="登入方式" value={mode} onChange={setMode} items={[{ value: 'password', label: '密碼登入' }, { value: 'signup', label: '第一次使用' }, { value: 'link', label: 'Email 連結' }]} className="self-start" />
      <Input type="email" required autoComplete="username" placeholder="紀錄員 email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="email" autoFocus={autoFocus} />
      {mode === 'password' ? (
        <>
          <Input type="password" required autoComplete="current-password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="密碼" />
          <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? '登入中…' : '登入'}</Button>
          <p className="text-xs text-muted">第一次登入請先選「第一次使用」設定密碼；忘記密碼請找管理員。</p>
        </>
      ) : mode === 'signup' ? (
        <>
          <Input required value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="邀請碼（紀錄員新增你時拿到的 10 碼）" aria-label="邀請碼" autoComplete="one-time-code" className="tnum tracking-wider" />
          <Input type="password" required autoComplete="new-password" placeholder="設定密碼（至少 8 個字元）" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="設定密碼" />
          <Input type="password" required autoComplete="new-password" placeholder="再輸入一次密碼" value={again} onChange={(e) => setAgain(e.target.value)} aria-label="再輸入一次密碼" />
          <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? '設定中…' : '設定密碼並登入'}</Button>
          <p className="text-xs text-muted">請先請紀錄員在「紀錄員名單」加入你的 email，他會拿到一組邀請碼給你；沒有邀請碼的帳號只能瀏覽。</p>
        </>
      ) : (
        <>
          <Button type="submit" variant="primary" disabled={busy} className="w-full">寄送登入連結</Button>
          {sent && (
            <div className="flex gap-2">
              <Input inputMode="numeric" placeholder="6 位數驗證碼" value={code} onChange={(e) => setCode(e.target.value)} className="tnum" aria-label="驗證碼" />
              <Button disabled={busy || code.length < 6} onClick={() => void run(() => verifyEmailCode(email.trim(), code.trim()), '登入成功', true)}>驗證</Button>
            </div>
          )}
          <p className="text-xs text-muted">免費方案每小時只能寄 2 封信；被限制時請改用密碼登入。</p>
        </>
      )}
      {msg && <div role="status" className="text-xs text-ink-2">{msg}</div>}
    </form>
  )
}
