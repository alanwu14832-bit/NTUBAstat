import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Diamond } from '../record/Diamond'
import { AnimatePresence, motion } from 'framer-motion'
import { BOARD, CountLights, LineScoreBoard, type BoardTeam } from '../components/ui/Scoreboard'
import { TeamLogo } from '../components/ui/TeamLogo'
import { oppErrorCount, ourErrorCount } from '../data/errors'
import { OppMark } from '../components/ui/GameCard'
import { Broadcast, ScoreChip } from '../components/ui/Broadcast'
import { BoxScore } from '../components/game/BoxScore'
import { Tabs } from '../components/ui/Tabs'
import { liveBoxScore } from '../data/boxScore'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useMediaQuery, usePrefersReducedMotion } from '../hooks/useMediaQuery'
import { RollingNumber } from '../components/motion/RollingNumber'
import { EASE } from '../components/motion/Reveal'
import { count, liveSplit, offense, oppBatterOf, oppPitchCount, score, type RecordState } from '../record/model'
import { oppPitcherText } from '../record/OppParts'
import { hhmm } from '../lib/dates'
import { useLiveGames } from '../hooks/useLiveGames'
import { useDataStore } from '../store/data'
import { TEAM_NAME } from '../data/seed'
import { withSideNames } from '../data/intrasquad'
import { HIT_BASE_COUNT, OPP_BATS_LABEL, oppBatterName, type Game } from '../data/types'
import { cx } from '../lib/format'
import { NON_AB_RESULTS, ipDisplay, pitchingLines, resultText, summarizeGame, type GameSummary } from '../data/stats'
import { playedGames } from '../data/filters'
import { Button } from '../components/ui/Button'
import { f3 } from '../lib/fmt'
import { alignSpeeds, kmhText, speedClass, speedFacts, speedTone } from '../data/speeds'
import { TEAM } from '../config/team'
import { gridCell, type GridTone } from '../data/gameText'
import { dueUp, halfPlayed, oppFrom, ourFrom, onDeckOf, type UpBatter } from '../record/upNext'
import { currentHalfCard, halfCardKey, liveContext, seasonLine, type HalfCard } from '../data/liveFacts'
import {
  basesLine, batterRowsToday, boardInning, buildFeed, chipWho, hrCounts, itemText, latestItem, liveSourceOf, oppPitcherToday, oppStintRows, pitcherToday, pitchList, pitchToken, playsSentence, runnerShort, scoredItem, upList,
  type FeedItem, type FeedSide,
} from '../data/broadcast'

const POLL_MS = 5000
/** 全部／得分 of the 文字轉播, per viewer */
const FEED_FILTER_KEY = 'bafin.live.feedFilter'
/** 文字轉播｜Box Score under the board, per viewer (every read and write may fail: private mode) */
type LivePanel = 'feed' | 'box'
const PANEL_KEY = 'bafin.live.panel'
const readPanel = (): LivePanel => { try { return localStorage.getItem(PANEL_KEY) === 'box' ? 'box' : 'feed' } catch { return 'feed' } }
const writePanel = (v: LivePanel) => { try { localStorage.setItem(PANEL_KEY, v) } catch { /* storage unavailable */ } }
const PANELS = [{ value: 'feed' as const, label: '文字轉播' }, { value: 'box' as const, label: 'Box Score' }]
/** 大螢幕 (the feed is hidden there) wide enough for the Box Score beside the board: a 1920-wide TV or monitor, not a
 *  laptop (narrower, the board's matchup row would cut the batter's name) */
const BIG_WIDE = '(min-width: 1880px)'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const dayText = (iso: string) => { const d = new Date(`${iso}T00:00:00`); return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）` }

/** Nothing on: the board keeps showing how the last game ended (FINAL, its line score) and the next game sits under it,
 *  so a parent who opens the link between games is not left on a dead end (2026-11-27 audit; the board look from the
 *  2026-11-28 redesign A). */
function IdleCard({ error, next, last }: { error: string | null; next?: Game; last?: GameSummary }) {
  const weTop = last?.game.homeAway === '客'
  const usTeam: BoardTeam | null = last ? { name: TEAM_NAME, line: last.lineUs, r: last.runsUs, h: last.hitsUs, e: last.errorsUs, us: true, mark: <TeamLogo size={18} /> } : null
  const oppTeam: BoardTeam | null = last ? { name: last.game.opponent, line: last.lineOpp, r: last.runsOpp, h: last.hitsOpp, e: last.errorsOpp, us: false, mark: <OppMark name={last.game.opponent} size={18} /> } : null
  const won = last?.result === 'W', lost = last?.result === 'L'
  const team = (t: BoardTeam, winner: boolean) => (
    <div className="flex items-center gap-3 min-w-0">
      {t.us ? <TeamLogo size={34} /> : <OppMark name={t.name} size={34} />}
      <span className="min-w-0 truncate text-[17px] font-semibold" style={{ color: t.us ? BOARD_ACCENT : BOARD.ink }}>{t.name}</span>
      {winner && <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-[6px] text-[12px] font-bold" style={{ background: BOARD_ACCENT, color: BOARD.bg }}>勝</span>}
      <span className="figure ml-auto shrink-0 text-[52px] @xl:text-[64px] font-bold leading-none tabular-nums" style={{ color: winner || (!won && !lost) ? BOARD.ink : BOARD.muted }}>{t.r}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-2"><span aria-hidden className="size-2 rounded-full bg-[var(--border-strong)]" />目前沒有進行中的比賽</div>
      {error && <p className="text-[13px] text-critical-text">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {last && usTeam && oppTeam && (
          <section aria-label="最近一場" className="@container relative overflow-hidden rounded-[var(--radius)]"
            style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 30%), ${BOARD.bg}`, color: BOARD.ink, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 22px 50px -20px rgba(0,0,0,0.55)' }}>
            <div className="flex items-center gap-3 px-4 @xl:px-6 h-12 border-b text-[13px]" style={{ borderColor: BOARD.line }}>
              <span className="figure font-bold tracking-[0.1em] shrink-0" style={{ color: BOARD.muted }}>FINAL</span>
              <span className="min-w-0 truncate" style={{ color: BOARD.muted }}>{[dayText(last.game.date), last.game.tournament, last.game.venue].filter(Boolean).join('・')}</span>
            </div>
            <div className="flex flex-col gap-2 px-4 @xl:px-6 py-4">
              {team(weTop ? usTeam : oppTeam, weTop ? won : lost)}
              {team(weTop ? oppTeam : usTeam, weTop ? lost : won)}
              <span className="sr-only">{resultText(last.result)} {last.runsUs}:{last.runsOpp}</span>
            </div>
            <LineScoreBoard bare compact className="border-t" innings={Math.max(last.lineUs.length, last.lineOpp.length, last.game.innings ?? 0)} top={weTop ? usTeam : oppTeam} bottom={weTop ? oppTeam : usTeam} />
            <div className="px-4 @xl:px-6 py-4 border-t" style={{ borderColor: BOARD.line }}>
              <Link to={`/games?game=${encodeURIComponent(last.game.id)}`} className="press flex items-center justify-center h-11 rounded-full text-[14px] font-bold" style={{ background: BOARD_ACCENT, color: BOARD.bg }}>看這場的成績</Link>
            </div>
          </section>
        )}
        <section aria-label="下一場" className="bg-surface rounded-[var(--radius)] shadow-[var(--shadow-card)] p-5 flex flex-col gap-2 min-w-0">
          <span className="text-[12px] text-muted">下一場</span>
          {next ? (
            <>
              <span className="flex items-baseline gap-3 flex-wrap"><span className="figure text-[34px] font-bold leading-none text-accent-text">{dayText(next.date)}</span>{next.time && <span className="figure text-[26px] font-semibold text-ink">{next.time}</span>}</span>
              <span className="text-[15px] font-semibold text-ink">vs {next.opponent}</span>
              <span className="text-[13px] text-ink-2 truncate">{[next.tournament, next.venue].filter(Boolean).join('・')}</span>
            </>
          ) : <span className="text-[15px] text-ink-2">還沒排定</span>}
          <span className="pt-1"><Button size="sm" variant="outline" to="/games?view=schedule">看賽程</Button></span>
        </section>
      </div>
      <p className="text-[12px] text-muted">比賽開始後，計分板會換成這場的比分、壘包和每一球，每 5 秒自動更新，不需登入。</p>
    </div>
  )
}

/** Public live scoreboard. Reads the in-progress state the recorder's device keeps in sync (cloud), or this device's own draft. */
export function LivePage() {
  // (the shared list of games in progress with their recording states, read every 5 s while this page is open:
  // hooks/useLiveGames.ts)
  const { drafts, error } = useLiveGames({ pollMs: POLL_MS, full: true })
  const base = useDataStore((s) => s.base)
  const live = drafts[0] ?? null
  // the last game played (with its rows: a game entered with nothing recorded is not one) and the next one on the schedule
  const lastFinal = useMemo(() => { const g = playedGames(base).slice(-1)[0]; return g ? summarizeGame(base, g, new Set()) : undefined }, [base])
  const today = new Date().toISOString().slice(0, 10)
  const nextGame = useMemo(() => base.games.filter((g) => g.status === 'scheduled' && g.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))[0], [base.games, today])

  if (!live) {
    return (
      <>
        <PageHeader title="即時比分" description="紀錄員在「紀錄比賽」逐球輸入時，這一頁會每 5 秒自動更新，不需登入。" />
        <IdleCard error={error} next={nextGame} last={lastFinal} />
      </>
    )
  }

  return <LiveBoard live={live} error={error} />
}

// the board is always dark: the team colour is lifted toward the board's ink so a navy or a dark amber still glows
const BOARD_ACCENT = 'color-mix(in srgb, var(--accent) 62%, #f3efe7)'
const LED_DOTS = 'radial-gradient(rgba(255,255,255,0.055) 0.9px, transparent 1.3px)'
/** One character per pitch, so a called strike (好) and a whiff (空) differ in words, not only in colour. */
const PITCH_COLOR: Record<string, string> = { B: BOARD.ball, S: BOARD.strike, CS: BOARD.strike, SS: BOARD.out, F: BOARD.strike, IP: BOARD.ink }
/** A runner play between pitches, as one character between the squares (its title is the whole sentence). */
const PLAY_CHAR: Record<string, string> = { sb: '盜', cs: '盜', wp: '暴', pb: '逸', bk: '犯', pk: '牽', err: '失', throw: '傳', advance: '進', score: '進', out: '死' }
/** the matchup's label column (and row 最新's): one axis, 3 characters wide */
const LABEL = 'grid-cols-[36px_minmax(0,1fr)_auto]', LABEL_BIG = 'grid-cols-[42px_minmax(0,1fr)_auto]'
/** a cell of the matchup grid, and the line between its columns */
const CELL = 'min-w-0 px-3 @xl:px-6'
const DIVIDER = { borderColor: 'rgba(243,239,231,0.14)' }
const TONE: Record<GridTone, string> = { hit: BOARD_ACCENT, out: BOARD.muted, on: BOARD.ink, other: BOARD.muted }

/** A speed on the board: 125–134 黃, 135 and up 紅, slower in the board's muted ink. */
const SPEED_COLOR = { fast: '#ff5a4f', quick: '#f6cf3e' } as const
const speedColor = (v: number | null | undefined) => { const t = speedTone(v); return t ? SPEED_COLOR[t] : BOARD.muted }
/** 「135 公里」 lit in its colour */
function BoardSpeed({ v, big, label }: { v: number; big: boolean; label?: string }) {
  return <span className={cx('figure font-bold tabular-nums', big ? 'text-[20px] @xl:text-[24px]' : 'text-[15px]')} style={{ color: speedColor(v) }}>{label && <span className="font-normal mr-1" style={{ color: BOARD.muted, fontSize: '0.7em' }}>{label}</span>}{v}<span className="font-normal ml-0.5" style={{ fontSize: '0.62em' }}>km/h</span></span>
}

/** The pitches of the plate appearance in progress as small lit squares, with its runner plays where they happened
 *  (and each pitch's 球速 under it when it was measured). */
function BoardPitches({ pitches, plays, big, speeds }: { pitches: string[]; plays: Array<{ at: number; char: string; title: string }>; big: boolean; speeds?: Array<number | null> }) {
  const sp = alignSpeeds(speeds, pitches.length)
  if (!pitches.length && !plays.length) return <span style={{ color: BOARD.muted }}>—</span>
  const sq = big ? 'size-8 text-[16px]' : 'size-6 text-[12px]'
  const pill = (p: { char: string; title: string }, k: string) => (
    <span key={k} title={p.title} aria-label={p.title} className={cx('inline-flex items-center justify-center rounded-full px-1.5 font-bold', big ? 'h-8 text-[15px]' : 'h-6 text-[11px]')} style={{ color: BOARD.ink, boxShadow: `inset 0 0 0 1px ${BOARD.line}` }}>{p.char}</span>
  )
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={`本打席 ${pitches.length} 球`}>
      {plays.filter((p) => p.at <= 0).map((p, i) => pill(p, `p0-${i}`))}
      {pitches.map((p, i) => {
        const color = PITCH_COLOR[p] ?? BOARD.muted
        const square = <span className={cx('figure inline-flex items-center justify-center rounded-[5px] font-bold', sq)} style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}>{pitchToken(p)}</span>
        const kmh = sp?.[i] ?? null
        return (
          <Fragment key={i}>
            {sp ? <span className="inline-flex flex-col items-center gap-0.5 align-top">{square}<span className={cx('figure tabular-nums leading-none', big ? 'text-[13px]' : 'text-[10px]', kmh === null && 'invisible')} style={{ color: speedColor(kmh), fontWeight: speedTone(kmh) ? 700 : 500 }} aria-label={kmh === null ? undefined : `${kmh} 公里`}>{kmh ?? '–'}</span></span> : square}
            {plays.filter((x) => x.at === i + 1 || (i === pitches.length - 1 && x.at > i + 1)).map((x, k) => pill(x, `p${i}-${k}`))}
          </Fragment>
        )
      })}
    </span>
  )
}

/** One team's row of the scorebug: mark, name, ▶ when at bat, the runs lit up in their own column. */
function TeamRow({ name, mark, runs, us, batting, big, tight }: { name: string; mark: ReactNode; runs: number; us: boolean; batting: boolean; big: boolean; tight: boolean }) {
  return (
    <div className={cx('flex items-center min-w-0', big ? 'gap-3 @xl:gap-4' : 'gap-1.5 @xl:gap-3', big ? '' : 'h-11 @xl:h-[84px]')}>
      {mark}
      <span className={cx('min-w-0 truncate font-semibold', big ? 'text-[28px]' : 'text-[15px] @xl:text-[20px]')} style={{ color: us ? BOARD_ACCENT : BOARD.ink }}>{name}</span>
      <span aria-label={batting ? '進攻中' : undefined} className={cx('shrink-0', big ? 'text-[16px]' : 'text-[10px] @xl:text-[12px]')} style={{ color: BOARD.strike, visibility: batting ? 'visible' : 'hidden' }}>▶</span>
      <span className={cx('figure ml-auto shrink-0 font-bold leading-none tabular-nums text-right', big ? (tight ? 'text-[112px] @xl:text-[136px]' : 'text-[120px] @xl:text-[180px]') : 'min-w-7 pl-1 @xl:min-w-20 text-[40px] @xl:text-[84px]')}
        style={{ color: BOARD.ink, textShadow: us ? `0 0 24px color-mix(in srgb, ${BOARD_ACCENT} 55%, transparent)` : '0 0 18px rgba(243,239,231,0.18)' }}>
        <RollingNumber text={String(runs)} />
      </span>
    </div>
  )
}

/** A row of the matchup grid: muted label | value (truncated) | number on the right; `sub` is its second line. */
function MRow({ label, value, num, sub, subNum, big, wrap = false }: { label: string; value: ReactNode; num?: ReactNode; sub?: ReactNode; subNum?: ReactNode; big: boolean; /** a list that may take two lines instead of losing its last name */ wrap?: boolean }) {
  return (
    <div className={cx('grid gap-x-2 items-baseline', big ? `${LABEL_BIG} text-[18px] @xl:text-[22px]` : `${LABEL} text-[14px] @xl:text-[15px]`)}>
      <span className={cx('whitespace-nowrap', big ? 'text-[14px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>{label}</span>
      <span className={cx('min-w-0 font-semibold', wrap ? 'break-words' : 'truncate')}>{value}</span>
      <span className={cx('figure tabular-nums text-right whitespace-nowrap', big ? 'text-[14px] @xl:text-[18px]' : 'text-[13px]')} style={{ color: BOARD.muted }}>{num}</span>
      {(sub || subNum) && (
        <>
          {/* (without a number of its own the second line takes the number's column too) */}
          <span className={cx('col-start-2 min-w-0 truncate mt-0.5', !subNum && 'col-span-2', big ? 'text-[16px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>{sub}</span>
          {subNum && <span className={cx('figure tabular-nums text-right whitespace-nowrap mt-0.5', big ? 'text-[16px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>{subNum}</span>}
        </>
      )}
    </div>
  )
}

/** A row of the 本打席 card: muted label | value (truncated) | number on the right; `sub` is its second line (the
 *  board's MRow on the page's white). */
function LRow({ label, value, num, sub, subNum, wrap = false }: { label: string; value: ReactNode; num?: ReactNode; sub?: ReactNode; subNum?: ReactNode; wrap?: boolean }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-2 items-baseline text-[15px] min-w-0">
      <span className="text-[12px] text-muted whitespace-nowrap">{label}</span>
      <span className={cx('min-w-0 font-semibold text-ink', wrap ? 'break-words' : 'truncate')}>{value}</span>
      <span className="text-[13px] text-ink-2 tnum text-right whitespace-nowrap">{num}</span>
      {(sub || subNum) && (
        <>
          <span className={cx('col-start-2 min-w-0 truncate mt-0.5 text-[12px] text-muted', !subNum && 'col-span-2')}>{sub}</span>
          {subNum && <span className="text-[12px] text-muted tnum text-right whitespace-nowrap mt-0.5">{subNum}</span>}
        </>
      )}
    </div>
  )
}
/** A runner play between two pitches of the 本打席 list, in the feed's words. */
const PlayRow = ({ text }: { text: string }) => <div role="row" className="px-3 py-1.5 pl-[48px] text-[12px] text-ink-2 border-t border-[var(--border)] bg-surface-2/40"><span role="cell">{text}</span></div>
/** today's plate appearances in the 本打席 card: hits in the team colour, outs muted */
const LIGHT_TONE: Record<GridTone, string> = { hit: 'text-accent-text', out: 'text-muted', on: 'text-ink', other: 'text-muted' }
/** a scoring play in 得分經過: the sentence; for the plate appearance in progress, its play that brought the run in */
const scoringText = (it: FeedItem): string => (it.kind === 'live' ? it.plays.filter((p) => p.includes('得分')).join('；') || itemText(it) : itemText(it))

/**
 * 即時比分 as a ballpark video board, in one order of reading: ① the score with the inning, the bases and S/B/O,
 * ② the line score, ③ the matchup (投手, 打者, 本打席, 壘上, 下一棒), ④ the newest play in one sentence, then the
 * 文字轉播 or the Box Score under it (a switch per viewer; on a wide screen the box under the board and the feed beside
 * it). 大螢幕 fills the whole screen (a laptop or TV at the field), the Box Score beside the board when the screen is
 * about 1920 px wide. A run or a home run flashes across the score.
 */
function LiveBoard({ live, error }: { live: { state: RecordState; updatedAt: string; by?: string | null }; error: string | null }) {
  const s = live.state
  const reduced = usePrefersReducedMotion()
  const [big, setBig] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  // 大螢幕 on a laptop (1366×768): the scores give up some height so the matchup still fits
  const tight = useMediaQuery('(max-height: 860px)') && big
  const narrow = useMediaQuery('(max-width: 399px)')
  const sc = score(s)
  const side = offense(s)
  const c = count(s.pitches)
  const weTop = s.game.homeAway === '客'
  const n = Math.max(sc.lineUs.length, s.game.innings ?? 0)
  const reg = s.game.innings ?? TEAM.innings
  // (after the game is over the record page has already moved on to the next half until 結束比賽 is tapped:
  // nobody is up next, that half gets no card, and a home half not needed reads X)
  const inPlay = halfPlayed(s, sc, reg)
  const hitsUs = s.batting.filter((p) => p.result in HIT_BASE_COUNT).length
  const hitsOpp = s.pitching.filter((p) => p.result in HIT_BASE_COUNT).length
  // E: each team's own errors, the game page's rule (data/errors.ts), plus those of the plate appearance in progress
  const errorsUs = ourErrorCount(s.pitching) + (side === 'opp' ? s.extras.errors?.length ?? 0 : 0)
  const errorsOpp = oppErrorCount(s.batting) + (side === 'us' ? s.extras.oppErrors?.length ?? 0 : 0)
  // innings not reached yet stay dark instead of showing 0
  const played = (i: number, half: 'top' | 'bottom') => i + 1 < s.inning || (i + 1 === s.inning && (half === 'top' || s.half === 'bottom'))
  // the game is over and the record page already went on to a new inning (結束比賽 not tapped yet): no column for it
  const ended = !inPlay && s.half === 'top' && s.inning > 1
  const lineOf = (line: number[], half: 'top' | 'bottom'): BoardTeam['line'] => (ended ? line.slice(0, s.inning - 1) : line).map((v, i) => (!inPlay && half === 'bottom' && s.half === 'bottom' && i + 1 === s.inning ? 'X' : played(i, half) ? v : null))
  const usHalf: 'top' | 'bottom' = weTop ? 'top' : 'bottom', oppHalf: 'top' | 'bottom' = weTop ? 'bottom' : 'top'
  // 隊內賽: both sides are ours (「我隊」「對方」 read as their names)
  const names = { us: s.intra?.team ?? TEAM_NAME, opp: s.game.opponent }
  const markUs = (size: number) => <TeamLogo size={size} />, markOpp = (size: number) => (s.intra ? <TeamLogo size={size} /> : <OppMark name={s.game.opponent} size={size} />)
  const usTeam: BoardTeam = { name: names.us, line: lineOf(sc.lineUs, usHalf), r: sc.us, h: hitsUs, e: errorsUs, us: true, mark: markUs(18) }
  const oppTeam: BoardTeam = { name: s.game.opponent, line: lineOf(sc.lineOpp, oppHalf), r: sc.opp, h: hitsOpp, e: errorsOpp, us: false, mark: markOpp(18) }
  const top = weTop ? usTeam : oppTeam, bottom = weTop ? oppTeam : usTeam

  // 本季 (this season's earlier games plus today so far), who is up next, the half-inning's card. The polled state is
  // a new object every 5 s, so the memos key on its fields (and the draft's time), never on `s` itself.
  const base = useDataStore((st) => st.base)
  const params = useDataStore((st) => st.params)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => liveContext(base, s.game, params), [base, params, s.game.id, s.game.date, s.game.opponent, s.game.innings])
  const slot = s.lineup[s.slot]
  const season = useMemo(() => (side === 'us' && slot ? seasonLine(ctx, s.batting, slot.name) : null), [ctx, slot?.name, s.batting.length, side]) // eslint-disable-line react-hooks/exhaustive-deps
  const up = inPlay ? onDeckOf(s) : { onDeck: null, inHole: null }
  const upKey = [up.onDeck, up.inHole].map((b) => (b ? `${b.us ? 'us' : 'opp'}${b.order}:${b.name}` : '')).join('|')
  const nextText = useMemo(() => upList([up.onDeck, up.inHole].filter((b): b is UpBatter => !!b).map((b) => {
    // (our batters: the 本季 AVG once he has an at bat this season)
    const line = b.us && b.name ? seasonLine(ctx, s.batting, b.name) : null
    return { ...b, avg: line && line.ab >= 1 ? f3(line.avg) : '' }
  })), [ctx, upKey, s.batting.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const due = dueUp(s, sc, reg)
  const halfCard = useMemo(() => currentHalfCard(s, ctx), [ctx, halfCardKey(s)]) // eslint-disable-line react-hooks/exhaustive-deps
  // 大螢幕 stays lean: no team win-streak card (連勝中) there
  const card: HalfCard | null = inPlay && !(big && halfCard?.id === 'wstreak:team') ? halfCard : null

  // 文字轉播: the whole game, both sides; between halves the batting team's first three go on the new half's header
  const fresh = s.outs === 0 && !s.pitches.length && !s.plays?.length && !(side === 'us' ? s.batting : s.pitching).some((r) => r.inning === s.inning)
  const leadoff = fresh && inPlay ? upList(side === 'us' ? ourFrom(s, s.slot, 3) : oppFrom(s, s.oppOrder, 3), { opp: side === 'opp' }) : ''
  const priorHr = useMemo(() => hrCounts([...ctx.battingBy.values()].flat()), [ctx])
  const feed = useMemo(() => {
    const f = buildFeed({ homeAway: s.game.homeAway, opponent: s.game.opponent, batting: s.batting, pitching: s.pitching, subs: s.subs, priorHr: s.intra ? undefined : priorHr, ...(inPlay ? { live: liveSourceOf(s, leadoff) } : {}) })
    return s.intra ? withSideNames(f, { us: s.intra.team, opp: s.game.opponent }) : f
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.updatedAt, s.batting.length, s.pitching.length, s.pitches.length, s.plays?.length, s.subs?.length, s.inning, s.half, inPlay, leadoff, priorHr])
  const latest = latestItem(feed)
  // Box Score (data/boxScore.ts): the same lines as the game page, from the draft's rows; the pitches of the plate
  // appearance in progress count in 用球數. Only built while it is on screen.
  const [panel, setPanel] = useState<LivePanel>(readPanel)
  const pickPanel = (v: LivePanel) => { setPanel(v); writePanel(v) }
  const bigWide = useMediaQuery(BIG_WIDE)
  const showBox = big ? bigWide : panel === 'box'
  const box = useMemo(() => (showBox ? liveBoxScore(s, { inPlay, roster: base.roster, params }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showBox, live.updatedAt, s.updatedAt, s.batting.length, s.pitching.length, s.pitches.length, s.slot, s.oppOrder, s.oppBatter, s.pitcher, s.inning, s.half, s.subs?.length, inPlay, base.roster, params])
  const liveItem = feed.at(-1)?.items.at(-1)
  const livePlays = liveItem?.kind === 'live' ? liveItem.plays : []
  // the pills between the pitch squares: one per play (grouped like the feed's lines, whose sentence is the title)
  const pills = useMemo(() => {
    const out: Array<{ at: number; char: string; title: string }> = []
    const list = s.plays ?? []
    let i = 0
    while (i < list.length) {
      let j = i + 1
      while (j < list.length && list[j].at === list[i].at && list[j].kind === list[i].kind) j++
      out.push({ at: list[i].at, char: PLAY_CHAR[list[i].kind] ?? '跑', title: livePlays[out.length] ?? playsSentence(list[i].kind, list.slice(i, j).map((e) => ({ name: '跑者', to: e.to }))) })
      i = j
    }
    return out
  }, [s.plays, livePlays])

  // the matchup: the pitcher defending, then the batter
  const ourP = pitcherToday(s.pitching, s.pitcher, side === 'opp' ? liveSplit(s).current : 0, side === 'opp' ? s.priorPitchers : undefined)
  const pitcherName = side === 'opp' ? s.pitcher || '投手' : oppPitcherText(s.oppPitcher) || (s.intra ? `${names.opp}投手` : '對方投手')
  const pitchCount = side === 'opp' ? ourP.pc : oppPitchCount(s)
  const pitcherLine = side === 'opp' ? ourP.line : oppPitcherToday(oppStintRows(s.batting, s.oppPitcher, s.oppPitcherFrom))
  // 球速: the pitcher's fastest today (his finished plate appearances and the one in progress) and the last pitch measured
  const now = { pitches: s.pitches, speeds: s.speeds }
  const pitcherSpeed = speedFacts([...(side === 'opp' ? s.pitching.filter((p) => p.pitcher === s.pitcher) : oppStintRows(s.batting, s.oppPitcher, s.oppPitcherFrom)), now])
  const lastSpeed = speedFacts([now]).last
  const mine = batterRowsToday(s)
  const ab = mine.filter((p) => !NON_AB_RESULTS.has(p.result)).length, hits = mine.filter((p) => p.result in HIT_BASE_COUNT).length
  const batterName = side === 'us' ? slot?.name ?? '' : oppBatterName(oppBatterOf(s)) || (s.intra ? `${names.opp}第 ${s.oppOrder} 棒` : `對方第 ${s.oppOrder} 棒`)
  // 對方打者左打／右打 (when the recorder picked one for him)
  const oppSide = side === 'opp' ? s.oppBatsBySlot?.[s.oppOrder] : undefined
  const batsTag = oppSide === 'L' || oppSide === 'R' ? OPP_BATS_LABEL[oppSide] : ''
  const order = side === 'us' ? s.slot + 1 : s.oppOrder
  const runnersText = basesLine(s.runners.map((r) => ({ base: r.base, name: r.side === 'us' ? r.name : runnerShort(s.pitching[r.row], 'opp', r.name) })))
  const dueText = s.outs === 2 && due.length ? upList(due, { opp: !due[0].us }) : ''

  // a run or a home run flashes across the score for a few seconds
  const [flash, setFlash] = useState<{ text: string; us: boolean; key: number } | null>(null)
  const prev = useRef<{ us: number; opp: number; rows: number } | null>(null)
  useEffect(() => {
    const rows = s.batting.length + s.pitching.length
    const p = prev.current
    prev.current = { us: sc.us, opp: sc.opp, rows }
    if (!p) return
    // (the newest play of either side: in the bottom half that is theirs, also when we are the away team)
    const hr = rows > p.rows && latest?.kind === 'pa' && latest.hr
    const text = hr ? '全壘打！' : sc.us > p.us ? `得分！${names.us}` : sc.opp > p.opp ? `${s.game.opponent} 得分` : null
    if (!text) return
    setFlash({ text, us: hr ? latest?.side === 'us' : sc.us > p.us, key: Date.now() })
    const id = window.setTimeout(() => setFlash(null), 3600)
    return () => window.clearTimeout(id)
  }, [sc.us, sc.opp, s.batting.length, s.pitching.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // B's pinned score bar (phones): once the board has scrolled away under the top bar, a slim copy of the score stays on top
  const boardRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    const el = boardRef.current
    if (big || !el || typeof IntersectionObserver === 'undefined') { setPinned(false); return }
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [big])

  // 大螢幕: the board alone, filling the screen (and the real full screen where the browser allows it)
  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false) }
    const onFs = () => { if (!document.fullscreenElement) setBig(false) }
    window.addEventListener('keydown', onKey); document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs) }
  }, [big])
  const openBig = () => { setBig(true); void document.documentElement.requestFullscreen?.().catch(() => undefined) }
  const closeBig = () => { setBig(false); if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined) }

  const line = BOARD.line
  const meta = [s.game.tournament, s.game.venue, live.by && `紀錄 ${live.by}`, s.firstPitchAt && `${hhmm(s.firstPitchAt)} 開賽`].filter(Boolean).join('・')
  const markSize = big ? 34 : 22
  const board = (
    <div className={cx('@container relative overflow-hidden', big ? 'rounded-[22px] min-h-full flex flex-col' : 'rounded-[var(--radius)]')}
      style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 30%), ${BOARD.bg}`, color: BOARD.ink, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06), 0 22px 50px -20px rgba(0,0,0,0.55)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: LED_DOTS, backgroundSize: '4px 4px' }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: `radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, ${BOARD_ACCENT} 14%, transparent), transparent 70%)` }} />
      {/* A: LIVE, the inning, the last update, 大螢幕 */}
      <div className={cx('relative flex items-center gap-3 px-3 @xl:px-6 border-b', big ? 'h-14' : 'h-12')} style={{ borderColor: line }}>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[0.14em] shrink-0" style={{ color: BOARD.out }}>
          <span className="relative inline-flex size-2"><span className={cx('absolute inset-0 rounded-full', !reduced && 'animate-ping')} style={{ background: BOARD.out, opacity: 0.6 }} /><span className="relative size-2 rounded-full" style={{ background: BOARD.out }} /></span>LIVE
        </span>
        <span className={cx('figure font-bold whitespace-nowrap tabular-nums', big ? 'text-[26px]' : 'text-[15px]')} aria-label={`第 ${s.inning} 局${s.half === 'top' ? '上' : '下'}`}>
          {ended || !inPlay ? '比賽結束' : <><span style={{ color: BOARD.strike }}>{s.half === 'top' ? '▲' : '▼'}</span>{boardInning(s.inning, s.half)}</>}
        </span>
        <span className="ml-auto figure text-[12px] tabular-nums whitespace-nowrap" style={{ color: BOARD.muted }}>{error ? '重新連線中…' : `${hhmm(live.updatedAt)} 更新`}</span>
        <button type="button" onClick={big ? closeBig : openBig} aria-label={big ? '離開大螢幕' : '大螢幕'} title={big ? '離開大螢幕（Esc）' : '全螢幕投影在球場'}
          className="inline-flex items-center justify-center gap-1.5 h-9 min-w-9 px-2 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors hover:bg-white/10 shrink-0" style={{ color: BOARD.ink, boxShadow: `inset 0 0 0 1px ${line}` }}>
          {big ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}{!narrow && <span>{big ? '離開大螢幕' : '大螢幕'}</span>}
        </button>
      </div>
      {/* B: the scorebug — away team on top, then home; the bases and S/B/O on the right */}
      <div className={cx('relative grid items-center gap-x-2 px-3 @xl:px-6', big ? 'grid-cols-1 @xl:grid-cols-[minmax(0,1fr)_auto] gap-y-3 @xl:gap-x-10' : 'grid-cols-[minmax(0,1fr)_120px] @xl:grid-cols-[minmax(0,1fr)_250px] @xl:gap-x-8', big ? (tight ? 'py-3 flex-1' : 'py-6 @xl:py-10 flex-1') : 'py-2 @xl:py-4')}>
        <div className={cx('min-w-0 flex flex-col', big ? 'gap-2 @xl:gap-4 w-full max-w-[52rem] justify-self-center' : '')}>
          <TeamRow name={top.name} mark={top.us ? markUs(markSize) : markOpp(markSize)} runs={top.r} us={!!top.us} batting={s.half === 'top'} big={big} tight={tight} />
          <TeamRow name={bottom.name} mark={bottom.us ? markUs(markSize) : markOpp(markSize)} runs={bottom.r} us={!!bottom.us} batting={s.half === 'bottom'} big={big} tight={tight} />
        </div>
        <div className={cx('flex items-center justify-end', big ? 'justify-center gap-6' : 'gap-2 @xl:gap-4')}>
          {big ? (
            <>
              <Diamond runners={s.runners} size={tight ? 96 : 150} onBoard />
              <CountLights balls={c.balls} strikes={c.strikes} outs={s.outs} order="SBO" size="lg" onBoard />
            </>
          ) : (
            <>
              <span className="inline-flex @xl:hidden items-center gap-1.5"><Diamond runners={s.runners} size={56} onBoard /><CountLights balls={c.balls} strikes={c.strikes} outs={s.outs} order="SBO" size="sm" onBoard /></span>
              <span className="hidden @xl:inline-flex items-center gap-5"><Diamond runners={s.runners} size={118} onBoard /><CountLights balls={c.balls} strikes={c.strikes} outs={s.outs} order="SBO" size="lg" onBoard /></span>
            </>
          )}
        </div>
        <AnimatePresence>
          {flash && (
            <motion.div key={flash.key} role="status" className="absolute inset-0 grid place-items-center pointer-events-none"
              initial={reduced ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}
              style={{ background: 'radial-gradient(closest-side, rgba(20,21,23,0.94), rgba(20,21,23,0.6))' }}>
              <span className={cx('figure font-bold tracking-[0.04em] px-6 text-center', big ? 'text-[88px] @xl:text-[140px]' : 'text-[34px] @xl:text-[64px]')}
                style={{ color: flash.us ? BOARD_ACCENT : BOARD.ink, textShadow: `0 0 34px ${flash.us ? `color-mix(in srgb, ${BOARD_ACCENT} 70%, transparent)` : 'rgba(243,239,231,0.35)'}` }}>{flash.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* C: the line score — marks instead of names, R H E always on screen */}
      <LineScoreBoard bare compact className="relative border-t" innings={ended ? Math.max(s.inning - 1, s.game.innings ?? 0) : n} current={ended ? undefined : { inning: s.inning, half: s.half }} top={top} bottom={bottom} />
      {/* D: the matchup — 大螢幕 only: on the page it is the 本打席 card under the board (2026-11-28 redesign A+D) */}
      {big && <div className="relative border-t" style={{ borderColor: line }}>
        {!inPlay ? (
          <p className={cx('px-3 @xl:px-6 py-3', big ? 'text-[20px]' : 'text-[13px]')} style={{ color: BOARD.muted }}>比賽結束，等待紀錄員確認</p>
        ) : (
          // one cell per row, placed by the board's width (not the screen's: beside the sidebar or the 文字轉播 column the
          // board is narrower than the window): one column on a phone; from 480 px two (the batter's a little wider), [投手 打者] | [本打席 壘上 下一棒],
          // so neither side is left empty; from 1024 px (a wide screen, 大螢幕) three, [投手] | [打者 本打席] | [壘上 下一棒]
          <div className="grid grid-cols-1 @min-[480px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @5xl:grid-cols-3 py-2">
            <div className={cx(CELL, big ? 'py-2' : 'py-1', '@min-[480px]:col-start-1 @min-[480px]:row-start-1 @5xl:row-span-2')}>
              <MRow big={big} label="投手" value={pitcherName} num={`${pitchCount} 球`} sub={pitcherLine} subNum={pitcherSpeed.max !== null ? <BoardSpeed v={pitcherSpeed.max} big={big} label="最快" /> : undefined} />
            </div>
            <div className={cx(CELL, big ? 'py-2' : 'py-1', '@min-[480px]:col-start-1 @min-[480px]:row-start-2 @min-[480px]:row-span-2 @5xl:col-start-2 @5xl:row-start-1 @5xl:row-span-1 @5xl:border-l')} style={DIVIDER}>
              <MRow big={big} label="打者"
                value={<span className="inline-flex items-center gap-1.5 min-w-0 max-w-full"><span className={cx('figure inline-flex items-center justify-center shrink-0 rounded-[5px] font-bold', big ? 'size-8 text-[16px]' : 'size-5 text-[12px]')} style={{ background: BOARD_ACCENT, color: BOARD.bg }}>{order}</span><span className="truncate">{chipWho(batterName, order)}</span>{side === 'us' && slot?.pos && <span className={cx('shrink-0 font-normal', big ? 'text-[16px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>{slot.pos}</span>}{batsTag && <span className={cx('shrink-0 font-normal', big ? 'text-[16px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>{batsTag}</span>}</span>}
                num={mine.length ? `今日 ${ab} 打數 ${hits} 安` : '今日首打席'}
                sub={mine.length ? <span className="inline-flex flex-wrap gap-1">{mine.map((p, i) => { const g = gridCell(p); return <span key={i} title={g.title} className="figure font-semibold" style={{ color: TONE[g.tone] }}>{g.text}</span> })}</span> : undefined}
                subNum={season && season.ab >= 1 ? `本季 ${f3(season.avg)} OPS ${f3(season.ops)}` : undefined} />
            </div>
            <div className={cx(CELL, big ? 'py-2' : 'py-1', '@min-[480px]:col-start-2 @min-[480px]:row-start-1 @min-[480px]:border-l @5xl:row-start-2')} style={DIVIDER}>
              <MRow big={big} label="本打席" value={<BoardPitches pitches={s.pitches} plays={pills} big={big} speeds={s.speeds} />} num={lastSpeed !== null ? <BoardSpeed v={lastSpeed} big={big} /> : undefined} />
            </div>
            <div className={cx(CELL, big ? 'py-2' : 'py-1', '@min-[480px]:col-start-2 @min-[480px]:row-start-2 @min-[480px]:border-l @5xl:col-start-3 @5xl:row-start-1')} style={DIVIDER}>
              <MRow big={big} wrap label="壘上" value={<span className={cx(!s.runners.length && 'font-normal')} style={s.runners.length ? undefined : { color: BOARD.muted }}>{runnersText.split('・').map((x, i) => <Fragment key={i}>{i > 0 && '・'}<span className="whitespace-nowrap">{x}</span></Fragment>)}</span>} />
            </div>
            <div className={cx(CELL, big ? 'py-2' : 'py-1', '@min-[480px]:col-start-2 @min-[480px]:row-start-3 @min-[480px]:border-l @5xl:col-start-3 @5xl:row-start-2')} style={DIVIDER}>
              <MRow big={big} wrap label="下一棒" value={<span className="font-medium">{nextText ? nextText.split('・').map((x, i) => <Fragment key={i}>{i > 0 && '・'}<span className="whitespace-nowrap">{x}</span></Fragment>) : '—'}</span>} />
            </div>
          </div>
        )}
      </div>}
      {/* E: the newest play, either side, in the feed's words */}
      <div className={cx('relative border-t px-3 @xl:px-6 grid gap-x-2 items-baseline', big ? `${LABEL_BIG} py-4` : `${LABEL} py-2.5`)} style={{ borderColor: line }}>
        <span className={cx(big ? 'text-[14px]' : 'text-[12px]')} style={{ color: BOARD.muted }}>最新</span>
        {/* (two lines where one does not hold a whole sentence: a phone cannot show the title) */}
        <span className={cx('min-w-0 break-words leading-snug', big ? 'text-[24px] font-semibold line-clamp-3 @xl:line-clamp-2' : 'text-[14px] line-clamp-2 @xl:line-clamp-1')} title={latest ? itemText(latest) : undefined}>{latest ? itemText(latest) : '比賽開始'}</span>
      </div>
      {/* F: the half-inning's card (fixed rules, data/liveFacts.ts) and, at two outs, who leads off after the side is retired */}
      {(card || dueText) && (
        <div className={cx('relative border-t px-3 @xl:px-6 py-1.5 flex flex-col gap-1', big ? 'text-[18px]' : 'text-[13px]')} style={{ borderColor: line }}>
          {card && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.button key={card.id} type="button" onClick={() => setCardOpen((o) => !o)} aria-expanded={cardOpen} title={card.text}
                className={cx('flex gap-2 min-w-0 text-left cursor-pointer min-h-9', cardOpen ? 'items-start' : 'items-center')}
                initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                {/* the figure inside the chip, so it does not run into the sentence (「全壘打 2」, then 「8 棒 劉品辰…」) */}
                <span className={cx('shrink-0 inline-flex items-baseline gap-1 font-semibold px-1.5 py-0.5 rounded-[4px] whitespace-nowrap', big ? 'text-[13px]' : 'text-[11px]')} style={{ color: BOARD.bg, background: BOARD_ACCENT }}>
                  {card.kicker}{card.figure && <span className={cx('figure font-bold tabular-nums', big ? 'text-[15px]' : 'text-[13px]')}>{card.figure}</span>}
                </span>
                <span className={cx('min-w-0 leading-snug', cardOpen ? 'line-clamp-2' : 'line-clamp-1')}>{card.text}</span>
              </motion.button>
            </AnimatePresence>
          )}
          {dueText && <div className="min-w-0 truncate"><span style={{ color: BOARD.muted }}>攻守交換後 </span><span className="font-medium">{dueText}</span></div>}
        </div>
      )}
      {/* G: the game */}
      {meta && <div className="relative border-t px-3 @xl:px-6 py-2 text-[11px] truncate" style={{ borderColor: line, color: BOARD.muted }}>{meta}</div>}
    </div>
  )

  const boxCard = box && <Card title="Box Score" subtitle="今天這場到目前為止；底色是打擊中的打者" still flush><BoxScore box={box} /></Card>
  if (big) {
    // a TV or a big monitor: the Box Score beside the board (it scrolls on its own; the board keeps the full height and
    // about 1290 px of width, where its matchup row has room for the names)
    return (
      <div role="dialog" aria-label="即時比分大螢幕" className={cx('fixed inset-0 z-[80] bg-black p-3 overflow-auto', !tight && 'md:p-6')}>
        {boxCard
          ? <div className="grid min-h-full gap-6 grid-cols-[minmax(0,1fr)_min(560px,calc(100vw_-_1360px))]">
              <div className="min-w-0 flex flex-col [&>*]:flex-1">{board}</div>
              <div className="min-w-0 self-start sticky top-0 max-h-[calc(100dvh-48px)] overflow-y-auto rounded-[var(--radius)]">{boxCard}</div>
            </div>
          : board}
      </div>
    )
  }
  // 本打席 (D: MLB's at-bat panel, CPBL's pitch list): batter and pitcher with today's lines, every pitch with the count
  // after it and its 球速, the runner plays where they happened, who is on base and who is up next
  const pitchRows = pitchList(s.pitches, s.speeds)
  const playsAt = (at: (n: number) => boolean) => pills.filter((p) => at(p.at))
  const situation = inPlay ? `${boardInning(s.inning, s.half)}・${s.outs ? `${s.outs} 出局` : '無人出局'}` : ''
  const atBat = (
    <Card title="本打席" still action={situation ? <span className="text-[13px] text-muted tnum">{situation}</span> : undefined}>
      {!inPlay ? <p className="text-[14px] text-muted">比賽結束，等待紀錄員確認</p> : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            <LRow label="打者"
              value={<span className="inline-flex items-center gap-1.5 min-w-0 max-w-full"><span className="figure inline-flex items-center justify-center shrink-0 size-6 rounded-[6px] text-[14px] font-bold bg-accent text-accent-ink">{order}</span><span className="truncate">{chipWho(batterName, order)}</span>{side === 'us' && slot?.pos && <span className="shrink-0 text-[12px] font-normal text-muted">{slot.pos}</span>}{batsTag && <span className="shrink-0 text-[12px] font-normal text-muted">{batsTag}</span>}</span>}
              num={mine.length ? `今日 ${ab} 打數 ${hits} 安` : '今日首打席'}
              sub={mine.length ? <span className="inline-flex flex-wrap gap-1">{mine.map((p, i) => { const g = gridCell(p); return <span key={i} title={g.title} className={cx('figure font-semibold', LIGHT_TONE[g.tone])}>{g.text}</span> })}</span> : undefined}
              subNum={season && season.ab >= 1 ? `本季 ${f3(season.avg)} OPS ${f3(season.ops)}` : undefined} />
            <LRow label="投手" value={pitcherName} num={`${pitchCount} 球`} sub={pitcherLine}
              subNum={pitcherSpeed.max !== null ? <>最快 <span className={cx('font-semibold', speedClass(pitcherSpeed.max) || 'text-ink-2')}>{kmhText(pitcherSpeed.max)}</span></> : undefined} />
          </div>
          <div role="table" aria-label={`本打席 ${s.pitches.length} 球`} className="rounded-[var(--radius-sm)] border border-[var(--border)] overflow-hidden text-[14px]">
            <div role="row" className="grid grid-cols-[36px_minmax(0,1fr)_56px_76px] items-center h-8 px-3 bg-surface-2/70 text-[12px] text-muted">
              <span role="columnheader">球</span><span role="columnheader">結果</span><span role="columnheader" className="text-right">球數</span><span role="columnheader" className="text-right">球速</span>
            </div>
            {!pitchRows.length && !pills.length && <div role="row" className="px-3 py-2.5 text-[13px] text-muted border-t border-[var(--border)]"><span role="cell">還沒投球</span></div>}
            {playsAt((at) => at <= 0).map((p, i) => <PlayRow key={`p0${i}`} text={p.title} />)}
            {pitchRows.map((p, i) => (
              <Fragment key={p.n}>
                <div role="row" className="grid grid-cols-[36px_minmax(0,1fr)_56px_76px] items-center h-9 px-3 border-t border-[var(--border)]">
                  <span role="cell" className="tnum text-muted">{p.n}</span>
                  <span role="cell" className="flex items-center gap-2 font-semibold text-ink min-w-0"><span aria-hidden className="size-2.5 rounded-full shrink-0" style={{ background: PITCH_COLOR[p.code] === BOARD.ink ? 'var(--ink-2)' : PITCH_COLOR[p.code] ?? 'var(--muted)' }} /><span className="truncate">{p.word}</span></span>
                  <span role="cell" className="tnum text-right font-semibold">{p.count}</span>
                  <span role="cell" className={cx('tnum text-right', p.kmh ? speedClass(p.kmh) || 'text-ink' : 'text-muted')}>{p.kmh ? kmhText(p.kmh) : '未測'}</span>
                </div>
                {playsAt((at) => at === i + 1 || (i === pitchRows.length - 1 && at > i + 1)).map((x, k) => <PlayRow key={`p${i}-${k}`} text={x.title} />)}
              </Fragment>
            ))}
          </div>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 pt-3 border-t border-[var(--border)]">
            <LRow wrap label="壘上" value={<span className={cx(!s.runners.length && 'font-normal text-muted')}>{runnersText.split('・').map((x, i) => <Fragment key={i}>{i > 0 && '・'}<span className="whitespace-nowrap">{x}</span></Fragment>)}</span>} />
            <LRow wrap label="下一棒" value={<span className="font-medium">{nextText ? nextText.split('・').map((x, i) => <Fragment key={i}>{i > 0 && '・'}<span className="whitespace-nowrap">{x}</span></Fragment>) : '—'}</span>} />
          </div>
        </div>
      )}
    </Card>
  )

  // 得分經過 (MLB's scoring plays): every play that scored, newest first, with the score after it
  const scoring = feed.flatMap((h) => h.items.filter((it) => scoredItem(it) && !(it.kind === 'event' && it.during)).map((it) => ({ h, it }))).reverse()
  const feedMark = (sd: FeedSide, size = 14) => (sd === 'us' ? markUs(size) : markOpp(size))
  const scoringCard = (
    <Card title="得分經過" still flush>
      {scoring.length ? (
        <ul className="divide-y divide-[var(--border)]">
          {scoring.map(({ h, it }) => (
            <li key={it.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-x-2.5 items-start px-5 py-3">
              <span className="pt-0.5">{feedMark(it.side, 16)}</span>
              <span className="min-w-0 text-[13px] leading-snug text-ink"><span className="block text-[11px] text-muted">{h.title.split(' ')[0]}{'outs' in it && it.outs ? `・${it.outs} 出局` : ''}</span>{scoringText(it)}</span>
              {'score' in it && it.score && <ScoreChip score={it.score} weTop={weTop} mark={feedMark} label="得分後" />}
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-5 text-[13px] text-muted">還沒有得分</p>}
    </Card>
  )

  // 今日投手: ours in the order they came in (the one on the mound marked), and the opponent's pitcher now
  const lines = pitchingLines(s.pitching, [])
  const ourPitchers = [...new Set([...s.pitching.map((p) => p.pitcher), ...(side === 'opp' && s.pitcher ? [s.pitcher] : [])].filter(Boolean))]
  const oppNow = { name: oppPitcherText(s.oppPitcher) || (s.intra ? `${names.opp}投手` : '對方投手'), pc: oppPitchCount(s), max: speedFacts([...oppStintRows(s.batting, s.oppPitcher, s.oppPitcherFrom), ...(side === 'us' ? [now] : [])]).max }
  const onMound = (txt: string) => <span className="ml-1.5 inline-flex items-center h-5 px-1.5 rounded-[4px] text-[11px] font-semibold bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning-text align-middle">{txt}</span>
  const pitchersCard = (
    <Card title="今日投手" still flush>
      <table className="w-full text-[13px]">
        <thead><tr className="text-[11px] text-muted"><th scope="col" className="text-left font-medium pl-5 py-2">{names.us}</th><th scope="col" className="text-right font-medium px-2">局</th><th scope="col" className="text-right font-medium px-2">球數</th><th scope="col" className="text-right font-medium px-2">失分</th><th scope="col" className="text-right font-medium pr-5 pl-2">三振</th></tr></thead>
        <tbody className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {ourPitchers.length ? ourPitchers.map((name) => {
            const l = lines.find((x) => x.name === name)
            const pc = pitcherToday(s.pitching, name, side === 'opp' && name === s.pitcher ? liveSplit(s).current : 0, side === 'opp' ? s.priorPitchers : undefined).pc
            return (
              <tr key={name}>
                <th scope="row" className="text-left font-semibold text-ink pl-5 py-2.5">{name}{side === 'opp' && name === s.pitcher && inPlay && onMound('投球中')}</th>
                <td className="text-right tnum px-2">{ipDisplay(l?.outs ?? 0)}</td><td className="text-right tnum px-2">{pc}</td><td className="text-right tnum px-2">{l?.r ?? 0}</td><td className="text-right tnum pr-5 pl-2">{l?.k ?? 0}</td>
              </tr>
            )
          }) : <tr><td colSpan={5} className="pl-5 py-2.5 text-muted">還沒上場</td></tr>}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border)] text-[13px]">
        <span className="min-w-0 truncate"><span className="text-muted">{names.opp}</span> <span className="font-semibold text-ink">{oppNow.name}</span>{side === 'us' && inPlay && onMound('投球中')}</span>
        <span className="shrink-0 tnum text-ink-2">{oppNow.pc} 球{oppNow.max !== null && <>・最快 <span className={cx('font-semibold', speedClass(oppNow.max) || 'text-ink')}>{kmhText(oppNow.max)}</span></>}</span>
      </div>
    </Card>
  )

  // the pinned bar (phones): away first, the half's batting side lit, the bases and the count; a tap goes back to the board
  const bar = pinned && (
    <div className="lg:hidden fixed inset-x-0 top-14 z-20 px-3 pt-2 pointer-events-none">
      <button type="button" onClick={() => boardRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })}
        aria-label={`比分 ${top.name} ${top.r} 比 ${bottom.name} ${bottom.r}，${inPlay ? boardInning(s.inning, s.half) : '比賽結束'}，回到計分板`}
        className="pointer-events-auto w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-stretch h-14 rounded-[14px] overflow-hidden text-left cursor-pointer"
        style={{ background: BOARD.bg, color: BOARD.ink, boxShadow: '0 10px 24px -12px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
        {[top, bottom].map((t, i) => (
          <span key={i} aria-hidden className="flex items-center gap-2 px-3 min-w-0" style={(i === 0) === (s.half === 'top') && inPlay ? { background: `color-mix(in srgb, ${BOARD_ACCENT} 16%, transparent)` } : undefined}>
            {t.us ? markUs(22) : markOpp(22)}
            {/* (the name only where it fits: below 420 px the marks say who is who) */}
            <span className="hidden min-[420px]:inline min-w-0 truncate text-[13px] font-semibold" style={{ color: t.us ? BOARD_ACCENT : BOARD.ink }}>{t.name}</span>
            <span className="figure ml-auto text-[28px] font-bold tabular-nums leading-none">{t.r}</span>
          </span>
        ))}
        <span aria-hidden className="flex items-center gap-2 px-3 border-l" style={{ borderColor: BOARD.line }}>
          {inPlay ? (
            <>
              <span className="flex flex-col items-center gap-1">
                <span className="figure text-[14px] font-bold" style={{ color: BOARD.strike }}>{s.half === 'top' ? '▲' : '▼'}{s.inning}</span>
                <span className="flex gap-0.5">{[0, 1].map((k) => <span key={k} className="size-1.5 rounded-full" style={{ background: k < s.outs ? BOARD.out : BOARD.off }} />)}</span>
              </span>
              <Diamond runners={s.runners} size={34} onBoard />
              <span className="figure text-[15px] font-semibold tabular-nums">{c.balls}-{c.strikes}</span>
            </>
          ) : <span className="text-[12px]" style={{ color: BOARD.muted }}>比賽結束</span>}
        </span>
      </button>
    </div>
  )

  // the page (2026-11-28, redesign A+D): the board across the top; under it 本打席 and 文字轉播｜Box Score, and beside
  // them on a wide screen 得分經過 and 今日投手 (under them on a phone)
  return (
    <>
      <PageHeader title="即時比分" />
      <div ref={boardRef} className="scroll-mt-20">{board}</div>
      {bar}
      <div className="mt-4 xl:mt-6 grid gap-4 xl:gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 flex flex-col gap-4 xl:gap-6">
          {atBat}
          <Tabs aria-label="看文字轉播或 Box Score" value={panel} onChange={pickPanel} items={PANELS} className="self-start" />
          {panel === 'feed' ? <Broadcast halves={feed} weTop={weTop} opponent={s.game.opponent} storageKey={FEED_FILTER_KEY} innings={reg} /> : boxCard}
        </div>
        <div className="min-w-0 flex flex-col gap-4 xl:gap-6 xl:sticky xl:top-[68px]">
          {scoringCard}
          {pitchersCard}
        </div>
      </div>
    </>
  )
}
