import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, ChevronRight, Flag } from 'lucide-react'
import { Card } from './Card'
import { TeamLogo } from './TeamLogo'
import { OppMark } from './GameCard'
import { BattedBall } from './BattedBall'
import { EASE } from '../motion/Reveal'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { circled } from '../../data/gameText'
import { chipWho, pitchToken, scoredItem, type FeedHalf, type FeedItem, type FeedSide, type Score2 } from '../../data/broadcast'
import { cx } from '../../lib/format'
import { kmhText, speedClass } from '../../data/speeds'

/** 全部 / 得分 (MLB's Scoring Plays) / 安打 */
export type FeedFilter = 'all' | 'runs' | 'hits'
const FILTERS: Array<{ value: FeedFilter; label: string }> = [{ value: 'all', label: '全部' }, { value: 'runs', label: '得分' }, { value: 'hits', label: '安打' }]
const readFilter = (key?: string): FeedFilter => { if (!key) return 'all'; try { const v = localStorage.getItem(key); return v === 'runs' || v === 'hits' ? v : 'all' } catch { return 'all' } }
const keepFilter = (key: string | undefined, f: FeedFilter) => { if (!key) return; try { localStorage.setItem(key, f) } catch { /* storage unavailable */ } }
const passes = (it: FeedItem, f: FeedFilter) => f === 'all' || (f === 'runs' ? scoredItem(it) : it.kind === 'pa' && it.hit)

// every row of the feed: [order or icon 20px | text | score and outs 64px]
const ROW = 'grid grid-cols-[20px_minmax(0,1fr)_64px] gap-x-2 items-start'
const chip = (on: boolean) => cx('h-9 px-3 rounded-[var(--radius-sm)] border text-[13px] font-medium cursor-pointer transition-colors motion-reduce:transition-none', on ? 'border-ink bg-ink text-bg' : 'border-border bg-surface text-ink hover:bg-surface-2')
/** a pitch chip's colours: balls green, strikes amber (the scoreboard's lights), the ball put in play neutral */
const BALLS = new Set(['B', 'HP']), STRIKES = new Set(['S', 'CS', 'SS', 'F', 'T'])
const pitchTone = (code: string) => (BALLS.has(code)
  ? 'text-good-text bg-[color-mix(in_srgb,var(--good)_13%,transparent)]'
  : STRIKES.has(code) ? 'text-warning-text bg-[color-mix(in_srgb,var(--warning)_16%,transparent)]' : 'text-ink bg-surface-3')
const halfShort = (h: Pick<FeedHalf, 'inning' | 'half'>) => `${h.inning}${h.half === 'top' ? '上' : '下'}`

/**
 * 文字轉播 (data/broadcast.ts buildFeed): half-innings newest first, plate appearances newest first inside them, each a
 * sentence with its pitches as chips (the count after each, CPBL's and MLB's pitch list), the score after it when it scored
 * and the out count when it made an out; tap one for every pitch, the runners and where the ball went. A row of
 * half-inning chips jumps to any half (CPBL / NPB). 全部／得分／安打 filters (MLB's Scoring Plays). 即時比分 (with the plate
 * appearance in progress, the current half and the one before it open, and the halves still to come as dashed chips:
 * `innings`) and the game page's 文字轉播 tab (`allOpen`) use it. `storageKey` remembers the filter for this viewer.
 */
export function Broadcast({ halves, weTop, opponent, allOpen = false, storageKey, innings, className, bodyClassName }: { halves: FeedHalf[]; weTop: boolean; opponent: string; allOpen?: boolean; storageKey?: string; /** regulation innings: the halves not reached yet show as dashed chips (即時比分) */ innings?: number; className?: string; bodyClassName?: string }) {
  const [filter, setFilter] = useState<FeedFilter>(() => readFilter(storageKey))
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [openPA, setOpenPA] = useState<Record<string, boolean>>({})
  const reduced = usePrefersReducedMotion()
  const pick = (f: FeedFilter) => { setFilter(f); keepFilter(storageKey, f) }
  const newest = [...halves].reverse()
  // (得分 keeps a half the timeline could not follow whenever it scored: its summary has the runs, its rows only partly)
  const visible = (f: FeedFilter) => newest.map((h) => ({ h, items: [...h.items].reverse().filter((it) => !(it.kind === 'event' && it.during) && passes(it, f)) }))
    .filter((x) => f === 'all' || x.items.length || (f === 'runs' && !x.h.followed && x.h.runs > 0))
  const shown = visible(filter)
  const mark = (side: FeedSide, size = 18) => (side === 'us' ? <TeamLogo size={size} className="rounded-[5px]" /> : <OppMark name={opponent} size={size} />)
  const empty = !halves.some((h) => h.items.length)
  // the score when each half ended (the away side bats in the top halves)
  const after = new Map<string, Score2>()
  halves.reduce((sc, h) => { const next = h.half === 'top' ? { ...sc, away: sc.away + h.runs } : { ...sc, home: sc.home + h.runs }; after.set(h.key, next); return next }, { away: 0, home: 0 })
  // the half-inning chips: every half so far, then (即時比分) the rest of regulation, dashed
  const last = halves.at(-1)
  const upcoming: Array<{ inning: number; half: 'top' | 'bottom' }> = []
  if (innings && last) for (let i = last.inning; i <= innings; i++) for (const half of ['top', 'bottom'] as const) if (i * 2 + (half === 'bottom' ? 1 : 0) > last.inning * 2 + (last.half === 'bottom' ? 1 : 0)) upcoming.push({ inning: i, half })
  const jump = (h: FeedHalf) => {
    setToggled((t) => ({ ...t, [h.key]: true }))
    // a half the filter hides comes back under 全部
    if (!shown.some((x) => x.h.key === h.key)) pick('all')
    window.requestAnimationFrame(() => document.getElementById(`feed-${h.key}`)?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }))
  }
  return (
    <Card title="文字轉播" still flush className={className} bodyClassName={bodyClassName}
      action={
        <div className="flex gap-1.5" role="group" aria-label="篩選文字轉播">
          {FILTERS.map((f) => <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => pick(f.value)} className={chip(filter === f.value)}>{f.label}</button>)}
        </div>
      }>
      {!empty && halves.length > 1 && (
        <nav aria-label="跳到某一局" className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {halves.map((h) => (
            <button key={h.key} type="button" onClick={() => jump(h)} aria-label={`跳到${h.title.split(' ')[0]}`}
              className={cx('tap-44 shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-semibold tnum cursor-pointer transition-colors motion-reduce:transition-none',
                h.done ? 'bg-surface-2 text-ink hover:bg-surface-3' : 'bg-accent text-accent-ink')}>
              {!h.done && <span aria-hidden className="size-1.5 rounded-full bg-current" />}{halfShort(h)}
            </button>
          ))}
          {upcoming.map((u) => <span key={`${u.inning}${u.half}`} aria-hidden className="shrink-0 inline-flex items-center h-8 px-3 rounded-full text-[13px] tnum text-muted border border-dashed border-[var(--border-strong)]">{halfShort(u)}</span>)}
        </nav>
      )}
      {empty ? <p className="px-5 py-8 text-center text-[13px] text-muted">比賽開始，還沒有打席</p>
        : !shown.length ? <p className="px-5 py-8 text-center text-[13px] text-muted">{filter === 'hits' ? '還沒有安打' : '還沒有得分'}</p>
        : (
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {shown.map(({ h, items }, n) => {
              const open = toggled[h.key] ?? (allOpen || filter !== 'all' || n < 2)
              const right = h.done ? h.summary : '進行中'
              const sub = h.pitcher
              const end = h.done ? after.get(h.key) : undefined
              return (
                <section key={h.key} id={`feed-${h.key}`} aria-label={h.title} className="scroll-mt-[136px]">
                  <button type="button" aria-expanded={open} onClick={() => setToggled((t) => ({ ...t, [h.key]: !open }))}
                    className="w-full text-left px-4 py-2 min-h-11 bg-surface-2/60 hover:bg-surface-2 cursor-pointer flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <ChevronRight aria-hidden className={cx('size-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none', open && 'rotate-90')} />
                      {mark(h.side)}
                      <span className="text-[14px] font-semibold text-ink truncate">{h.title}</span>
                      <span className={cx('ml-auto shrink-0 text-[12px] tnum', h.done ? 'text-muted hidden sm:inline' : 'text-[color-mix(in_srgb,var(--good)_70%,var(--ink))] font-medium')}>{right}</span>
                      {end && <ScoreChip score={end} weTop={weTop} mark={mark} label={`${h.title.split(' ')[0]}結束`} />}
                    </span>
                    {(sub || (h.done && h.summary)) && (
                      <span className={cx('pl-[22px] text-[12px] text-muted truncate', !sub && 'sm:hidden')}>
                        {h.done && h.summary && <span className="sm:hidden tnum">{h.summary}{sub ? '・' : ''}</span>}
                        {sub}
                      </span>
                    )}
                    {/* (準備上場 on a line of its own: three names do not fit after the pitcher at 360) */}
                    {h.dueUp && <span className="pl-[22px] text-[12px] text-muted truncate">準備上場 <span className="text-ink-2 font-medium">{h.dueUp}</span></span>}
                  </button>
                  {open && (
                    <ul className="divide-y divide-[var(--border)]">
                      <AnimatePresence initial={false}>
                        {items.map((it) => (
                          <motion.li key={it.key} layout="position" initial={reduced ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0 }} transition={{ duration: 0.28, ease: EASE }}
                            className={cx('border-l-[3px]', scoredItem(it) ? '' : 'border-l-transparent')} style={scoredItem(it) ? { borderLeftColor: it.side === 'us' ? 'var(--accent)' : 'var(--ink-2)' } : undefined}>
                            <Item it={it} weTop={weTop} mark={mark} open={!!openPA[it.key]} onToggle={() => setOpenPA((o) => ({ ...o, [it.key]: !o[it.key] }))} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                      {/* (between halves the header already says who is up) */}
                      {!items.length && !h.dueUp && <li className="px-4 py-3 text-[12px] text-muted">{filter === 'runs' && !h.followed ? '這個半局沒有壘上紀錄，看不出是哪一棒得分' : '這個半局還沒有打席'}</li>}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
    </Card>
  )
}

/** 「[客隊標] 3:2 [主隊標]」 (away first, CPBL's 客:主, with the marks so it cannot be read the wrong way round). */
export function ScoreChip({ score, weTop, mark, label = '比分' }: { score: Score2; weTop: boolean; mark: (side: FeedSide, size?: number) => ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-ink tnum whitespace-nowrap" aria-label={`${label} 客 ${score.away} 比 主 ${score.home}`}>
      {mark(weTop ? 'us' : 'opp', 14)}{score.away}:{score.home}{mark(weTop ? 'opp' : 'us', 14)}
    </span>
  )
}
const Outs = ({ n }: { n: number }) => <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-2 whitespace-nowrap tnum">{n} 出局</span>
/** 「得分 +2」 on a play that scored, 「安打」 / 「全壘打」 on a hit that did not */
const Tag = ({ text, tone }: { text: string; tone: 'run' | 'hit' }) => (
  <span className={cx('inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap tnum', tone === 'run' ? 'bg-accent-soft text-accent-text' : 'bg-[color-mix(in_srgb,var(--series-3)_14%,transparent)] text-[color-mix(in_srgb,var(--series-3)_70%,var(--ink))]')}>{text}</span>
)

function Side({ score, outs, runs = 0, hit, weTop, mark }: { score?: Score2; outs?: number; runs?: number; hit?: string; weTop: boolean; mark: (side: FeedSide, size?: number) => ReactNode }) {
  return (
    <span className="flex flex-col items-end gap-1 pt-0.5">
      {runs > 0 ? <Tag text={`得分 +${runs}`} tone="run" /> : hit ? <Tag text={hit} tone="hit" /> : null}
      {score && <ScoreChip score={score} weTop={weTop} mark={mark} />}
      {outs ? <Outs n={outs} /> : null}
    </span>
  )
}

/** The pitches of a plate appearance as small chips, each with the count after it (the pitch put in play keeps the count
 *  before it), and its fastest pitch when one was measured. */
function PitchChips({ pitches }: { pitches: Extract<FeedItem, { kind: 'pa' }>['pitches'] }) {
  if (!pitches.length) return null
  const fast = Math.max(0, ...pitches.map((p) => p.kmh ?? 0))
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label={`${pitches.length} 球：${pitches.map((p) => `${p.word} ${p.count}`).join('、')}`}>
      {pitches.map((p) => (
        <span key={p.n} aria-hidden className={cx('inline-flex items-baseline gap-1 h-5 px-1.5 rounded-[5px] text-[11px] font-semibold', pitchTone(p.code))}>
          {pitchToken(p.code)}<span className="tnum font-medium text-ink-2">{p.count}</span>
        </span>
      ))}
      {fast > 0 && <span className="text-[11px] text-muted tnum">最快 <span className={speedClass(fast)}>{kmhText(fast)}</span></span>}
    </span>
  )
}

function Item({ it, weTop, mark, open, onToggle }: { it: FeedItem; weTop: boolean; mark: (side: FeedSide, size?: number) => ReactNode; open: boolean; onToggle: () => void }) {
  if (it.kind === 'sub' || it.kind === 'placed') {
    return (
      <div className={cx(ROW, 'px-4 py-2 text-[12px] text-ink-2')}>
        <span className="inline-flex justify-center pt-0.5 text-muted">{it.kind === 'sub' ? <ArrowLeftRight aria-hidden className="size-3.5" /> : <Flag aria-hidden className="size-3.5" />}</span>
        <span className="min-w-0">{it.text}</span>
      </div>
    )
  }
  if (it.kind === 'event') {
    return (
      <div className={cx(ROW, 'px-4 py-2 text-[13px] text-ink-2')}>
        <span aria-hidden className="inline-flex justify-center pt-1.5"><span className="size-1.5 rounded-full bg-ink-2" /></span>
        <span className="min-w-0">{it.text}</span>
        <Side score={it.score} outs={it.outs} runs={it.runs} weTop={weTop} mark={mark} />
      </div>
    )
  }
  if (it.kind === 'live') {
    return (
      <div className={cx(ROW, 'px-4 py-2.5 bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]')}>
        <span aria-hidden className="relative inline-flex size-2 mt-1.5 mx-auto"><span className="absolute inset-0 rounded-full bg-[var(--critical)] opacity-60 animate-ping motion-reduce:animate-none" /><span className="relative size-2 rounded-full bg-[var(--critical)]" /></span>
        <span className="min-w-0 text-[14px] text-ink"><span className="text-muted text-[12px] mr-1.5">打擊中</span><b className="font-semibold">{it.who}</b>{it.bats && <span className="text-muted text-[12px] ml-1">{it.bats}</span>}</span>
        <span className="flex flex-col items-end gap-1"><span className="text-[14px] font-semibold tnum text-ink" aria-label={`球數 ${it.count}`}>{it.count}</span>{it.runs > 0 && <Tag text={`得分 +${it.runs}`} tone="run" />}{it.score && <ScoreChip score={it.score} weTop={weTop} mark={mark} />}{it.outs ? <Outs n={it.outs} /> : null}</span>
        <span className="col-start-2 col-span-2 text-[12px] text-muted mt-0.5 flex flex-col gap-0.5">
          <span><span className="tracking-[0.08em]">{it.tokens || '—'}</span>{it.kmh ? <span className="tnum">・上一球 <span className={speedClass(it.kmh)}>{kmhText(it.kmh)}</span></span> : null}</span>
          {it.plays.map((p, i) => <span key={i}>{p}</span>)}
        </span>
      </div>
    )
  }
  const ball = it.ball && (it.ball.loc || it.ball.traj) ? it.ball : undefined
  const detail = it.pitches.length > 0 || !!it.pitcher || !!ball
  const head = (
    <>
      <span aria-hidden className="inline-flex items-center justify-center size-5 mt-px rounded-[5px] bg-surface-3 text-ink-2 text-[11px] font-semibold tnum">{it.order ?? ''}</span>
      <span className={cx('min-w-0 text-[14px] leading-snug text-ink', it.hr && 'font-semibold')}><b className="font-semibold">{chipWho(it.who, it.order)}</b>{it.bats && <span className="text-muted text-[12px] ml-1">{it.bats}</span>} {it.text}</span>
      <Side score={it.score} outs={it.outs} runs={it.runs} hit={it.hr ? '全壘打' : it.hit ? '安打' : undefined} weTop={weTop} mark={mark} />
      {(it.pitches.length > 0 || it.plays.length > 0) && (
        <span className="col-start-2 col-span-2 mt-1 text-[12px] text-muted flex flex-col gap-1">
          <PitchChips pitches={it.pitches} />
          {it.plays.map((p, i) => <span key={i} className="text-ink-2">{p}</span>)}
        </span>
      )}
    </>
  )
  if (!detail) return <div className={cx(ROW, 'px-4 py-2.5')}>{head}</div>
  return (
    <>
      <button type="button" aria-expanded={open} onClick={onToggle} title={open ? '收起逐球' : '看每一球'} className={cx(ROW, 'w-full text-left px-4 py-2.5 min-h-11 cursor-pointer hover:bg-surface-2/60')}>{head}</button>
      {open && (
        <div className={cx(ROW, 'px-4 pb-3 -mt-1')}>
          <span className="col-start-2 col-span-2 text-[12px] text-ink-2 flex flex-col gap-2 rounded-[var(--radius-sm)] bg-surface-2/70 px-3 py-2">
            <span className="flex flex-col gap-0.5">
              {it.pitcher && <span className="text-muted">投手：{it.pitcher}</span>}
              {it.moves.filter((m) => m.at <= 0).map((m, i) => <span key={`m0${i}`}>{m.text}</span>)}
              {it.pitches.map((p) => (
                <span key={p.n} className="flex flex-col gap-0.5">
                  <span className="tnum">{circled(p.n)} {p.word}<span className="text-muted ml-1.5">{p.count}</span>{p.kmh ? <span className={cx('ml-1.5', speedClass(p.kmh) || 'text-muted')}>{kmhText(p.kmh)}</span> : null}</span>
                  {it.moves.filter((m) => m.at === p.n || (p.n === it.pitches.length && m.at > p.n)).map((m, i) => <span key={`m${p.n}${i}`} className="pl-5">{m.text}</span>)}
                </span>
              ))}
            </span>
            {ball && <BattedBall loc={ball.loc} traj={ball.traj} quality={ball.quality} className="flex items-center gap-3 pt-2 border-t border-[var(--border)]" />}
          </span>
        </div>
      )}
    </>
  )
}
