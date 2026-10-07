/**
 * 紀錄員名單 (the `editors` table): who may write. Editors manage it on the site; a new recorder is added by email,
 * then sets their own password with 「第一次使用」 on the sign-in form. Nobody needs the Supabase dashboard.
 */
export interface Editor { email: string; note: string | null; created_at: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The email as stored (trimmed, lower-case), or an error message to show. */
export function checkEditorEmail(raw: string, existing: Editor[]): { email: string } | { error: string } {
  const email = raw.trim().toLowerCase()
  if (!email) return { error: '請輸入 email' }
  if (!EMAIL.test(email)) return { error: 'email 格式不對' }
  if (existing.some((e) => e.email.toLowerCase() === email)) return { error: '這個 email 已經在名單裡' }
  return { email }
}

/** Sign-up form: what is wrong with the password pair, or null. Supabase's minimum is 6 characters. */
export function checkNewPassword(password: string, again: string): string | null {
  if (password.length < 6) return '密碼至少 6 個字元'
  if (password !== again) return '兩次輸入的密碼不一樣'
  return null
}
