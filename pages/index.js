
import React, { useEffect, useState, useRef } from 'react'

const BACKEND_REST = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://edgequant-backend-final.eba-ddmvghnd.ap-south-1.elasticbeanstalk.com'
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || (BACKEND_REST.replace(/^http/, 'ws') + '/ws')

function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  useEffect(() => {
    try {
      const ws = new WebSocket(BACKEND_WS)
      ws.onopen = () => console.log('ws open')
      ws.onmessage = e => {
        try { onMessage(JSON.parse(e.data)) } catch(e){ console.error('ws parse', e) }
      }
      ws.onclose = () => console.log('ws closed')
      ws.onerror = e => console.error('ws err', e)
      wsRef.current = ws
      return () => ws.close()
    } catch(e) {
      console.error('ws init error', e)
    }
  }, [onMessage])
  return wsRef
}

function Header() {
  return (
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:12,background:'#0f1724',color:'white'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <img src="./logo.png" alt="EdgeQuant" style={{height:32}} />
        <h1 style={{fontSize:18,fontWeight:600}}>EdgeQuant — Decision Dashboard</h1>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button style={{padding:'6px 10px',background:'#111827',color:'white',borderRadius:6}}>Account</button>
        <button style={{padding:'6px 10px',background:'#111827',color:'white',borderRadius:6}}>Settings</button>
      </div>
    </header>
  )
}


function InstrumentSelector({ instruments, onSelect }) {
  return (
    <div style={{padding:12}}>
      <label style={{display:'block',fontSize:12,marginBottom:6}}>Instrument</label>
      <select style={{width:'100%',padding:8,borderRadius:6}} onChange={e => onSelect(e.target.value)}>
        {instruments.map(i => (
          <option key={i.id} value={i.id}>{i.symbol} · {i.exchange}</option>
        ))}
      </select>
    </div>
  )
}

function MetricCard({ title, value }) {
  return (
    <div style={{background:'rgba(255,255,255,0.03)',padding:12,borderRadius:8}}>
      <div style={{fontSize:12,opacity:0.7}}>{title}</div>
      <div style={{fontSize:18,fontWeight:600}}>{value}</div>
    </div>
  )
}

function ZeroHeroPopup({ open, onClose, suggestions }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <div style={{background:'white',color:'#111827',borderRadius:10,width:'92%',maxWidth:900,padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{fontSize:16,fontWeight:600}}>ZeroHero — High Reward Picks</h2>
          <button onClick={onClose} style={{padding:'6px 10px',borderRadius:6}}>Close</button>
        </div>
        <div style={{display:'grid',gap:10}}>
          {suggestions.length === 0 && <div style={{color:'#6b7280'}}>No suggestions</div>}
          {suggestions.map(s => (
            <div key={s.id} style={{padding:12,border:'1px solid #e5e7eb',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:600}}>{s.symbol} · {s.reason}</div>
                <div style={{fontSize:12,color:'#6b7280'}}>Expiry: {s.expiry} · Prob: {Math.round((s.prob||0)*100)}%</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:13}}>Entry: {s.entry}</div>
                <div style={{fontSize:13}}>SL: {s.sl}</div>
                <div style={{fontSize:13}}>TP: {s.tp}</div>
                <button style={{marginTop:8,padding:'6px 10px',borderRadius:6,border:'1px solid #111827'}}>Take 1 Lot</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TradeCard({ trade }) {
  return (
    <div style={{padding:12,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:600}}>{trade.symbol}</div>
          <div style={{fontSize:12,color:'#9ca3af'}}>{trade.note}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div>Entry {trade.entry}</div>
          <div>SL {trade.sl}</div>
          <div>TP {trade.tp}</div>
        </div>
      </div>
      <div style={{marginTop:8,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        <div style={{fontSize:12}}>Delta: {trade.delta ?? '-'}</div>
        <div style={{fontSize:12}}>OI Change: {trade.oi_change ?? '-'}</div>
        <div style={{fontSize:12}}>PCR: {trade.pcr ?? '-'}</div>
      </div>
    </div>
  )
}

export default function EdgeQuantDashboard() {
  const [instruments, setInstruments] = useState([])
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState({})
  const [trades, setTrades] = useState([])
  const [zeroOpen, setZeroOpen] = useState(false)
  const [zeroSuggestions, setZeroSuggestions] = useState([])

  useEffect(() => {
    fetch(BACKEND_REST + '/api/instruments')
      .then(r => r.json())
      .then(data => { setInstruments(data || []); if (data && data[0]) setSelected(data[0].id) })
      .catch(e => { console.error('instruments', e); setInstruments([]) })
  }, [])

  useEffect(() => {
    if (!selected) return
    fetch(`${BACKEND_REST}/api/snapshot?instrument_id=${selected}`)
      .then(r => r.json())
      .then(s => setMetrics(s || {}))
      .catch(e => console.error('snapshot', e))
  }, [selected])

  function handleWsMessage(msg) {
    if (!msg) return
    if (msg.type === 'tick') {
      setMetrics(prev => ({ ...prev, last_price: msg.price }))
    }
    if (msg.type === 'decision') {
      setTrades(prev => [msg.decision, ...prev].slice(0, 10))
    }
    if (msg.type === 'zerohero') {
      setZeroSuggestions(msg.suggestions || [])
    }
  }

  useWebSocket(handleWsMessage)

  return (
    <div style={{minHeight:'100vh',background:'#0f1724',color:'white'}}>
      <Header />
      <main style={{padding:16,display:'grid',gridTemplateColumns:'300px 1fr',gap:16}}>
        <aside style={{background:'#07132a',borderRadius:8,padding:12}}>
          <InstrumentSelector instruments={instruments} onSelect={setSelected} />
          <div style={{marginTop:12}}>
            <button onClick={() => setZeroOpen(true)} style={{width:'100%',padding:10,background:'#16a34a',borderRadius:8}}>Open ZeroHero</button>
          </div>
          <div style={{marginTop:12,display:'grid',gap:8}}>
            <MetricCard title="Last" value={metrics.last_price ?? '-'} />
            <MetricCard title="OI" value={metrics.oi ?? '-'} />
            <MetricCard title="PCR" value={metrics.pcr ?? '-'} />
          </div>
        </aside>

        <section style={{display:'grid',gridTemplateRows:'auto 1fr',gap:12}}>
          <div style={{background:'#07132a',borderRadius:8,padding:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:12,color:'#9ca3af'}}>Selected</div>
                <div style={{fontSize:20,fontWeight:700}}>{instruments.find(i => i.id === selected)?.symbol ?? '-'}</div>
              </div>
              <div style={{display:'flex',gap:12,color:'#9ca3af'}}>
                <div style={{fontSize:13}}>Vol: {metrics.volume ?? '-'}</div>
                <div style={{fontSize:13}}>VWAP: {metrics.vwap ?? '-'}</div>
              </div>
            </div>
            <div style={{marginTop:12,height:200,background:'rgba(0,0,0,0.3)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af'}}>Chart placeholder</div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
            <div style={{display:'grid',gap:12}}>
              <div style={{background:'#07132a',borderRadius:8,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontWeight:700}}>Trade Suggestions</div>
                  <div style={{fontSize:12,color:'#9ca3af'}}>Recent</div>
                </div>
                <div style={{display:'grid',gap:8}}>
                  {trades.length === 0 && <div style={{color:'#6b7280'}}>No trades</div>}
                  {trades.map(t => <TradeCard key={t.id || t.client_id} trade={t} />)}
                </div>
              </div>

              <div style={{background:'#07132a',borderRadius:8,padding:12}}>
                <div style={{fontWeight:700,marginBottom:8}}>Order Book / Depth</div>
                <div style={{fontSize:13,color:'#9ca3af'}}>Top bids/asks placeholder</div>
              </div>
            </div>

            <div style={{display:'grid',gap:12}}>
              <div style={{background:'#07132a',borderRadius:8,padding:12}}>
                <div style={{fontWeight:700,marginBottom:8}}>Greeks & Options</div>
                <div style={{fontSize:13,color:'#9ca3af'}}>Delta: {metrics.delta ?? '-'} · Gamma: {metrics.gamma ?? '-'}</div>
                <div style={{marginTop:8,fontSize:13}}>OI Change: {metrics.oi_change ?? '-'}</div>
              </div>

              <div style={{background:'#07132a',borderRadius:8,padding:12}}>
                <div style={{fontWeight:700,marginBottom:8}}>Execution</div>
                <div style={{fontSize:13,color:'#9ca3af'}}>One-lot recommended. SL included for all suggestions.</div>
                <div style={{marginTop:8}}><button style={{width:'100%',padding:10,borderRadius:8,background:'#4f46e5'}}>Open Order Panel</button></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <ZeroHeroPopup open={zeroOpen} onClose={() => setZeroOpen(false)} suggestions={zeroSuggestions} />
    </div>
  )
}
