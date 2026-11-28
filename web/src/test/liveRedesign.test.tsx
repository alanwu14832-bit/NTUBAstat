/**
 * 即時比分 redesign A+D (2026-11-28, after MLB Gameday, CPBL's and NPB's live text): the 本打席 card under the board, the
 * 文字轉播 with half-inning chips, a 安打 filter, every plate appearance's pitches as chips and the ball's path when opened,
 * 得分經過 and 今日投手 beside it, the score bar that stays on top of a phone, and the FINAL board between games.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LivePage } from '../pages/Live'
import { writeDraft } from '../record/draft'
import { addPitch, commitPA, defaultPlan, newGame, type PAPlan, type RecordState } from '../record/model'
import { useDataStore } from '../store/data'
import { EMPTY_DATASET, type BattingPA, type Dataset, type Game } from '../data/types'

const NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬']
const GAME: Game = { id: 'G20261128-01', date: '2026-11-28', tournament: '系際盃', opponent: '對手', homeAway: '客', innings: 7, venue: '台大棒球場' }
const start = () => newGame(GAME, NAMES.map((name, i) => ({ name, pos: i === 8 ? 'P' : 'DH' })), '壬')
const pitch = (s: RecordState, ps: string[]) => ps.reduce((a, p) => addPitch(a, p), s)
const pa = (s: RecordState, ps: string[], result: string, edit?: (p: PAPlan) => void) => { s = pitch(s, ps); const plan = defaultPlan(s, result); edit?.(plan); return commitPA(s, plan) }
const show = (s: RecordState, base: Dataset = EMPTY_DATASET) => {
  writeDraft(s)
  useDataStore.setState({ base })
  render(<MemoryRouter><LivePage /></MemoryRouter>)
}
// 1▲: 甲 singles to center, 乙 homers to left (2 runs), 丙 strikes out, 丁 and 戊 fly out; 1▼: their leadoff man flies
// out; 2 balls to the next one
const game = () => {
  let s = start()
  s = pa(s, ['B', 'IP'], '一安', (p) => { p.loc = 8; p.traj = 'L' })
  s = pa(s, ['S', 'IP'], '全壘打', (p) => { p.loc = 7; p.traj = 'F'; p.quality = '強' })
  s = pa(s, ['S', 'S', 'SS'], '三振')
  s = pa(s, ['IP'], '外飛', (p) => { p.loc = 9; p.traj = 'F' })
  s = pa(s, ['IP'], '外飛', (p) => { p.loc = 8; p.traj = 'F' })
  s = pa(s, ['IP'], '外飛', (p) => { p.loc = 7; p.traj = 'F' })
  return pitch(s, ['B', 'B'])
}

let observed: Array<(entries: Array<Partial<IntersectionObserverEntry>>) => void> = []
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {}
  // (jsdom has no IntersectionObserver: a stand-in the test can fire)
  class IO { constructor(cb: (e: Array<Partial<IntersectionObserverEntry>>) => void) { observed.push(cb) } observe() {} disconnect() {} unobserve() {} takeRecords() { return [] } }
  vi.stubGlobal('IntersectionObserver', IO)
})
afterEach(() => { writeDraft(null); observed = []; try { localStorage.clear() } catch { /* none */ } })

const feedCard = async () => (await screen.findByText('文字轉播', { selector: 'h2' })).closest('section')!

describe('本打席 card under the board', () => {
  it('batter and pitcher, every pitch with the count after it, who is on base and who is up next', async () => {
    show(game())
    const card = (await screen.findByText('本打席', { selector: 'h2' })).closest('section')!
    expect(within(card).getByText('1局下・1 出局')).toBeTruthy()
    expect(within(card).getByText('投手', { selector: 'span' }).nextElementSibling?.textContent).toBe('壬')
    const rows = within(within(card).getByRole('table', { name: '本打席 2 球' })).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['1壞球1-0未測', '2壞球2-0未測'])
    expect(within(card).getByText('下一棒', { selector: 'span' }).nextElementSibling?.textContent).toBe('第 3、4 棒')
  })
})

describe('文字轉播 (D)', () => {
  it('half-inning chips jump to a half; the halves still to come are dashed', async () => {
    show(game())
    const card = await feedCard()
    const nav = within(card).getByRole('navigation', { name: '跳到某一局' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['1上', '1下'])
    // 2上 … 7下: twelve halves not reached yet
    expect(nav.querySelectorAll('span[aria-hidden].border-dashed')).toHaveLength(12)
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    // (一局上 starts open as one of the two newest halves: close it, then jump back to it)
    const head = within(card).getByText('一局上 我隊進攻').closest('button')!
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(within(nav).getByRole('button', { name: '跳到一局上' }))
    expect(head.getAttribute('aria-expanded')).toBe('true')
    await waitFor(() => expect(spy).toHaveBeenCalled())
    spy.mockRestore()
  })

  it('安打 keeps the hits; each plate appearance shows its pitches as chips with the count after each', async () => {
    show(game())
    const card = await feedCard()
    expect(within(card).getByLabelText('3 球：好球 0-1、好球 0-2、揮棒落空 0-3')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: '安打' }))
    await waitFor(() => expect(within(card).queryByText(/揮棒落空，三振出局/)).toBeNull())
    expect(within(card).getByText(/一壘安打/)).toBeTruthy()
    expect(within(card).getByText(/全壘打/, { selector: 'span.min-w-0' })).toBeTruthy()
    expect(localStorage.getItem('bafin.live.feedFilter')).toBe('hits')
  })

  it('a plate appearance opened: every pitch, and where the ball went on the small field', async () => {
    show(game())
    const card = await feedCard()
    fireEvent.click(within(card).getByText(/全壘打，2 分打點/).closest('button')!)
    expect(within(card).getByRole('img', { name: '擊球，方向 左外野（7），高飛球，強度 強勁' })).toBeTruthy()
    // the scoring play: 得分 +2 and the score after it
    expect(within(card).getAllByText('得分 +2').length).toBeGreaterThan(0)
    expect(within(card).getByLabelText('比分 客 2 比 主 0')).toBeTruthy()
    // the finished half: its score when it ended
    expect(within(card).getByLabelText('一局上結束 客 2 比 主 0')).toBeTruthy()
  })
})

describe('得分經過 and 今日投手 beside the feed', () => {
  it('the scoring play with the score after it; our pitcher on the mound, the opponent pitcher\'s count', async () => {
    show(game())
    const scoring = (await screen.findByText('得分經過', { selector: 'h2' })).closest('section')!
    expect(within(scoring).getByText(/乙 擊出左外野高飛球，全壘打/)).toBeTruthy()
    expect(within(scoring).getByLabelText('得分後 客 2 比 主 0')).toBeTruthy()
    const pitchers = screen.getByText('今日投手', { selector: 'h2' }).closest('section')!
    const ours = within(pitchers).getByText('壬').closest('tr')!
    // 0.1 局, 3 球 (the fly out's 1 and the two balls to the batter now), 0 失分, 0 三振
    expect(ours.textContent).toBe('壬投球中0.1300')
    expect(within(pitchers).getByText(/^\d+ 球/).textContent).toBe('9 球')
  })
})

describe('the score bar on top of a phone', () => {
  it('shows once the board has scrolled away, and goes back to it when tapped', async () => {
    show(game())
    await screen.findByText('本打席', { selector: 'h2' })
    expect(screen.queryByRole('button', { name: /回到計分板/ })).toBeNull()
    act(() => { for (const cb of observed) cb([{ isIntersecting: false, boundingClientRect: { top: -300 } as DOMRect }]) })
    const bar = screen.getByRole('button', { name: '比分 喝FIN就好BA 2 比 對手 0，1局下，回到計分板' })
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    fireEvent.click(bar)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    act(() => { for (const cb of observed) cb([{ isIntersecting: true, boundingClientRect: { top: 80 } as DOMRect }]) })
    expect(screen.queryByRole('button', { name: /回到計分板/ })).toBeNull()
  })
})

describe('between games: the board keeps the last game', () => {
  it('FINAL, both scores, the line score and the way to the game page', async () => {
    const g: Game = { id: 'G20261122-01', date: '2026-11-22', tournament: '友誼賽', opponent: '工海物治', homeAway: '客', innings: 7, venue: '台大棒球場' }
    const b = (inning: number, batter: string, result: string, run = 0): BattingPA => ({ gameId: g.id, inning, batter, pitches: ['IP'], result, sb: 0, cs: 0, advOnError: 0, outOnBase: 0, run, rbi: run, code: run ? 'R' : 'I' })
    useDataStore.setState({ base: { ...EMPTY_DATASET, games: [g], batting: [b(1, '甲', '全壘打', 1), b(2, '乙', '外飛')], pitching: [] } })
    writeDraft(null)
    render(<MemoryRouter><LivePage /></MemoryRouter>)
    const box = await screen.findByRole('region', { name: '最近一場' })
    expect(within(box).getByText('FINAL')).toBeTruthy()
    expect(within(box).getByText('勝')).toBeTruthy()
    expect(within(box).getAllByRole('columnheader').map((h) => h.textContent)).toContain('R')
    expect(within(box).getByRole('link', { name: '看這場的成績' }).getAttribute('href')).toBe(`/games?game=${g.id}`)
  })
})
