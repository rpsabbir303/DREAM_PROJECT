import { memo } from 'react'
import ReactMarkdown from 'react-markdown'

interface ChatAssistantMarkdownProps {
  content: string
}

/**
 * Assistant-only markdown — tuned for a premium, readable “holographic console” feel.
 */
function ChatAssistantMarkdownInner({ content }: ChatAssistantMarkdownProps) {
  if (!content.trim()) {
    return (
      <span className="inline-block animate-pulse font-mono text-[13px] tracking-wide text-cyan-200/50">
        Awaiting signal…
      </span>
    )
  }

  return (
    <div
      className={[
        'markdown-body text-[14px] leading-relaxed tracking-[0.01em]',
        'text-white/[0.92]',
        '[&_a]:text-cyan-300 [&_a]:underline-offset-2 [&_a]:transition-colors hover:[&_a]:text-cyan-200',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-400/45 [&_blockquote]:bg-cyan-500/[0.06] [&_blockquote]:py-1 [&_blockquote]:pl-3 [&_blockquote]:pr-2 [&_blockquote]:text-white/75',
        '[&_h1]:mb-2 [&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-cyan-50',
        '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-cyan-100/95',
        '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[13px] [&_h3]:font-medium [&_h3]:text-white/90',
        '[&_hr]:my-3 [&_hr]:border-white/10',
        '[&_li]:my-0.5 [&_li]:marker:text-cyan-400/60',
        '[&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:mb-2 [&_p]:last:mb-0 [&_p]:text-white/[0.9]',
        '[&_strong]:font-semibold [&_strong]:text-cyan-50/95',
        '[&_ul]:list-disc [&_ul]:pl-5',
      ].join(' ')}
    >
      <ReactMarkdown
        components={{
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-cyan-500/20 bg-black/55 p-3 text-[12px] leading-snug text-cyan-50/95 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.06)]">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const isFenced = Boolean(className?.includes('language-'))
            if (isFenced) {
              return <code className={className}>{children}</code>
            }
            return (
              <code className="rounded border border-white/10 bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-100">
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const ChatAssistantMarkdown = memo(ChatAssistantMarkdownInner)
