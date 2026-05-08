import type { MemoryRepository } from '../database/memoryRepository.js'
import type { SkillCapabilityOverview, SkillDefinition } from '../../shared/interfaces/ipc.js'
import { buildBuiltinSkills } from './skillRegistry.js'

export class PluginManager {
  private skills: SkillDefinition[] = []

  constructor(private readonly memoryRepository: MemoryRepository) {
    this.skills = buildBuiltinSkills()
    this.hydrateFromMemory()
  }

  listSkills() {
    return [...this.skills]
  }

  setSkillEnabled(skillId: string, enabled: boolean) {
    this.skills = this.skills.map((skill) => (skill.id === skillId ? { ...skill, enabled } : skill))
    this.memoryRepository.setSkillEnabled(skillId, enabled)
    return this.listSkills()
  }

  getCapabilityOverview(): SkillCapabilityOverview {
    const enabledSkills = this.skills.filter((skill) => skill.enabled)
    return {
      totalSkills: this.skills.length,
      enabledSkills: enabledSkills.length,
      toolCount: enabledSkills.reduce((sum, skill) => sum + skill.tools.length, 0),
      commandCount: enabledSkills.reduce((sum, skill) => sum + skill.commands.length, 0),
    }
  }

  getCapabilityPromptSnippet() {
    const enabled = this.skills.filter((skill) => skill.enabled)
    if (enabled.length === 0) return 'No skills are currently enabled.'
    return enabled
      .map((skill) => `- ${skill.name}: tools=[${skill.tools.map((tool) => tool.command).join(', ')}]`)
      .join('\n')
  }

  executeTool(payload: { skillId: string; toolCommand: string; input?: string }) {
    const skill = this.skills.find((item) => item.id === payload.skillId)
    if (!skill) return { ok: false, message: 'Skill not found.' }
    if (!skill.enabled) return { ok: false, message: `Skill "${skill.name}" is disabled.` }
    const tool = skill.tools.find((item) => item.command === payload.toolCommand)
    if (!tool) return { ok: false, message: 'Tool not found in skill.' }
    return { ok: true, message: `Executed ${skill.name} tool "${tool.name}"${payload.input ? `: ${payload.input}` : '.'}` }
  }

  private hydrateFromMemory() {
    const states = this.memoryRepository.getSkillEnabledStates()
    if (states.size === 0) return
    this.skills = this.skills.map((skill) =>
      states.has(skill.id) ? { ...skill, enabled: states.get(skill.id) ?? skill.enabled } : skill,
    )
  }
}
