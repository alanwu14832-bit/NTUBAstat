// Copy the blank master workbook (data/棒球數據總表.xlsx, BLANK=1 python3 tools/build_workbook.py) into public/ so the "下載總表範本" link works on any host.
// Runs before every build (npm "prebuild"); silently skips when the file is not present.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve(process.cwd(), '..', 'data', '棒球數據總表.xlsx')
const dstDir = resolve(process.cwd(), 'public')
if (existsSync(src)) {
  mkdirSync(dstDir, { recursive: true })
  copyFileSync(src, resolve(dstDir, '棒球數據總表.xlsx'))
  console.log('[prebuild] copied master workbook into public/')
} else {
  console.log('[prebuild] master workbook not found; skipping copy')
}
