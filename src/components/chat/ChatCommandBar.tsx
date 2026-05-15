import { Camera, LoaderCircle, Mic, ScanSearch, Send, Square, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { VOICE_INPUT_ENABLED } from '@/store/voiceStore'

interface ChatCommandBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isListening: boolean
  isSpeaking: boolean
  isTranscribing: boolean
  isCapturing: boolean
  isAnalyzing: boolean
  onToggleMic: () => void
  onStopSpeaking: () => void
  onCapture: () => void
  onAnalyze: () => void
  disabled?: boolean
}

function IconButton({
  children,
  onClick,
  disabled,
  active,
  title,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { scale: 1.08, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'jarvis-btn-glass grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50',
        active && 'jarvis-btn-glass-active text-white/90',
        disabled && 'cursor-not-allowed opacity-35',
      )}
    >
      {children}
    </motion.button>
  )
}

export function ChatCommandBar({
  value,
  onChange,
  onSubmit,
  isListening,
  isSpeaking,
  isTranscribing: _isTranscribing,
  isCapturing,
  isAnalyzing,
  onToggleMic,
  onStopSpeaking,
  onCapture,
  onAnalyze,
  disabled,
}: ChatCommandBarProps) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="jarvis-dock-wrap relative mx-auto w-full max-w-2xl"
    >
      <motion.div
        className="jarvis-dock flex items-center gap-2 rounded-xl p-2 pl-4"
        whileHover={{ y: -1 }}
        transition={{ duration: 0.18 }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask anything…"
          disabled={disabled}
          className="jarvis-input min-h-[42px] flex-1 bg-transparent text-[14px] text-white/93 placeholder:font-normal placeholder:text-white/28 disabled:opacity-50"
        />
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <IconButton
            type="submit"
            title="Send"
            disabled={disabled || !value.trim()}
            active={Boolean(value.trim())}
          >
            <Send className="h-4 w-4" />
          </IconButton>
          <IconButton
            title={VOICE_INPUT_ENABLED ? (isListening ? 'Stop listening' : 'Voice input') : 'Voice disabled'}
            disabled={!VOICE_INPUT_ENABLED}
            active={isListening}
            onClick={onToggleMic}
          >
            {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </IconButton>
          <IconButton
            title={VOICE_INPUT_ENABLED ? 'Stop speaking' : 'Speech disabled'}
            disabled={!VOICE_INPUT_ENABLED}
            active={isSpeaking}
            onClick={onStopSpeaking}
          >
            {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </IconButton>
          <IconButton title="Capture screen" onClick={onCapture}>
            {isCapturing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </IconButton>
          <IconButton title="Analyze screen" onClick={onAnalyze}>
            {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          </IconButton>
        </div>
      </motion.div>
    </motion.form>
  )
}
