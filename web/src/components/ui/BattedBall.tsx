/**
 * Where a ball in play went, on a small field (MLB Gameday's hit location, drawn from what the recorder notes: the 落點
 * code, the 軌跡 and the 強度 — no coordinates or exit speed). The 文字轉播 shows it when a plate appearance is opened
 * (2026-11-28, the 即時比分 redesign D).
 */
import { WHERE } from '../../data/gameText'
import { trajWord } from '../../data/broadcast'

/** Each 落點 code's spot on a 120 × 100 field (home plate at 60,94): the fielder's place, or the middle of a gap. */
const SPOT: Record<number, [number, number]> = {
  1: [60, 71], 2: [60, 89], 3: [83, 63], 4: [71, 51], 5: [37, 63], 6: [49, 51], 7: [24, 31], 8: [60, 15], 9: [96, 31],
  56: [41, 55], 46: [60, 45], 34: [79, 55], 78: [40, 21], 89: [80, 21],
}
const HOME: [number, number] = [60, 94]
const QUALITY_WORD: Record<string, string> = { 強: '強勁', 中: '普通', 弱: '軟弱' }

/** 「游擊方向（6）」「左中間」 */
export const placeWord = (loc?: number): string => (loc && WHERE[loc] ? `${WHERE[loc]}${loc < 10 ? `（${loc}）` : ''}` : '')

/** The path from home to the spot: straight for a grounder or a liner, an arc for a fly ball or a pop-up. */
function track(traj: string | undefined, [x, y]: [number, number]): string {
  const [hx, hy] = HOME
  if (traj === 'F' || traj === 'P') {
    // lift the control point toward the sky, more for a pop-up over a short way
    const mx = (hx + x) / 2, my = (hy + y) / 2
    return `M${hx} ${hy} Q${mx} ${my - (traj === 'P' ? 34 : 26)} ${x} ${y}`
  }
  return `M${hx} ${hy} L${x} ${y}`
}

export function BattedBall({ loc, traj, quality, className }: { loc?: number; traj?: string; quality?: string; className?: string }) {
  const spot = loc ? SPOT[loc] : undefined
  const where = placeWord(loc)
  const how = trajWord(traj)
  const label = ['擊球', where && `方向 ${where}`, how, quality && QUALITY_WORD[quality] ? `強度 ${QUALITY_WORD[quality]}` : ''].filter(Boolean).join('，')
  return (
    <div className={className ?? 'flex items-center gap-3'}>
      <svg role="img" aria-label={label} viewBox="0 0 120 100" className="w-[112px] h-[94px] shrink-0">
        <path d="M60 96 L4 40 Q60 -16 116 40 Z" fill="color-mix(in srgb, var(--good) 12%, var(--surface))" stroke="color-mix(in srgb, var(--good) 30%, var(--surface))" strokeWidth="1.5" />
        <path d="M60 96 L85 71 L60 46 L35 71 Z" fill="color-mix(in srgb, var(--accent) 14%, var(--surface))" stroke="color-mix(in srgb, var(--accent) 30%, var(--surface))" strokeWidth="1.5" />
        {([[85, 71], [60, 46], [35, 71]] as const).map(([x, y], i) => <rect key={i} x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(45 ${x} ${y})`} fill="var(--surface)" stroke="var(--border-strong)" />)}
        {spot && (
          <>
            <path d={track(traj, spot)} fill="none" stroke="var(--accent-text)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={traj === 'G' || traj === 'B' ? '4 3' : undefined} />
            <circle cx={spot[0]} cy={spot[1]} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
        {where && <><dt className="text-muted">方向</dt><dd className="m-0 font-semibold text-ink">{where}</dd></>}
        {how && <><dt className="text-muted">軌跡</dt><dd className="m-0 font-semibold text-ink">{how}</dd></>}
        {quality && QUALITY_WORD[quality] && <><dt className="text-muted">強度</dt><dd className="m-0 font-semibold text-ink">{QUALITY_WORD[quality]}</dd></>}
      </dl>
    </div>
  )
}
