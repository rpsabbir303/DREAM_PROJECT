import { useEffect } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useKnowledgeStore } from '@/store/knowledgeStore'
import { useLearningStore } from '@/store/learningStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useProductivityStore } from '@/store/productivityStore'

export function MemoryPage() {
  const recentCommands = useMemoryStore((state) => state.recentCommands)
  const commandStats = useMemoryStore((state) => state.commandStats)
  const workflows = useMemoryStore((state) => state.workflows)
  const projects = useMemoryStore((state) => state.projects)
  const suggestions = useMemoryStore((state) => state.suggestions)
  const isLoading = useMemoryStore((state) => state.isLoading)
  const error = useMemoryStore((state) => state.error)
  const loadMemoryOverview = useMemoryStore((state) => state.loadMemoryOverview)
  const runWorkflow = useMemoryStore((state) => state.runWorkflow)
  const insights = useProductivityStore((state) => state.insights)
  const loadProductivityContext = useProductivityStore((state) => state.loadProductivityContext)
  const query = useKnowledgeStore((state) => state.query)
  const semanticResults = useKnowledgeStore((state) => state.semanticResults)
  const indexingStatus = useKnowledgeStore((state) => state.indexingStatus)
  const setQuery = useKnowledgeStore((state) => state.setQuery)
  const reindex = useKnowledgeStore((state) => state.reindex)
  const search = useKnowledgeStore((state) => state.search)
  const refreshStatus = useKnowledgeStore((state) => state.refreshStatus)
  const patterns = useLearningStore((state) => state.patterns)
  const recommendations = useLearningStore((state) => state.recommendations)
  const loadLearning = useLearningStore((state) => state.loadLearning)

  useEffect(() => {
    void loadMemoryOverview()
    void loadProductivityContext()
    void refreshStatus()
    void loadLearning()
  }, [loadMemoryOverview, loadProductivityContext, refreshStatus, loadLearning])

  return (
    <GlassPanel className="min-h-[70vh]">
      <h3 className="text-lg font-semibold text-white">Memory Archive</h3>
      <p className="mt-2 text-sm text-white/60">Saved memories, favorite commands, and learned behavior signals.</p>
      {isLoading && <p className="mt-3 text-xs text-cyan-300">Loading memory graph...</p>}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Frequent Commands</p>
          {commandStats.slice(0, 6).map((item) => (
            <div key={item.command} className="flex items-center justify-between text-xs text-white/80">
              <span>{item.command}</span>
              <span className="text-cyan-300">{item.usageCount}x</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Recent Commands</p>
          {recentCommands.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs text-white/80">
              <span>{item.command}</span>
              <span className="uppercase text-cyan-300">{item.result}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Project Memory</p>
          {projects.slice(0, 4).map((project) => (
            <div key={project.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
              <p className="text-sm text-white/85">{project.name}</p>
              <p className="mt-1 text-xs text-white/50">{project.folderPath}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Workflow Memory</p>
          {workflows.slice(0, 4).map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => void runWorkflow(workflow.id)}
              className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-left transition hover:border-cyan-300/40"
            >
              <p className="text-sm text-white/85">{workflow.name}</p>
              <p className="mt-1 text-xs text-white/50">{workflow.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Personalization Signals</p>
        <div className="mt-2 space-y-2">
          {suggestions.slice(0, 5).map((suggestion) => (
            <p key={suggestion.id} className="text-sm text-white/80">
              {suggestion.message}
            </p>
          ))}
        </div>
      </div>
      {(patterns.length > 0 || recommendations.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Learned Behavior Patterns</p>
            {patterns.slice(0, 4).map((pattern) => (
              <p key={pattern.id} className="mt-2 text-xs text-white/75">
                {pattern.name} ({Math.round(pattern.confidence * 100)}%) - {pattern.frequency}x
              </p>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Recommendation History</p>
            {recommendations.slice(0, 4).map((item) => (
              <p key={item.id} className="mt-2 text-xs text-white/75">
                {item.title} [{item.status}]
              </p>
            ))}
          </div>
        </div>
      )}
      {insights && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Project Intelligence</p>
          <p className="mt-2 text-sm text-white/80">
            {insights.projectContext?.projectName ?? 'Unknown project'} ({insights.projectContext?.projectType ?? 'unknown'})
          </p>
          <p className="mt-1 text-xs text-white/55">{insights.latestTerminalSummary}</p>
        </div>
      )}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Knowledge Indexing</p>
        <p className="mt-1 text-xs text-white/60">
          Indexed chunks: {indexingStatus?.indexedChunkCount ?? 0} | Last run:{' '}
          {indexingStatus?.lastIndexedAt ? new Date(indexingStatus.lastIndexedAt).toLocaleString() : 'never'}
        </p>
        <button
          onClick={() => void reindex()}
          className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-100"
        >
          Reindex Knowledge
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Semantic Memory Search</p>
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find TypeScript error from yesterday"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
          />
          <button
            onClick={() => void search()}
            className="rounded-lg border border-cyan-300/30 bg-cyan-500/20 px-3 text-xs text-cyan-200"
          >
            Search
          </button>
        </div>
        <div className="mt-2 space-y-1">
          {semanticResults.slice(0, 6).map((item) => (
            <p key={item.chunk.id} className="text-xs text-white/75">
              [{item.chunk.sourceType}] {item.chunk.content.slice(0, 120)}
            </p>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
