import { ReactNode, useMemo } from 'react'
import { Coins, Sprout, Building2, Sword, Sparkles, ShoppingCart, TrendingUp, TrendingDown, MessageSquare } from 'lucide-react'

type Props = {
  events: string[]
  turn?: number
  maxItems?: number // how many rows to show; defaults to 3
}

type Meta = { icon: ReactNode; color: string; title?: string }

function classify(msg: string): Meta {
  const m = msg || ''
  // price movement
  if (/(価格|相場|price)/i.test(m)) {
    const up = /\+\d|上|↑/.test(m)
    return { icon: up ? <TrendingUp /> : <TrendingDown />, color: up ? 'text-emerald-600' : 'text-rose-600', title: '相場' }
  }
  // bazaar / buyer
  if (/(バザー|バイヤー|bazaar|buyer)/i.test(m)) return { icon: <ShoppingCart />, color: 'text-amber-600', title: 'バザー' }
  // harvest
  if (/(収穫|harvest)/i.test(m)) return { icon: <Sprout />, color: 'text-green-600', title: '収穫' }
  // plant
  if (/(植|plant)/i.test(m)) return { icon: <Sprout />, color: 'text-lime-600', title: '栽培' }
  // build / estate
  if (/(建設|建|estate|build)/i.test(m)) return { icon: <Building2 />, color: 'text-indigo-600', title: '建設' }
  // invade / minigame
  if (/(侵入|ミニ|minigame|invader|インベーダ)/i.test(m)) return { icon: <Sword />, color: 'text-red-600', title: 'バトル' }
  // story
  if (/(AIストーリー|ストーリー|story)/i.test(m)) return { icon: <Sparkles />, color: 'text-fuchsia-600', title: '物語' }
  // coins / gold
  if (/(コイン|ゴールド|coin|gold)/i.test(m)) return { icon: <Coins />, color: 'text-yellow-600', title: 'コイン' }
  // default
  return { icon: <MessageSquare />, color: 'text-slate-600', title: 'ログ' }
}

export default function EventLog({ events, turn, maxItems = 3 }: Props) {
  const rows = Math.max(1, maxItems)
  const items = useMemo(() => {
    const arr = Array.isArray(events) ? events : []
    const shouldHide = (m: string) => {
      const s = (m || '').trim()
      if (!s) return true
      // Hide minigame countdown logs — UI overlay handles this
      if (/^(?:バトル|battle)$/i.test(s)) return true
      if (/(?:インベーダー|Invader)\s*[:：]\s*(?:3|2|1|Start!?)/i.test(s)) return true
      return false
    }
    const filtered = arr.filter(m => !shouldHide(m))
    const last = filtered.slice(-rows)
    const pad = Math.max(0, rows - last.length)
    return Array(pad).fill(null).concat(last) as (string | null)[]
  }, [events, rows])

  const sanitize = (m: string) => {
    let s = m || ''
    // Remove explicit "AIストーリー" prefix if present
    s = s.replace(/AIストーリー[:：]?\s*/g, '')
    // Also remove mojibake variants like "AI�X�g�[���[" followed by colon
    s = s.replace(/AI[^\x00-\x7F]{2,12}[:：]?\s*/g, '')
    return s
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-700">ログ</div>
        {typeof turn === 'number' && (
          <div className="text-xs text-slate-500">ターン {turn}</div>
        )}
      </div>
      <div className="bg-white/80 backdrop-blur rounded-lg border shadow-inner">
        <ul className="divide-y">
          {items.map((msg, i) => {
            if (msg === null) {
              return (
                <li key={i} className="h-8 px-3 flex items-center text-sm text-slate-300 select-none">
                  
                </li>
              )
            }
            const meta = classify(msg)
            const text = sanitize(msg)
            return (
              <li key={i} className="h-8 px-3 flex items-center">
                <div className={`mr-2 ${meta.color}`}>{meta.icon}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mr-2 whitespace-nowrap">{meta.title}</div>
                <div className="text-sm text-slate-800 truncate">{text}</div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
