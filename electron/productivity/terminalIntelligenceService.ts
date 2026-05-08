import { randomUUID } from 'node:crypto'
import type { TerminalAnalysisResult, TerminalIssue } from '../../shared/interfaces/ipc.js'

export function analyzeTerminalOutput(text: string): TerminalAnalysisResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const issues: TerminalIssue[] = []
  for (const line of lines) {
    if (!line) continue
    const lower = line.toLowerCase()
    if (/error ts\d+/.test(lower) || lower.includes('typescript error')) {
      issues.push(createIssue('error', 'typescript', line, 'Fix the typed mismatch or missing property first.'))
      continue
    }
    if (lower.includes('vite') && lower.includes('failed')) {
      issues.push(createIssue('error', 'build', line, 'Check import path aliases and unresolved modules.'))
      continue
    }
    if (lower.includes('npm err') || lower.includes('cannot find module')) {
      issues.push(createIssue('error', 'dependency', line, 'Run dependency install and verify package versions.'))
      continue
    }
    if (lower.includes('warning')) {
      issues.push(createIssue('warning', 'unknown', line, 'Review this warning to prevent future build failures.'))
    }
  }

  const summary = issues.length
    ? `Detected ${issues.length} terminal issue(s) with ${issues.filter((issue) => issue.level === 'error').length} error(s).`
    : 'No critical terminal errors detected in the provided log.'

  return {
    summary,
    issues: issues.slice(0, 20),
    createdAt: new Date().toISOString(),
  }
}

function createIssue(
  level: TerminalIssue['level'],
  category: TerminalIssue['category'],
  message: string,
  suggestion: string,
): TerminalIssue {
  return {
    id: randomUUID(),
    level,
    category,
    message,
    suggestion,
  }
}
