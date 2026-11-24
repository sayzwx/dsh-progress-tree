/**
 * Progress Tree host plugin.
 *
 * A session-scoped projection folds the three `progress_*` tool calls (plus
 * `subagent` spawn calls) into one plain-JSON view. The client reads that view
 * and draws the right-sidebar tree. No new session event type and no
 * `appendPluginRecord` are involved: the session log stays authoritative, and
 * this projection is a pure interpreter over the standard `tool/call` /
 * `tool/result` records.
 *
 * Tool definitions are written as plain ToolDefinition objects (raw JSON Schema)
 * instead of importing `@deepseek-ai/dsh-tools`, because an externally installed
 * bundle resolves bare specifiers from its own directory, not from the host.
 */

export const name = '@local/dsh-progress-tree'

export const inject = ['tools', 'sessionProjections', 'systemPrompt']

const TOOL_NAMES = new Set(['progress_plan', 'progress_update', 'progress_note'])
const SUBAGENT_TOOLS = new Set(['subagent', 'subagent_fork', 'subagent_claude_code'])
const STATUSES = new Set(['pending', 'active', 'done', 'blocked', 'paused'])
const KINDS = new Set(['phase', 'task', 'step', 'agent'])
const SEVERITIES = new Set(['info', 'warn', 'error'])
const MAX_NODES = 200
const MAX_LANES = 20
const MAX_ARTIFACTS = 8

const GUIDANCE = `## Progress tree

Keep a live progress tree for the user whenever work takes more than a couple of steps:

1. Call \`progress_plan\` once at the start. Give a short \`title\`, optional \`summary\`, optional
   parallel \`lanes\`, and the plan as \`tasks\`. Every task needs a stable \`id\` and a \`title\`;
   use \`parentId\` for sub-steps, \`lane\` for a parallel lane, and \`kind\` ("phase" | "task" |
   "step" | "agent"). Mark exactly the step you are doing now as \`"status":"active"\`.
2. Re-plan the moment requirements change. When the user adds, drops, or changes scope, call
   \`progress_plan\` again with the complete new tree, or drop obsolete nodes with
   \`progress_update\` \`{"id":"<node>","remove":true}\`. A plan that no longer matches the latest
   request is flagged stale for the user.
3. Before starting another step, call \`progress_update\` with \`{"id":"<node>","status":"active"}\`.
4. When a step finishes, call \`progress_update\` with \`{"id":"<node>","status":"done","note":"..."}\`
   and list produced files or URLs in \`artifacts\` (\`[{"path":"docs/x.md"}]\`).
5. If a step is blocked, call \`progress_update\` with \`{"id":"<node>","status":"blocked","note":"<reason>"}\`.
   The user sees a red alert with that reason; never leave a blocked step without a note.
6. Use \`progress_note\` between steps for one short narrative line ("schema finished, next the tools"),
   with optional \`severity\` warn/error. Notes are visible to the user immediately.
7. When new work appears mid-flight, call \`progress_update\` with a new \`id\` and \`title\` to append
   a node (optionally with \`parentId\`); the tree grows without a new plan.
8. Update in the same turn as the work: mark the previous step done and the next one active before
   you move on. Never batch updates at the end, and keep exactly one active node at all times.
9. In each user-visible update, state three things explicitly in one short sentence: what was just
   finished ("已完成 …"), what happens now ("现在 …"), and any blocking risk or question ("问题 …").
   The pane streams your visible narration while you work, so keep that sentence current.

Subagent spawns are added to the tree automatically. Keep titles short and concrete; do not use
this for one-line answers, and do not update the tree for every tiny tool call.`

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value, max) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return undefined
  return trimmed
}

function parseArgs(raw) {
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

// Captures the model's own narration ("done X, now Y, risk Z") so the pane can
// show what the agent says about its process even when it forgets to call a tool.
function assistantText(event) {
  const data = isRecord(event.data) ? event.data : undefined
  const message = isRecord(data?.message) ? data.message : data
  const content = message?.content ?? message?.parts ?? data?.content
  const pieces = []
  if (typeof content === 'string') pieces.push(content)
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'text' && typeof part.text === 'string') pieces.push(part.text)
      else if (typeof part?.text === 'string' && part?.type === undefined) pieces.push(part.text)
    }
  }
  const text = pieces.join(' ').replace(/\s+/g, ' ').trim()
  if (text === '') return undefined
  return text.slice(0, 280)
}

function errorText(message) {
  const content = message?.content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
        return part.text.trim().slice(0, 400)
      }
    }
  }
  if (typeof message?.text === 'string' && message.text.trim() !== '') return message.text.trim().slice(0, 400)
  if (typeof message?.error === 'string') return message.error.slice(0, 400)
  return '工具调用失败'
}

function normalizeArtifacts(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (out.length >= MAX_ARTIFACTS) break
    if (typeof item === 'string') {
      const path = asText(item, 500)
      if (path !== undefined) out.push({ path, label: basename(path), kind: 'file' })
      continue
    }
    if (!isRecord(item)) continue
    const path = asText(item.path, 500) ?? asText(item.url, 500)
    if (path === undefined) continue
    out.push({
      path,
      label: asText(item.label, 120) ?? basename(path),
      kind: item.kind === 'url' || item.kind === 'command' ? item.kind : 'file',
    })
  }
  return out
}

function basename(path) {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length === 0 ? path : parts[parts.length - 1]
}

const GLYPHS = { pending: '○', active: '●', done: '✓', blocked: '!', paused: '⏸' }

function statusOf(value) {
  return typeof value === 'string' && STATUSES.has(value) ? value : 'pending'
}

function normalizePlan(args, at) {
  const title = asText(args.title, 200)
  if (title === undefined) return undefined

  const laneIds = new Set()
  const lanes = []
  if (Array.isArray(args.lanes)) {
    for (const lane of args.lanes.slice(0, MAX_LANES)) {
      if (!isRecord(lane)) continue
      const id = asText(lane.id, 80)
      if (id === undefined || laneIds.has(id)) continue
      laneIds.add(id)
      lanes.push({ id, title: asText(lane.title, 200) ?? id, parallel: lane.parallel === true })
    }
  }

  const source = Array.isArray(args.tasks) ? args.tasks : Array.isArray(args.nodes) ? args.nodes : []
  const nodes = []
  const seen = new Set()
  for (const raw of source.slice(0, MAX_NODES)) {
    if (!isRecord(raw)) continue
    const id = asText(raw.id, 80)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const status = statusOf(raw.status)
    nodes.push({
      id,
      title: asText(raw.title, 200) ?? id,
      parentId: asText(raw.parentId, 80) ?? null,
      lane: asText(raw.lane, 80) ?? asText(raw.group, 80) ?? null,
      kind: typeof raw.kind === 'string' && KINDS.has(raw.kind) ? raw.kind : 'task',
      status,
      note: asText(raw.note, 1000) ?? null,
      severity: typeof raw.severity === 'string' && SEVERITIES.has(raw.severity) ? raw.severity : null,
      artifacts: normalizeArtifacts(raw.artifacts),
      startedAt: status === 'active' || status === 'done' ? at : null,
      endedAt: status === 'done' ? at : null,
      updatedAt: at,
    })
  }
  if (nodes.length === 0) return undefined

  for (const node of nodes) {
    if (node.parentId !== null && !seen.has(node.parentId)) node.parentId = null
    if (node.lane !== null && !laneIds.has(node.lane)) node.lane = null
  }

  return {
    title,
    summary: asText(args.summary, 1000) ?? null,
    mode: args.mode === 'parallel' ? 'parallel' : 'serial',
    lanes,
    nodes,
    createdAt: at,
    updatedAt: at,
  }
}

function mergeArtifacts(existing, incoming) {
  const merged = []
  const paths = new Set()
  for (const item of [...existing, ...incoming]) {
    if (paths.has(item.path)) continue
    paths.add(item.path)
    merged.push(item)
    if (merged.length >= MAX_ARTIFACTS) break
  }
  return merged
}

function normalizeUpdate(state, args, at) {
  const id = asText(args.id, 80)
  if (id === undefined) return undefined
  const plan = state.plan

  if (plan === null) {
    // No tree yet: a titled update with a fresh id bootstraps a one-node plan.
    const title = asText(args.title, 200)
    if (title === undefined) return undefined
    const planNow = normalizePlan(
      { title, tasks: [{ id, title, status: statusOf(args.status), note: args.note, artifacts: args.artifacts }] },
      at,
    )
    if (planNow === undefined) return undefined
    return { state: { ...state, plan: planNow, revision: state.revision + 1, updatedAt: at }, added: true }
  }

  if (args.remove === true) {
    if (!plan.nodes.some(node => node.id === id)) return undefined
    const doomed = new Set([id])
    let grew = true
    while (grew) {
      grew = false
      for (const node of plan.nodes) {
        if (node.parentId !== null && doomed.has(node.parentId) && !doomed.has(node.id)) {
          doomed.add(node.id)
          grew = true
        }
      }
    }
    const nodes = plan.nodes.filter(node => !doomed.has(node.id))
    return {
      state: { ...state, plan: { ...plan, nodes, updatedAt: at }, revision: state.revision + 1, updatedAt: at },
      added: false,
    }
  }

  const index = plan.nodes.findIndex(node => node.id === id)

  if (index === -1) {
    const title = asText(args.title, 200)
    if (title === undefined || plan.nodes.length >= MAX_NODES) return undefined
    const parentIdRaw = asText(args.parentId, 80)
    const parentId = parentIdRaw !== undefined && plan.nodes.some(node => node.id === parentIdRaw) ? parentIdRaw : null
    const laneRaw = asText(args.lane, 80)
    const laneExists =
      laneRaw !== undefined &&
      (plan.lanes.some(candidate => candidate.id === laneRaw) || plan.nodes.some(candidate => candidate.lane === laneRaw))
    const status = statusOf(args.status)
    const node = {
      id,
      title,
      parentId,
      lane: laneExists ? laneRaw : null,
      kind: typeof args.kind === 'string' && KINDS.has(args.kind) ? args.kind : 'task',
      status,
      note: asText(args.note, 1000) ?? null,
      severity: typeof args.severity === 'string' && SEVERITIES.has(args.severity) ? args.severity : null,
      artifacts: normalizeArtifacts(args.artifacts),
      startedAt: status === 'active' || status === 'done' ? at : null,
      endedAt: status === 'done' ? at : null,
      updatedAt: at,
    }
    return {
      state: { ...state, plan: { ...plan, nodes: [...plan.nodes, node], updatedAt: at }, revision: state.revision + 1, updatedAt: at },
      added: true,
    }
  }

  const node = { ...plan.nodes[index] }
  let changed = false

  if (typeof args.status === 'string' && STATUSES.has(args.status) && args.status !== node.status) {
    if (node.status === 'done' && args.status === 'active' && args.reopen !== true) {
      // Reopening a finished node is explicit only.
    } else if (args.status === 'done' && node.status !== 'active') {
      // done is only reachable from active; ignore otherwise.
    } else {
      node.status = args.status
      if (args.status === 'blocked' && asText(args.note, 1000) === undefined && node.note === null) {
        node.severity = 'error'
      }
      if (args.status === 'active') {
        node.startedAt = node.startedAt ?? at
        node.endedAt = null
      }
      if (args.status === 'done') {
        node.endedAt = at
        if (node.startedAt === null) node.startedAt = at
      }
      changed = true
    }
  }
  const title = asText(args.title, 200)
  if (title !== undefined && title !== node.title) {
    node.title = title
    changed = true
  }
  const note = asText(args.note, 1000)
  if (note !== undefined) {
    node.note = note
    changed = true
  }
  if (typeof args.severity === 'string' && SEVERITIES.has(args.severity) && args.severity !== node.severity) {
    node.severity = args.severity
    changed = true
  }
  const artifacts = normalizeArtifacts(args.artifacts)
  if (artifacts.length > 0) {
    node.artifacts = mergeArtifacts(node.artifacts, artifacts)
    changed = true
  }
  const parentId = asText(args.parentId, 80)
  if (parentId !== undefined && parentId !== node.id && parentId !== node.parentId) {
    const parentIndex = plan.nodes.findIndex(candidate => candidate.id === parentId)
    if (parentIndex !== -1 && !isAncestor(plan.nodes, parentId, node.id)) {
      node.parentId = parentId
      changed = true
    }
  }
  const lane = asText(args.lane, 80)
  if (lane !== undefined && lane !== node.lane) {
    const laneExists = plan.lanes.some(candidate => candidate.id === lane) || plan.nodes.some(candidate => candidate.lane === lane)
    if (laneExists) {
      node.lane = lane
      changed = true
    }
  }

  if (!changed) return undefined
  node.updatedAt = at
  const nodes = [...plan.nodes]
  nodes[index] = node
  return {
    state: { ...state, plan: { ...plan, nodes, updatedAt: at }, revision: state.revision + 1, updatedAt: at },
    added: false,
  }
}

function isAncestor(nodes, ancestorId, nodeId) {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const guard = new Set()
  let cursor = byId.get(ancestorId)
  while (cursor !== undefined && cursor.parentId !== null && !guard.has(cursor.id)) {
    if (cursor.parentId === nodeId) return true
    guard.add(cursor.id)
    cursor = byId.get(cursor.parentId)
  }
  return false
}

function computeCounts(plan) {
  const counts = { total: 0, done: 0, active: 0, pending: 0, blocked: 0, paused: 0 }
  if (plan === null) return counts
  for (const node of plan.nodes) {
    counts.total += 1
    if (Object.prototype.hasOwnProperty.call(counts, node.status)) counts[node.status] += 1
  }
  return counts
}

function currentNodeId(plan) {
  if (plan === null) return null
  return plan.nodes.find(node => node.status === 'active')?.id ?? null
}

function addNode(state, node, at) {
  const plan = state.plan
  if (plan === null) {
    return {
      ...state,
      plan: {
        title: node.title,
        summary: null,
        mode: 'serial',
        lanes: [],
        nodes: [{ ...node, updatedAt: at }],
        createdAt: at,
        updatedAt: at,
      },
      revision: state.revision + 1,
      updatedAt: at,
    }
  }
  if (plan.nodes.length >= MAX_NODES || plan.nodes.some(candidate => candidate.id === node.id)) return state
  return { ...state, plan: { ...plan, nodes: [...plan.nodes, { ...node, updatedAt: at }], updatedAt: at }, revision: state.revision + 1, updatedAt: at }
}

function patchNode(state, id, patch, at) {
  const plan = state.plan
  if (plan === null) return state
  const index = plan.nodes.findIndex(node => node.id === id)
  if (index === -1) return state
  const node = { ...plan.nodes[index], ...patch, updatedAt: at }
  if (patch.status === 'done') {
    node.endedAt = at
    if (node.startedAt === null) node.startedAt = at
  }
  if (patch.status === 'active') {
    node.startedAt = node.startedAt ?? at
    node.endedAt = null
  }
  const nodes = [...plan.nodes]
  nodes[index] = node
  return { ...state, plan: { ...plan, nodes, updatedAt: at }, revision: state.revision + 1, updatedAt: at }
}

const definition = {
  key: 'progressTree',
  stateSchema: { parse: value => value },
  stateVersion: 4,
  init: () => ({ plan: null, notes: [], live: [], pending: {}, revision: 0, lastError: null, updatedAt: 0, lastUserAt: 0, lastUserText: '' }),
  apply(state, event) {
    if (event.type === 'user/message') {
      const text = assistantText(event)
      return {
        ...state,
        lastUserAt: event.time,
        lastUserText: text === undefined ? '' : text.slice(0, 200),
        revision: state.revision + 1,
        updatedAt: event.time,
      }
    }

    if (event.type === 'assistant/message') {
      const text = assistantText(event)
      if (text === undefined) return state
      const live = [...state.live, { at: event.time, text }].slice(-6)
      return { ...state, live, revision: state.revision + 1, updatedAt: event.time }
    }

    if (event.type === 'tool/call') {
      const { callId, name, arguments: raw } = event.data
      const args = parseArgs(raw)
      if (args === undefined) return state
      if (TOOL_NAMES.has(name)) {
        return { ...state, pending: { ...state.pending, [callId]: { name, args, at: event.time } } }
      }
      if (SUBAGENT_TOOLS.has(name)) {
        const title = asText(args.description, 200) ?? asText(args.prompt, 80) ?? '子 agent'
        return addNode(
          {
            ...state,
            pending: { ...state.pending, [callId]: { name, args, at: event.time } },
          },
          {
            id: 'agent-' + callId,
            title,
            parentId: null,
            lane: null,
            kind: 'agent',
            status: 'active',
            note: null,
            severity: null,
            artifacts: [],
            startedAt: event.time,
            endedAt: null,
          },
          event.time,
        )
      }
      return state
    }

    if (event.type === 'tool/result') {
      const message = event.data.message
      const callId = message?.toolCallId ?? message?.source?.callId
      if (callId === undefined || state.pending[callId] === undefined) return state
      const pending = { ...state.pending }
      const call = pending[callId]
      delete pending[callId]
      const at = event.time
      const failed = message?.isError === true

      if (SUBAGENT_TOOLS.has(call.name)) {
        const id = 'agent-' + callId
        let next = { ...state, pending }
        next = patchNode(
          next,
          id,
          failed
            ? { status: 'blocked', severity: 'error', note: errorText(message) }
            : { status: 'done', severity: null, note: '子 agent 已完成' },
          at,
        )
        if (failed) next = { ...next, lastError: { nodeId: id, text: errorText(message), at } }
        return next
      }

      if (failed) {
        return {
          ...state,
          pending,
          lastError: { nodeId: call.args?.id ?? null, text: errorText(message), at },
          updatedAt: at,
        }
      }

      let next = { ...state, pending, lastError: null }
      if (call.name === 'progress_plan') {
        const plan = normalizePlan(call.args, call.at)
        if (plan !== undefined) {
          next = { ...next, plan, revision: next.revision + 1, updatedAt: call.at }
        }
      } else if (call.name === 'progress_update') {
        const updated = normalizeUpdate(next, call.args, call.at)
        if (updated !== undefined) next = updated.state
      } else if (call.name === 'progress_note') {
        const text = asText(call.args.text, 1000)
        if (text !== undefined) {
          const note = {
            at: call.at,
            text,
            nodeId: asText(call.args.nodeId, 80) ?? null,
            severity: typeof call.args.severity === 'string' && SEVERITIES.has(call.args.severity) ? call.args.severity : 'info',
          }
          next = { ...next, notes: [...next.notes, note].slice(-50), revision: next.revision + 1, updatedAt: call.at }
        }
      }
      return next
    }

    return state
  },
  wire: {
    viewSchema: { parse: value => value },
    view(state) {
      const plan = state.plan
      const counts = computeCounts(plan)
      return {
        version: 1,
        revision: state.revision,
        mode: plan?.mode ?? 'serial',
        plan,
        nodes: plan?.nodes ?? [],
        counts,
        currentNodeId: currentNodeId(plan),
        lastError: state.lastError,
        notes: state.notes,
        live: state.live,
        lastUserAt: state.lastUserAt,
        lastUserText: state.lastUserText,
        stale: plan !== null && state.lastUserAt > plan.updatedAt,
        updatedAt: state.updatedAt,
      }
    },
  },
}

function artifactSchema() {
  return {
    type: 'array',
    description: 'Produced files or URLs, e.g. [{"path":"docs/plan.md"}].',
    items: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        label: { type: 'string' },
        kind: { type: 'string', enum: ['file', 'url', 'command'] },
      },
      required: ['path'],
      additionalProperties: false,
    },
  }
}

function taskSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Stable node id (e.g. "schema").' },
      title: { type: 'string' },
      parentId: { type: 'string' },
      lane: { type: 'string' },
      kind: { type: 'string', enum: ['phase', 'task', 'step', 'agent'] },
      status: { type: 'string', enum: ['pending', 'active', 'done', 'blocked', 'paused'] },
      note: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warn', 'error'] },
      artifacts: artifactSchema(),
    },
    required: ['id', 'title'],
    additionalProperties: false,
  }
}

const planTool = {
  name: 'progress_plan',
  description:
    'Create or replace the live progress tree shown to the user in the right sidebar. Call once at the start of multi-step work. `tasks` are the visible steps: use parentId for sub-steps, lane for parallel lanes, kind for phase/task/step/agent, and artifacts for produced files/URLs. Mark the current step as status "active".',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short goal title for the tree.' },
      summary: { type: 'string', description: 'One sentence on the intended outcome.' },
      mode: { type: 'string', enum: ['serial', 'parallel'] },
      lanes: {
        type: 'array',
        description: 'Optional parallel lanes (e.g. research, implement, verify).',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            parallel: { type: 'boolean' },
          },
          required: ['id'],
          additionalProperties: false,
        },
      },
      tasks: {
        type: 'array',
        description: 'Ordered nodes of the plan. The active node is what the user sees as "now".',
        items: taskSchema(),
      },
    },
    required: ['title', 'tasks'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render(args, value) {
      const count = Array.isArray(value?.nodes) ? value.nodes.length : 0
      return [{ type: 'text', text: `Progress plan "${args.title}" created with ${count} node(s).` }]
    },
  },
  execute(args) {
    const plan = normalizePlan(args, Date.now())
    if (plan === undefined) throw new Error('progress_plan needs a title and at least one task with an id and title')
    return { nodes: plan.nodes.map(node => ({ id: node.id, title: node.title, status: node.status })) }
  },
}

const updateTool = {
  name: 'progress_update',
  description:
    'Update one node in the live progress tree: status, note, severity, artifacts, title, parentId or lane. Set status "active" when starting a step, "done" when it finishes, "blocked" when stuck (with a reason in note), "paused" when waiting on the user. Set remove:true to delete a node and its children when requirements change. A new id plus title appends a node.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Node id from progress_plan.' },
      status: { type: 'string', enum: ['pending', 'active', 'done', 'blocked', 'paused'] },
      title: { type: 'string' },
      note: { type: 'string', description: 'One user-facing sentence; required in spirit when blocked.' },
      severity: { type: 'string', enum: ['info', 'warn', 'error'] },
      artifacts: artifactSchema(),
      parentId: { type: 'string' },
      lane: { type: 'string' },
      remove: { type: 'boolean', description: 'Delete this node and its descendants (use when the plan changed).' },
      reopen: { type: 'boolean', description: 'Explicitly reopen a done node.' },
    },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render(args) {
      const status = typeof args.status === 'string' ? args.status : 'updated'
      return [{ type: 'text', text: `Progress node "${args.id}" ${status}.` }]
    },
  },
  execute(args) {
    if (asText(args.id, 80) === undefined) throw new Error('progress_update needs a node id')
    if (args.status === 'blocked' && asText(args.note, 1000) === undefined) {
      throw new Error('progress_update with status "blocked" needs a note explaining the blocker')
    }
    return { id: args.id, status: args.status ?? null }
  },
}

const noteTool = {
  name: 'progress_note',
  description:
    'Append one short narrative line to the live progress tree, e.g. what just finished and what happens next. Use it between steps so the user always knows where the work stands.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'One short sentence.' },
      nodeId: { type: 'string', description: 'Optional node this note belongs to.' },
      severity: { type: 'string', enum: ['info', 'warn', 'error'] },
    },
    required: ['text'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render() {
      return [{ type: 'text', text: 'Progress note added.' }]
    },
  },
  execute(args) {
    const text = asText(args.text, 1000)
    if (text === undefined) throw new Error('progress_note needs non-empty text')
    return { text }
  },
}

export async function apply(ctx) {
  const handle = await ctx.sessionProjections.register(definition)
  ctx.effect(() => () => handle.dispose(), 'dsh-progress-tree: projection')

  ctx.effect(() => ctx.tools.register(planTool), 'dsh-progress-tree: progress_plan')
  ctx.effect(() => ctx.tools.register(updateTool), 'dsh-progress-tree: progress_update')
  ctx.effect(() => ctx.tools.register(noteTool), 'dsh-progress-tree: progress_note')

  ctx.effect(
    () => ctx.systemPrompt.section({ name: 'dsh-progress-tree:guidance', order: 90, text: GUIDANCE }),
    'dsh-progress-tree: guidance',
  )
}
