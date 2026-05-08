import type { CommandPaletteItem } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

function score(query: string, target: string) {
  if (!query) return 0
  const loweredQuery = query.toLowerCase()
  const loweredTarget = target.toLowerCase()
  if (loweredTarget.includes(loweredQuery)) return loweredQuery.length / loweredTarget.length
  let qi = 0
  let hits = 0
  for (let i = 0; i < loweredTarget.length && qi < loweredQuery.length; i += 1) {
    if (loweredTarget[i] === loweredQuery[qi]) {
      hits += 1
      qi += 1
    }
  }
  return hits / loweredTarget.length
}

export function searchCommandPalette(memoryRepository: MemoryRepository, query: string): CommandPaletteItem[] {
  const workflows = memoryRepository.getWorkflows().slice(0, 20).map<CommandPaletteItem>((item) => ({
    id: `workflow-${item.id}`,
    label: item.name,
    description: item.description,
    category: 'workflow',
    payload: item.id,
  }))
  const commands = memoryRepository.getRecentCommands(30).map<CommandPaletteItem>((item) => ({
    id: `command-${item.id}`,
    label: item.command,
    description: `Recent command (${item.result})`,
    category: 'command',
    payload: item.command,
  }))
  const memory = memoryRepository.semanticSearch(query, 10).map<CommandPaletteItem>((item) => ({
    id: `memory-${item.id}`,
    label: item.content.slice(0, 80),
    description: `Memory hit (${item.kind})`,
    category: 'memory',
    payload: item.content,
  }))
  const actions: CommandPaletteItem[] = [
    {
      id: 'action-toggle-voice',
      label: 'Toggle Voice Mode',
      description: 'Enable or disable overlay voice mode',
      category: 'action',
      payload: 'toggle-voice',
    },
    {
      id: 'action-open-chat',
      label: 'Open Main Chat',
      description: 'Bring main assistant chat to front',
      category: 'action',
      payload: 'open-chat',
    },
  ]
  return [...actions, ...workflows, ...commands, ...memory]
    .map((item) => ({ item, score: score(query, `${item.label} ${item.description}`) }))
    .filter((entry) => entry.score > 0 || query.trim().length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map((entry) => entry.item)
}
