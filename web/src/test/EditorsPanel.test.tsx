import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Editor } from '../data/editors'

let rows: Editor[] = []
const addEditor = vi.fn(async (email: string, note: string) => { rows = [...rows, { email, note, created_at: '2026-10-07T00:00:00Z' }] })
const removeEditor = vi.fn(async (email: string) => { rows = rows.filter((r) => r.email !== email) })
vi.mock('../data/supabase', async (orig) => ({
  ...(await orig<typeof import('../data/supabase')>()),
  listEditors: vi.fn(async () => rows),
  addEditor: (email: string, note: string) => addEditor(email, note),
  removeEditor: (email: string) => removeEditor(email),
}))
const { EditorsPanel } = await import('../components/ui/EditorsPanel')
const { useDataStore } = await import('../store/data')

const signedIn = (isEditor: boolean) => useDataStore.setState({
  cloud: { configured: true, status: 'ready', error: null, user: { id: 'u1', email: 'Coach@gmail.com' } as never, lastSync: null, pushing: false, isEditor },
})

describe('紀錄員名單', () => {
  beforeEach(() => {
    rows = [{ email: 'coach@gmail.com', note: '管理員', created_at: '2026-10-01T00:00:00Z' }, { email: 'old@gmail.com', note: null, created_at: '2026-10-02T00:00:00Z' }]
    addEditor.mockClear(); removeEditor.mockClear()
  })

  it('is hidden from people who are not recorders', () => {
    signedIn(false)
    const { container } = render(<EditorsPanel />)
    expect(container.textContent).toBe('')
  })

  it('lists recorders; you can remove others but not yourself', async () => {
    signedIn(true)
    render(<EditorsPanel />)
    expect(await screen.findByText('old@gmail.com')).toBeTruthy()
    expect(screen.getByText('（你）')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '移除 coach@gmail.com' })).toBeNull()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '移除 old@gmail.com' }))
    expect(await screen.findByText('已移除 old@gmail.com')).toBeTruthy()
    expect(removeEditor).toHaveBeenCalledWith('old@gmail.com')
  })

  it('adds a recorder by email, lower-cased, and refuses duplicates', async () => {
    signedIn(true)
    render(<EditorsPanel />)
    await screen.findByText('old@gmail.com')
    fireEvent.change(screen.getByLabelText('新紀錄員 email'), { target: { value: 'OLD@gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: '新增' }))
    expect(screen.getByRole('status').textContent).toBe('這個 email 已經在名單裡')
    expect(addEditor).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('新紀錄員 email'), { target: { value: ' New@Gmail.com ' } })
    fireEvent.change(screen.getByLabelText('備註'), { target: { value: '大一' } })
    fireEvent.click(screen.getByRole('button', { name: '新增' }))
    expect(await screen.findByText('new@gmail.com')).toBeTruthy()
    expect(addEditor).toHaveBeenCalledWith('new@gmail.com', '大一')
  })
})
