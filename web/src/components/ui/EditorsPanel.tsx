import { useCallback, useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { Card } from './Card'
import { Button } from './Button'
import { Field, Input } from './Input'
import { addEditor, listEditors, removeEditor } from '../../data/supabase'
import { checkEditorEmail, type Editor } from '../../data/editors'
import { useDataStore } from '../../store/data'

/** 紀錄員名單: recorders add and remove recorders here (no Supabase dashboard). Shown only to signed-in recorders. */
export function EditorsPanel() {
  const cloud = useDataStore((s) => s.cloud)
  const me = cloud.user?.email?.toLowerCase() ?? ''
  const show = cloud.configured && !!cloud.user && cloud.isEditor
  const [editors, setEditors] = useState<Editor[] | null>(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try { setEditors(await listEditors()) } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { if (show) void reload() }, [show, reload])
  if (!show) return null

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); setMsg(ok); await reload() } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const add = () => {
    const checked = checkEditorEmail(email, editors ?? [])
    if ('error' in checked) { setMsg(checked.error); return }
    void run(async () => { await addEditor(checked.email, note); setEmail(''); setNote('') },
      `已新增 ${checked.email}。請對方打開這個網站的「資料匯入」，選「第一次使用」設定密碼。`)
  }

  return (
    <Card title="紀錄員名單" subtitle="名單內的人登入後才能紀錄與修改">
      <div className="flex flex-col gap-3 text-[13px]">
        <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-sm)] border border-border">
          {editors === null && <li className="px-3 py-2.5 text-muted">載入中…</li>}
          {editors?.map((e) => (
            <li key={e.email} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-ink">{e.email}{e.email.toLowerCase() === me && <span className="text-muted">（你）</span>}</div>
                {e.note && <div className="truncate text-xs text-muted">{e.note}</div>}
              </div>
              {e.email.toLowerCase() !== me && (
                <Button size="sm" variant="ghost" icon={<Trash2 />} aria-label={`移除 ${e.email}`} disabled={busy}
                  onClick={() => { if (window.confirm(`確定把 ${e.email} 移出紀錄員名單？對方之後只能瀏覽。`)) void run(() => removeEditor(e.email), `已移除 ${e.email}`) }}>移除</Button>
              )}
            </li>
          ))}
        </ul>
        <form className="flex flex-col gap-2" onSubmit={(ev) => { ev.preventDefault(); add() }}>
          <Field label="新增紀錄員"><Input type="email" placeholder="email" value={email} onChange={(ev) => setEmail(ev.target.value)} aria-label="新紀錄員 email" /></Field>
          <Input placeholder="備註（例：大一紀錄員）" value={note} onChange={(ev) => setNote(ev.target.value)} aria-label="備註" />
          <Button type="submit" size="sm" icon={<UserPlus />} disabled={busy || !email.trim()} className="self-start">新增</Button>
        </form>
        <p className="text-xs text-muted leading-relaxed">新增後，請對方用同一個 email 在登入框選「第一次使用」設定密碼。不能移除自己，所以名單不會變成空的。</p>
        {msg && <div role="status" className="text-xs text-ink-2">{msg}</div>}
      </div>
    </Card>
  )
}
