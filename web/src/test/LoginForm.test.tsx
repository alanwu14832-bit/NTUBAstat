import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

const signUp = vi.fn(async (_email: string, _password: string) => {})
vi.mock('../data/supabase', () => ({
  sendMagicLink: vi.fn(), signInWithPassword: vi.fn(), verifyEmailCode: vi.fn(),
  signUpWithPassword: (email: string, password: string) => signUp(email, password),
}))
const { LoginForm } = await import('../components/ui/LoginForm')

describe('LoginForm 第一次使用', () => {
  beforeEach(() => signUp.mockClear())

  it('checks the password pair before asking the server', () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByRole('tab', { name: '第一次使用' }))
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'new@gmail.com' } })
    fireEvent.change(screen.getByLabelText('設定密碼'), { target: { value: 'abcdef' } })
    fireEvent.change(screen.getByLabelText('再輸入一次密碼'), { target: { value: 'abcdeg' } })
    fireEvent.click(screen.getByRole('button', { name: '設定密碼並登入' }))
    expect(screen.getByRole('status').textContent).toBe('兩次輸入的密碼不一樣')
    expect(signUp).not.toHaveBeenCalled()
  })

  it('creates the account with the trimmed email', async () => {
    const done = vi.fn()
    render(<LoginForm onDone={done} />)
    fireEvent.click(screen.getByRole('tab', { name: '第一次使用' }))
    fireEvent.change(screen.getByLabelText('email'), { target: { value: ' new@gmail.com ' } })
    fireEvent.change(screen.getByLabelText('設定密碼'), { target: { value: 'abcdef' } })
    fireEvent.change(screen.getByLabelText('再輸入一次密碼'), { target: { value: 'abcdef' } })
    fireEvent.click(screen.getByRole('button', { name: '設定密碼並登入' }))
    expect(await screen.findByText('密碼已設定並登入')).toBeTruthy()
    expect(signUp).toHaveBeenCalledWith('new@gmail.com', 'abcdef')
    expect(done).toHaveBeenCalled()
  })
})
