/**
 * Automation Debug Panel
 *
 * Press Ctrl+Shift+D to show/hide.
 *
 * Contains:
 *  1. Direct execution buttons — bypass NLP entirely, call execution layer directly
 *  2. Window snapshot — show all windows detected by DesktopStateEngine + live PS
 *  3. Last execution result from the NLP path
 *  4. Self-test runner
 *
 * If buttons work but chat commands fail → problem is in NLP routing
 * If buttons fail → problem is in execution layer itself
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { desktopClient } from '@/services/desktop/desktopClient'
import type { AIHealthSnapshot } from '@shared/types/desktop'

interface ExecResult {
  ok: boolean
  message: string
  at: string
  label: string
}

interface WindowEntry {
  title: string
  processName: string
  pid: number
  hwnd?: number
  isFocused?: boolean
  isMinimized?: boolean
}

interface SnapshotGroup {
  source: string
  windows: WindowEntry[]
}

interface SelfTestStep {
  name: string
  ok: boolean
  message: string
  ms: number
}

interface SelfTestReport {
  passed: number
  failed: number
  totalMs: number
  steps: SelfTestStep[]
  summary: string
}

export function DebugPanel() {
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'direct' | 'windows' | 'last' | 'test' | 'ai'>('ai')

  // Direct exec state
  const [execResult, setExecResult] = useState<ExecResult | null>(null)
  const [execLoading, setExecLoading] = useState(false)
  const [typeText, setTypeText] = useState('Hello from JARVIS')

  // Window snapshot state
  const [snapshot, setSnapshot] = useState<SnapshotGroup[]>([])
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Self-test state
  const [testReport, setTestReport] = useState<SelfTestReport | null>(null)
  const [testRunning, setTestRunning] = useState(false)

  // AI health state
  const [aiHealth, setAiHealth] = useState<AIHealthSnapshot | null>(null)
  const [aiHealthLoading, setAiHealthLoading] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyResult, setApiKeyResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Last execution from NLP path
  const lastExecution = useChatStore((s) => s.lastExecution)
  const lastDebugInfo = useChatStore((s) => s.lastDebugInfo)

  const scrollRef = useRef<HTMLDivElement>(null)

  const loadAiHealth = useCallback(async () => {
    setAiHealthLoading(true)
    try {
      const h = await window.jarvis.aiHealth?.getStatus()
      if (h) setAiHealth(h)
    } catch { /* ignore */ } finally {
      setAiHealthLoading(false)
    }
  }, [])

  const pingAi = useCallback(async () => {
    setAiHealthLoading(true)
    try {
      const h = await window.jarvis.aiHealth?.ping()
      if (h) setAiHealth(h)
    } catch { /* ignore */ } finally {
      setAiHealthLoading(false)
    }
  }, [])

  const saveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return
    setApiKeySaving(true)
    setApiKeyResult(null)
    try {
      const r = await window.jarvis.aiHealth?.setApiKey(apiKeyInput.trim())
      if (r) {
        setApiKeyResult({ ok: r.ok, message: r.ok ? 'API key saved — AI is online!' : (r.message ?? 'Key rejected') })
        if (r.status) setAiHealth(r.status)
        if (r.ok) setApiKeyInput('')
      }
    } catch (e) {
      setApiKeyResult({ ok: false, message: String(e) })
    } finally {
      setApiKeySaving(false)
    }
  }, [apiKeyInput])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setVisible((v) => {
          if (!v) void loadAiHealth()  // auto-load AI health when opening
          return !v
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loadAiHealth])

  const direct = async (label: string, type: string, params: Record<string, string> = {}) => {
    setExecLoading(true)
    setExecResult(null)
    try {
      const r = await desktopClient.directExec(type, params)
      setExecResult({ ok: r.ok, message: r.message, at: new Date().toLocaleTimeString(), label })
    } catch (e) {
      setExecResult({ ok: false, message: String(e), at: new Date().toLocaleTimeString(), label })
    } finally {
      setExecLoading(false)
    }
  }

  const loadSnapshot = async () => {
    setSnapshotLoading(true)
    try {
      const data = await desktopClient.windowSnapshot()
      setSnapshot(data)
    } catch (e) {
      setSnapshot([{ source: `Error: ${e}`, windows: [] }])
    } finally {
      setSnapshotLoading(false)
    }
  }

  const runSelfTest = async () => {
    setTestRunning(true)
    setTestReport(null)
    try {
      const r = await desktopClient.selfTest()
      if (r) setTestReport(r)
    } catch (e) {
      setTestReport({
        passed: 0, failed: 1, totalMs: 0,
        steps: [{ name: 'Init', ok: false, message: String(e), ms: 0 }],
        summary: String(e),
      })
    } finally {
      setTestRunning(false)
    }
  }

  if (!visible) return null

  const s: Record<string, React.CSSProperties> = {
    panel: {
      position: 'fixed', bottom: '88px', right: '16px', width: '400px',
      maxHeight: '560px', display: 'flex', flexDirection: 'column',
      background: 'rgba(8, 8, 8, 0.98)', border: '1px solid rgba(255,215,0,0.2)',
      borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace',
      color: '#ccc', zIndex: 9999, boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
    },
    tabs: {
      display: 'flex', gap: '4px', padding: '8px 12px 0',
      flexShrink: 0,
    },
    body: {
      padding: '10px 14px', overflowY: 'auto', flex: 1,
    },
  }

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'rgba(255,215,0,0.15)' : 'transparent',
        border: `1px solid ${tab === id ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
        color: tab === id ? '#ffd700' : '#888',
        cursor: 'pointer', borderRadius: '4px', padding: '3px 8px', fontSize: '10px',
      }}
    >
      {label}
    </button>
  )

  const btn = (
    label: string,
    onClick: () => void,
    color = 'rgba(255,255,255,0.07)',
    disabled = false,
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#222' : color,
        border: '1px solid rgba(255,255,255,0.12)',
        color: disabled ? '#555' : '#ddd',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '5px', padding: '5px 10px', fontSize: '11px',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <span style={{ color: '#ffd700', fontWeight: 700, fontSize: '12px', flex: 1 }}>
          ⚡ AUTOMATION DEBUG
        </span>
        <span style={{ color: '#555', fontSize: '10px' }}>Ctrl+Shift+D</span>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', padding: 0 }}
        >×</button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabBtn('ai', '🤖 AI')}
        {tabBtn('direct', 'Direct Exec')}
        {tabBtn('windows', 'Windows')}
        {tabBtn('last', 'Last NLP')}
        {tabBtn('test', 'Self-Test')}
      </div>

      {/* Body */}
      <div ref={scrollRef} style={s.body}>

        {/* ── TAB: AI Provider Health ── */}
        {tab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* Status banner */}
            {aiHealth && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: aiHealth.status === 'online' ? 'rgba(76,175,80,0.1)' : aiHealth.status === 'degraded' ? 'rgba(255,152,0,0.1)' : 'rgba(244,67,54,0.1)',
                border: `1px solid ${aiHealth.status === 'online' ? 'rgba(76,175,80,0.3)' : aiHealth.status === 'degraded' ? 'rgba(255,152,0,0.3)' : 'rgba(244,67,54,0.3)'}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: aiHealth.status === 'online' ? '#4caf50' : aiHealth.status === 'degraded' ? '#ff9800' : '#f44336' }}>
                  {aiHealth.status === 'online' ? '✓ AI ONLINE' : aiHealth.status === 'degraded' ? '⚠ AI DEGRADED' : '✗ AI OFFLINE'}
                </div>
                <Row label="Provider" value={`${aiHealth.provider} / ${aiHealth.model}`} />
                <Row label="Key set" value={aiHealth.apiKeyConfigured ? 'Yes' : 'NO — see below'} color={aiHealth.apiKeyConfigured ? '#4caf50' : '#f44336'} />
                {aiHealth.lastError && <Row label="Error" value={aiHealth.lastError} color="#f44336" />}
                {aiHealth.lastSuccessAt && <Row label="Last OK" value={new Date(aiHealth.lastSuccessAt).toLocaleTimeString()} color="#4caf50" />}
                {aiHealth.avgLatencyMs !== null && <Row label="Avg latency" value={`${aiHealth.avgLatencyMs}ms`} />}
                <Row label="Requests" value={`${aiHealth.successCount} ok / ${aiHealth.failureCount} failed`} />
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => void loadAiHealth()} disabled={aiHealthLoading}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#ddd', cursor: 'pointer', borderRadius: '5px', padding: '5px', fontSize: '11px' }}>
                {aiHealthLoading ? '⏳' : '⟳ Refresh'}
              </button>
              <button onClick={() => void pingAi()} disabled={aiHealthLoading}
                style={{ flex: 1, background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.3)', color: '#64b5f6', cursor: 'pointer', borderRadius: '5px', padding: '5px', fontSize: '11px' }}>
                {aiHealthLoading ? '⏳' : '📡 Ping Gemini'}
              </button>
            </div>

            {/* API key input */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px' }}>
                Set GEMINI_API_KEY — <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#64b5f6' }}>Get free key →</a>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIza..."
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <button onClick={() => void saveApiKey()} disabled={apiKeySaving || !apiKeyInput.trim()}
                  style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.3)', color: '#4caf50', cursor: 'pointer', borderRadius: '5px', padding: '4px 10px', fontSize: '11px' }}>
                  {apiKeySaving ? '…' : 'Save'}
                </button>
              </div>
              {apiKeyResult && (
                <div style={{ marginTop: '6px', color: apiKeyResult.ok ? '#4caf50' : '#f44336', fontSize: '10px' }}>
                  {apiKeyResult.ok ? '✓' : '✗'} {apiKeyResult.message}
                </div>
              )}
              <div style={{ color: '#444', fontSize: '10px', marginTop: '6px' }}>
                Key is written to .env and active immediately (no restart needed).
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Direct Execution ── */}
        {tab === 'direct' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ color: '#555', fontSize: '10px', marginBottom: '4px' }}>
              Bypasses NLP. If these work, NLP is broken. If these fail, execution is broken.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {btn('Open Notepad', () => direct('Open Notepad', 'app.open', { app: 'notepad', appKey: 'notepad' }), 'rgba(76,175,80,0.1)', execLoading)}
              {btn('Close Notepad', () => direct('Close Notepad', 'app.close', { app: 'notepad', appKey: 'notepad' }), 'rgba(244,67,54,0.1)', execLoading)}
              {btn('Open Explorer', () => direct('Open Explorer', 'app.open', { app: 'file explorer', appKey: 'explorer' }), 'rgba(76,175,80,0.1)', execLoading)}
              {btn('Close Explorer', () => direct('Close Explorer', 'app.close', { app: 'file explorer', appKey: 'explorer' }), 'rgba(244,67,54,0.1)', execLoading)}
              {btn('Open Chrome', () => direct('Open Chrome', 'app.open', { app: 'chrome', appKey: 'chrome' }), 'rgba(76,175,80,0.1)', execLoading)}
              {btn('Close Chrome', () => direct('Close Chrome', 'app.close', { app: 'chrome', appKey: 'chrome' }), 'rgba(244,67,54,0.1)', execLoading)}
              {btn('Alt+Tab', () => direct('Alt+Tab', 'keyboard.shortcut', { key: 'alt+tab' }), 'rgba(33,150,243,0.1)', execLoading)}
              {btn('Ctrl+S', () => direct('Ctrl+S', 'keyboard.shortcut', { key: 'ctrl+s' }), 'rgba(33,150,243,0.1)', execLoading)}
              {btn('Press Enter', () => direct('Enter', 'keyboard.shortcut', { key: 'enter' }), 'rgba(33,150,243,0.1)', execLoading)}
              {btn('Win+D', () => direct('Win+D', 'keyboard.shortcut', { key: 'win+d' }), 'rgba(33,150,243,0.1)', execLoading)}
            </div>

            <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
              <input
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ddd', borderRadius: '4px', padding: '4px 8px', fontSize: '11px',
                  fontFamily: 'monospace',
                }}
                placeholder="text to type..."
              />
              {btn('Type ▶', () => direct(`Type "${typeText}"`, 'keyboard.type', { text: typeText }), 'rgba(33,150,243,0.1)', execLoading || !typeText.trim())}
            </div>

            {execLoading && <div style={{ color: '#ffd700', fontSize: '10px' }}>⏳ Executing…</div>}

            {execResult && (
              <div
                style={{
                  marginTop: '6px', padding: '8px', borderRadius: '6px',
                  background: execResult.ok ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.08)',
                  border: `1px solid ${execResult.ok ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
                }}
              >
                <div style={{ color: execResult.ok ? '#4caf50' : '#f44336', fontWeight: 700, marginBottom: '3px' }}>
                  {execResult.ok ? '✓ OK' : '✗ FAILED'} — {execResult.label}
                </div>
                <div style={{ color: '#ccc', wordBreak: 'break-all' }}>{execResult.message}</div>
                <div style={{ color: '#555', marginTop: '3px' }}>{execResult.at}</div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Window Snapshot ── */}
        {tab === 'windows' && (
          <div>
            <button
              onClick={loadSnapshot}
              disabled={snapshotLoading}
              style={{
                background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)',
                color: '#ffd700', cursor: snapshotLoading ? 'not-allowed' : 'pointer',
                borderRadius: '5px', padding: '5px 12px', fontSize: '11px', marginBottom: '10px', width: '100%',
              }}
            >
              {snapshotLoading ? '⏳ Loading…' : '🔄 Refresh Window Snapshot'}
            </button>

            {snapshot.length === 0 && !snapshotLoading && (
              <div style={{ color: '#555' }}>Click Refresh to query live windows.</div>
            )}

            {snapshot.map((group, gi) => (
              <div key={gi} style={{ marginBottom: '12px' }}>
                <div style={{ color: '#ffd700', fontSize: '10px', marginBottom: '5px', fontWeight: 700 }}>
                  {group.source} ({group.windows.length} windows)
                </div>
                {group.windows.length === 0 ? (
                  <div style={{ color: '#555', fontSize: '10px' }}>No windows detected</div>
                ) : (
                  group.windows.map((w, wi) => (
                    <div
                      key={wi}
                      style={{
                        padding: '4px 6px', marginBottom: '3px', borderRadius: '4px',
                        background: w.isFocused ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ color: w.isFocused ? '#ffd700' : '#ddd', fontWeight: w.isFocused ? 700 : 400 }}>
                        {w.title.slice(0, 50)}
                      </div>
                      <div style={{ color: '#666', fontSize: '10px' }}>
                        {w.processName} · PID {w.pid}{w.hwnd ? ` · HWND ${w.hwnd}` : ''}
                        {w.isFocused ? ' · FOCUSED' : ''}
                        {w.isMinimized ? ' · MINIMIZED' : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: Last NLP Result ── */}
        {tab === 'last' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lastDebugInfo ? (
              <>
                <Row label="Intent" value={lastDebugInfo.intentType} />
                <Row label="App" value={String(lastDebugInfo.intentParams.app ?? '—')} />
                <Row
                  label="Result"
                  value={lastDebugInfo.ok ? '✓ OK' : '✗ FAILED'}
                  color={lastDebugInfo.ok ? '#4caf50' : '#f44336'}
                />
                <Row label="Message" value={lastDebugInfo.message} />
                {lastDebugInfo.output && <Row label="Raw" value={lastDebugInfo.output} />}
                <Row label="Time" value={new Date(lastDebugInfo.at).toLocaleTimeString()} />
              </>
            ) : (
              <div style={{ color: '#555' }}>No NLP automation has run yet.</div>
            )}

            {lastExecution && (
              <>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>Execution Event</div>
                <Row label="ok" value={String(lastExecution.ok)} color={lastExecution.ok ? '#4caf50' : '#f44336'} />
                <Row label="message" value={lastExecution.message} />
                {lastExecution.error && <Row label="error" value={lastExecution.error} color="#f44336" />}
                {lastExecution.output && <Row label="output" value={lastExecution.output} />}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Self-Test ── */}
        {tab === 'test' && (
          <div>
            <div style={{ color: '#555', fontSize: '10px', marginBottom: '8px' }}>
              Opens Notepad, types text, minimizes, restores, then closes it.
              Verifies each step with real process checks.
            </div>
            <button
              onClick={() => void runSelfTest()}
              disabled={testRunning}
              style={{
                background: testRunning ? '#222' : 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700',
                cursor: testRunning ? 'not-allowed' : 'pointer',
                borderRadius: '5px', padding: '6px 12px', fontSize: '11px',
                width: '100%', marginBottom: '10px',
              }}
            >
              {testRunning ? '⏳ Running… (may take ~15s)' : '▶ Run Full Automation Self-Test'}
            </button>

            {testReport && (
              <div>
                <div
                  style={{
                    color: testReport.failed === 0 ? '#4caf50' : '#f44336',
                    fontWeight: 700, marginBottom: '8px', fontSize: '12px',
                  }}
                >
                  {testReport.passed}/{testReport.passed + testReport.failed} steps passed — {testReport.totalMs}ms
                </div>
                {testReport.steps.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '5px 8px', marginBottom: '4px', borderRadius: '5px',
                      background: s.ok ? 'rgba(76,175,80,0.06)' : 'rgba(244,67,54,0.06)',
                      border: `1px solid ${s.ok ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: s.ok ? '#4caf50' : '#f44336' }}>{s.ok ? '✓' : '✗'}</span>
                      <span style={{ color: '#ddd', flex: 1 }}>{s.name}</span>
                      <span style={{ color: '#555', fontSize: '10px' }}>{s.ms}ms</span>
                    </div>
                    {!s.ok && (
                      <div style={{ color: '#f44336', fontSize: '10px', marginTop: '2px', wordBreak: 'break-all' }}>
                        {s.message}
                      </div>
                    )}
                    {s.ok && (
                      <div style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>{s.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '3px', lineHeight: 1.4 }}>
      <span style={{ color: '#555', minWidth: '70px', flexShrink: 0, fontSize: '10px' }}>{label}</span>
      <span style={{ color: color ?? '#ddd', wordBreak: 'break-all', flex: 1, fontSize: '11px' }}>{value}</span>
    </div>
  )
}
