/**
 * OpenAI Chat Completions "tools" definitions for the JARVIS desktop MVP.
 * Keep in sync with `electron/ai/toolIntentMapper.ts` function names.
 */
export const JARVIS_OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'open_app',
      description:
        'Launch an installed desktop application by common name (e.g. "Visual Studio Code", "VS Code", "Chrome", "Notepad"). Use this when the user wants a program, not a folder or website.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Application display name or well-known short name.' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'open_url',
      description:
        'Open an http(s) URL in the default browser. Use for explicit links or well-known sites (https://...). Do not use for local folders.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Full https:// or http:// URL, or a site the user clearly meant as a webpage.' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'open_folder',
      description:
        'Reveal a directory in the OS file explorer. Use for real paths (e.g. C:\\..., ~/...) or profile aliases like Desktop/Documents. Prefer this over open_app when the user wants a project directory or "open this folder".',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Absolute path, ~/ path, or known user-folder alias.' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_terminal_command',
      description:
        'Run exactly one command that is on the MVP safe whitelist (read-only / dev scripts). Never use for deletion, disk changes, or piping to shells. Prefer open_app / open_folder when those fit.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Single-line command exactly as allowed by policy.' },
        },
        required: ['command'],
      },
    },
  },
]

export type JarvisOpenAiToolName = (typeof JARVIS_OPENAI_TOOLS)[number]['function']['name']
