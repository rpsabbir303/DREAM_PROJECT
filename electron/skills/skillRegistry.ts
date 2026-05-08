import type { SkillDefinition } from '../../shared/interfaces/ipc.js'

export function buildBuiltinSkills(): SkillDefinition[] {
  return [
    {
      id: 'developer',
      name: 'Developer Skill',
      description: 'Developer workflows, terminal diagnostics, and script execution helpers.',
      category: 'developer',
      permissions: ['read_memory', 'analyze_terminal', 'run_workflow'],
      commands: ['analyze terminal', 'run dev workflow', 'summarize build'],
      tools: [
        {
          id: 'developer.analyzeTerminal',
          name: 'Analyze Terminal',
          description: 'Analyze terminal output and suggest fixes.',
          command: 'analyze-terminal',
        },
        {
          id: 'developer.runWorkflow',
          name: 'Run Workflow',
          description: 'Execute existing workflow by name or id.',
          command: 'run-workflow',
        },
      ],
      enabled: true,
    },
    {
      id: 'design',
      name: 'Design Skill',
      description: 'UI/UX analysis and design consistency guidance.',
      category: 'design',
      permissions: ['analyze_ui', 'read_memory'],
      commands: ['analyze ui', 'design review'],
      tools: [
        {
          id: 'design.analyzeUi',
          name: 'Analyze UI',
          description: 'Run UI/UX heuristics on latest screen analysis.',
          command: 'analyze-ui',
        },
      ],
      enabled: true,
    },
    {
      id: 'productivity',
      name: 'Productivity Skill',
      description: 'Project intelligence and task generation support.',
      category: 'productivity',
      permissions: ['read_memory', 'run_workflow'],
      commands: ['project context', 'generate tasks', 'suggest next step'],
      tools: [
        {
          id: 'productivity.generateTasks',
          name: 'Generate Tasks',
          description: 'Generate implementation tasks from prompt.',
          command: 'generate-tasks',
        },
      ],
      enabled: true,
    },
  ]
}
