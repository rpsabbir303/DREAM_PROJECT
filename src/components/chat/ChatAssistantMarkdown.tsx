import { memo } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

interface ChatAssistantMarkdownProps {
  content: string
}

function ChatAssistantMarkdownInner({ content }: ChatAssistantMarkdownProps) {
  if (!content.trim()) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[14px] text-amber-200/50">
        <span className="jarvis-typing-dot inline-block h-1 w-1 rounded-full bg-amber-400/80" />
        <span className="jarvis-typing-dot inline-block h-1 w-1 rounded-full bg-amber-300/80" />
        <span className="jarvis-typing-dot inline-block h-1 w-1 rounded-full bg-amber-400/80" />
      </span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0.92 }}
      animate={{ opacity: 1 }}
      className={[
        'markdown-body text-[15px] leading-[1.65] tracking-[0.01em] text-white/[0.93]',
        '[&_a]:text-amber-300/90 [&_a]:underline-offset-2 hover:[&_a]:text-amber-200',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-400/35 [&_blockquote]:bg-amber-500/[0.04] [&_blockquote]:pl-3 [&_blockquote]:text-white/70',
        '[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-medium [&_h1]:text-white/95',
        '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-medium [&_h2]:text-white/90',
        '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/85',
        '[&_hr]:my-3 [&_hr]:border-white/[0.06]',
        '[&_li]:my-0.5 [&_li]:marker:text-amber-400/50',
        '[&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:mb-2.5 [&_p]:last:mb-0',
        '[&_strong]:font-medium [&_strong]:text-amber-100/90',
        '[&_ul]:list-disc [&_ul]:pl-5',
      ].join(' ')}
    >
      <ReactMarkdown
        components={{
          pre: ({ children }) => (
            <pre className="my-2.5 overflow-x-auto rounded-xl border border-amber-400/15 bg-black/40 p-4 text-[13px] leading-snug text-amber-50/90 shadow-inner">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isFenced = Boolean(className?.includes('language-'))
            if (isFenced) {
              return <code className={className}>{children}</code>
            }
            return (
              <code className="rounded-md border border-white/[0.08] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-amber-100/90">
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </motion.div>
  )
}

export const ChatAssistantMarkdown = memo(ChatAssistantMarkdownInner)
