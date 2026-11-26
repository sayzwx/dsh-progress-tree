window.__ModuleLoader__.load({
  id: '@local/dsh-progress-tree',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'progress-tree'
    const ID = '@local/dsh-progress-tree'
    const KIND = 'progress'
    const NOOP_SUBSCRIBE = () => () => {}
    let openProgressTab = () => {}
    let clientSessions

    const zh = {
      title: '进度树',
      guideTitle: '进度树',
      guideDescription: '查看 AI 的任务规划、当前节点与产物',
      empty: '还没有进度计划',
      emptyHint: '当 AI 开始多步任务时，会在这里生成任务树、当前节点和产物。',
      allDone: '全部完成',
      blocked: '有阻塞',
      notes: '过程记录',
      artifacts: '产物',
      lane: '泳道',
      current: '当前',
      progress: '进度',
      liveDone: '已完成',
      liveNow: '现在',
      liveNext: '接下来',
      liveProblem: '问题',
      liveNarration: 'AI 近况',
      reopen: '打开进度树',
      copyPath: '点击复制路径',
      'status.pending': '待开始',
      'status.active': '进行中',
      'status.done': '已完成',
      'status.blocked': '阻塞',
      'status.paused': '暂停',
      stalePlan: '需求已更新，计划待同步',
      running: '正在运行',
      idle: '等待中',
      working: 'AI 正在执行',
      planning: '新任务规划中…',
      previousTask: '上一任务',
      currentTask: '当前任务',
      analyzing: '正在分析请求…',
      'status.skipped': '已跳过',
      markDone: '点此标记完成 / 取消',
      markSkip: '点此跳过 / 恢复',
      autoDone: '自动确认',
    }
    const en = {
      title: 'Progress tree',
      guideTitle: 'Progress tree',
      guideDescription: "See the AI's plan, current node and artifacts",
      empty: 'No progress plan yet',
      emptyHint: 'When the AI starts multi-step work, its task tree, current node and artifacts appear here.',
      allDone: 'All done',
      blocked: 'Blocked',
      notes: 'Notes',
      artifacts: 'Artifacts',
      lane: 'Lane',
      current: 'Now',
      progress: 'Progress',
      liveDone: 'Done',
      liveNow: 'Now',
      liveNext: 'Next',
      liveProblem: 'Problem',
      liveNarration: 'AI update',
      reopen: 'Open progress tree',
      copyPath: 'Click to copy path',
      'status.pending': 'Pending',
      'status.active': 'Active',
      'status.done': 'Done',
      'status.blocked': 'Blocked',
      'status.paused': 'Paused',
      'status.skipped': 'Skipped',
      markDone: 'Mark done / undo',
      markSkip: 'Skip / restore',
      autoDone: 'Auto-confirmed',
      planning: 'Planning the new task…',
      previousTask: 'Previous task',
      currentTask: 'Current task',
      analyzing: 'Analyzing the request…',
      stalePlan: 'Requirements changed — plan needs an update',
      running: 'Running',
      idle: 'Idle',
      working: 'AI is working',
    }

    const COLORS = {
      text: 'var(--dsw-alias-label-primary)',
      secondary: 'var(--dsw-alias-label-secondary)',
      tertiary: 'var(--dsw-alias-label-tertiary)',
      border: 'var(--dsw-alias-border-l1)',
      card: 'var(--dsw-alias-card-fill)',
      done: 'var(--dsw-alias-state-success-primary)',
      active: 'var(--dsw-alias-state-business-primary)',
      blocked: 'var(--dsw-alias-state-error-primary)',
      paused: 'var(--dsw-alias-state-warn-primary)',
      pending: 'var(--dsw-alias-label-tertiary)',
    }

    const GLYPH = { pending: '○', active: '●', done: '✓', blocked: '!', paused: '⏸', skipped: '⊘' }

    const TOOL_LABELS = {
      read: '读取文件',
      write: '写入文件',
      edit: '修改文件',
      exec_command: '运行命令',
      pwsh: '运行命令',
      grep: '搜索代码',
      glob: '查找文件',
      web_fetch: '抓取网页',
      web_search: '搜索网页',
      subagent: '启动子代理',
      subagent_fork: '启动子代理',
      subagent_claude_code: '启动子代理',
      todo_write: '更新待办',
      progress_plan: '更新计划',
      progress_update: '更新进度',
      progress_note: '记录进度',
      job_output: '等待后台任务',
      plugin_manager: '管理插件',
      cordis_inspect_query: '查询运行时',
      cordis_inspect_list: '查询运行时',
    }

    function toolLabel(name) {
      if (typeof name !== 'string' || name === '') return ''
      if (TOOL_LABELS[name] !== undefined) return TOOL_LABELS[name]
      if (name.startsWith('mcp__dbx__')) return '数据库操作'
      if (name.startsWith('job_')) return '后台任务'
      if (name.startsWith('cordis_')) return '查询运行时'
      return name
    }

    function shortText(text, max) {
      if (typeof text !== 'string') return ''
      const compact = text.replace(/\s+/g, ' ').trim()
      return compact.length > max ? compact.slice(0, max - 1) + '…' : compact
    }

    function elapsedText(from, now) {
      if (typeof from !== 'number' || !Number.isFinite(from)) return ''
      const seconds = Math.max(0, Math.round((now - from) / 1000))
      if (seconds < 60) return seconds + 's'
      const minutes = Math.floor(seconds / 60)
      return minutes + 'm ' + (seconds % 60) + 's'
    }

    const CSS = `
.dpt-root{display:flex;flex-direction:column;gap:12px;padding:12px;color:${COLORS.text};font-size:13px;line-height:1.45;min-height:100%;box-sizing:border-box}
.dpt-head{display:flex;flex-direction:column;gap:4px}
.dpt-title{font-size:15px;font-weight:600;word-break:break-word}
.dpt-summary{color:${COLORS.secondary};font-size:12px}
.dpt-bar{height:6px;border-radius:999px;background:${COLORS.card};overflow:hidden;margin-top:4px}
.dpt-bar-fill{height:100%;border-radius:999px;background:${COLORS.done};transition:width .25s ease}
.dpt-meta{display:flex;justify-content:space-between;gap:8px;color:${COLORS.tertiary};font-size:11px}
.dpt-now{color:${COLORS.active};font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dpt-alert{border:1px solid ${COLORS.blocked};border-radius:8px;padding:8px 10px;color:${COLORS.blocked};font-size:12px;display:flex;flex-direction:column;gap:2px;word-break:break-word}
.dpt-error{border:1px dashed ${COLORS.blocked};border-radius:8px;padding:8px 10px;color:${COLORS.blocked};font-size:12px;word-break:break-word}
.dpt-live{display:flex;flex-direction:column;gap:3px;border:1px solid ${COLORS.border};background:${COLORS.card};border-radius:8px;padding:7px 9px}
.dpt-live-row{display:flex;gap:6px;align-items:baseline;font-size:11px;line-height:16px;min-width:0}
.dpt-live-label{flex:none;font-weight:600}
.dpt-live-row[data-kind="done"] .dpt-live-label{color:${COLORS.done}}
.dpt-live-row[data-kind="active"] .dpt-live-label{color:${COLORS.active}}
.dpt-live-row[data-kind="next"] .dpt-live-label{color:${COLORS.tertiary}}
.dpt-live-row[data-kind="problem"] .dpt-live-label{color:${COLORS.blocked}}
.dpt-live-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.secondary}}
.dpt-live-row[data-kind="active"] .dpt-live-text{color:${COLORS.text}}
.dpt-live-narration{margin-top:4px;padding-top:5px;border-top:1px dashed ${COLORS.border}}
.dpt-live-narration .dpt-live-text{white-space:normal;color:${COLORS.text};font-size:11px;line-height:15px;max-height:45px;overflow:hidden}
.dpt-live-row[data-kind="running"] .dpt-live-label{color:${COLORS.active}}
.dpt-live-streaming{border-top-color:${COLORS.active}}
.dpt-stream{white-space:pre-wrap;word-break:break-word;max-height:52px;overflow:hidden;color:${COLORS.text};font-size:11px;line-height:15px}
.dpt-stream::after{content:"▍";color:${COLORS.active};animation:dptBlink 1s steps(2,start) infinite}
.dpt-stale{margin:0 0 6px;padding:5px 8px;border-radius:6px;border:1px dashed ${COLORS.paused};color:${COLORS.paused};font-size:11px;line-height:15px;background:transparent}
.dpt-newtask{margin:0 0 6px;padding:8px 10px;border-radius:8px;border:1px solid ${COLORS.paused};background:rgba(210,153,34,.08)}
.dpt-newtask-title{font-size:11px;line-height:16px;color:${COLORS.paused};letter-spacing:.02em}
.dpt-newtask-text{margin-top:3px;font-size:11px;line-height:15px;color:${COLORS.secondary};max-height:46px;overflow:hidden}
.dpt-activity{margin:0 0 8px;padding:8px 10px;border-radius:8px;border:1px solid ${COLORS.border};background:${COLORS.card}}
.dpt-activity-label{font-size:10px;line-height:14px;color:${COLORS.tertiary};text-transform:uppercase;letter-spacing:.06em}
.dpt-activity-request{margin-top:4px;font-size:11px;line-height:16px;color:${COLORS.secondary};max-height:44px;overflow:hidden}
.dpt-activity-now{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;line-height:18px;color:${COLORS.text}}
.dpt-spin{display:inline-block;color:${COLORS.active};animation:dptSpin 1.2s linear infinite}
@keyframes dptSpin{to{transform:rotate(360deg)}}
.dpt-tree-current{margin:2px 0 10px}
.dpt-tree-current .dpt-tree-root-dot{background:${COLORS.active};box-shadow:0 0 0 3px rgba(76,141,255,.18)}
.dpt-archived-label{margin:2px 0 6px;font-size:10px;line-height:14px;color:${COLORS.tertiary};text-transform:uppercase;letter-spacing:.06em}
.dpt-root-stale .dpt-head,.dpt-root-stale .dpt-tree-wrap,.dpt-root-stale .dpt-lanes,.dpt-root-stale .dpt-alert,.dpt-root-stale .dpt-error{opacity:.48}
.dpt-dock-stale .dpt-dock-title{color:${COLORS.paused}}
.dpt-dock-stale .dpt-dock-progress{opacity:.35}
.dpt-tree-wrap{display:flex;flex-direction:column;gap:0}
.dpt-tree-root{position:relative;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;padding:2px 0 2px}
.dpt-tree-root::after{content:'';position:absolute;left:3px;top:26px;bottom:-2px;border-left:2px solid ${COLORS.border}}
.dpt-tree-root-dot{width:8px;height:8px;border-radius:999px;background:${COLORS.active};box-shadow:0 0 0 4px color-mix(in srgb, ${COLORS.active} 16%, transparent);flex:none}
.dpt-tree-root-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.secondary}}
.dpt-tree{list-style:none;margin:0;padding:0 0 0 20px}
.dpt-tli{position:relative}
.dpt-tli::before{content:'';position:absolute;left:-20px;top:0;bottom:0;border-left:2px solid ${COLORS.border}}
.dpt-tli.dpt-tli-end::before{bottom:auto;height:18px}
.dpt-tli::after{content:'';position:absolute;left:-20px;top:18px;width:18px;border-top:2px solid ${COLORS.border}}
.dpt-tli > .dpt-tree{padding-left:20px}
.dpt-node{display:flex;gap:8px;padding:5px 8px;border-radius:8px;align-items:flex-start}
.dpt-node:hover{background:${COLORS.card}}
.dpt-icon{width:16px;text-align:center;font-size:12px;line-height:18px;flex:none;color:${COLORS.pending}}
.dpt-node[data-status="done"] .dpt-icon{color:${COLORS.done};animation:dptPop .18s ease-out}
.dpt-node[data-status="active"] .dpt-icon{color:${COLORS.active};animation:dptPulse 1.4s ease-in-out infinite}
.dpt-node[data-status="blocked"] .dpt-icon{color:${COLORS.blocked}}
.dpt-node[data-status="paused"] .dpt-icon{color:${COLORS.paused}}
.dpt-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dpt-row{display:flex;align-items:center;gap:8px;min-width:0}
.dpt-name{font-weight:500;word-break:break-word}
.dpt-node[data-status="done"] .dpt-name{color:${COLORS.secondary}}
.dpt-badge{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid ${COLORS.border};color:${COLORS.tertiary}}
.dpt-node[data-status="active"] .dpt-badge{color:${COLORS.active};border-color:${COLORS.active}}
.dpt-node[data-status="done"] .dpt-badge{color:${COLORS.done};border-color:${COLORS.done}}
.dpt-node[data-status="blocked"] .dpt-badge{color:${COLORS.blocked};border-color:${COLORS.blocked}}
.dpt-node[data-status="paused"] .dpt-badge{color:${COLORS.paused};border-color:${COLORS.paused}}
.dpt-node[data-status="skipped"] .dpt-badge{color:${COLORS.tertiary};border-style:dashed}
.dpt-node[data-status="skipped"] .dpt-name{text-decoration:line-through;color:${COLORS.tertiary}}
.dpt-node-skipped{opacity:.62}
.dpt-auto{font-style:italic}
.dpt-acts{display:flex;gap:2px;margin-left:auto;flex:none;opacity:0;transition:opacity .12s}
.dpt-node:hover .dpt-acts,.dpt-node:focus-within .dpt-acts{opacity:1}
.dpt-act{width:18px;height:18px;padding:0;border-radius:5px;border:1px solid ${COLORS.border};background:transparent;color:${COLORS.tertiary};font-size:11px;line-height:1;cursor:pointer}
.dpt-act:hover{color:${COLORS.text}}
.dpt-act[data-on="true"]{color:${COLORS.done};border-color:${COLORS.done}}
.dpt-note{color:${COLORS.secondary};font-size:12px;word-break:break-word;white-space:pre-wrap}
.dpt-mini{height:3px;border-radius:999px;background:${COLORS.card};overflow:hidden;margin-top:2px}
.dpt-mini-fill{height:100%;background:${COLORS.done}}
.dpt-artifacts{display:flex;flex-wrap:wrap;gap:4px}
.dpt-chip{font:inherit;font-size:10px;padding:1px 6px;border-radius:4px;background:${COLORS.card};border:1px solid ${COLORS.border};color:${COLORS.secondary};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.dpt-chip:hover{color:${COLORS.text};border-color:${COLORS.tertiary}}
.dpt-empty{display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding:8px 4px;color:${COLORS.secondary}}
.dpt-empty-title{font-weight:600;color:${COLORS.text}}
.dpt-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid ${COLORS.border};padding-top:10px}
.dpt-section-title{font-size:11px;font-weight:600;color:${COLORS.tertiary};text-transform:uppercase;letter-spacing:.04em}
.dpt-lanes{display:flex;flex-wrap:wrap;gap:4px}
.dpt-lane{font-size:10px;padding:1px 6px;border-radius:999px;border:1px dashed ${COLORS.border};color:${COLORS.tertiary}}
.dpt-notes{display:flex;flex-direction:column;gap:4px}
.dpt-note-line{display:flex;gap:6px;font-size:11px;color:${COLORS.secondary};word-break:break-word}
.dpt-note-time{color:${COLORS.tertiary};flex:none;font-variant-numeric:tabular-nums}
.dpt-note-line[data-severity="warn"]{color:${COLORS.paused}}
.dpt-note-line[data-severity="error"]{color:${COLORS.blocked}}
.dpt-dock{box-sizing:border-box;width:calc(50% - 2 * var(--dsh-composer-side-clearance, 8px) - 4 * var(--dsh-composer-dock-inset, 0px));margin:0 auto;color:var(--dsw-alias-label-primary, ${COLORS.text});font-size:10px;line-height:14px;padding:0}
.dpt-dock-bar{display:flex;align-items:center;gap:6px;max-width:calc((var(--dsh-composer-card-max-width, 768px) - 4 * var(--dsh-composer-dock-inset, 0px)) / 2);height:18px;margin:0 auto;padding:2px 3px 2px 8px;position:relative;border-radius:var(--dsw-radius-md, 10px);border:0;background:var(--dsw-specific-menu, ${COLORS.card});box-shadow:var(--dsw-elevation-panel, none);backdrop-filter:var(--dsw-menu-backdrop-filter, none);cursor:pointer;user-select:none}
.dpt-dock-bar:hover{background:var(--dsw-alias-interactive-bg-hover, ${COLORS.card})}
.dpt-dock-bar:focus-visible{outline:2px solid var(--dsw-alias-link, ${COLORS.active});outline-offset:2px}
.dpt-dock-title{flex:0 1 auto;min-width:0;max-width:min(40%,14ch);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--dsw-alias-label-primary, ${COLORS.text})}
.dpt-dock-progress{flex:1;min-width:16px;height:4px;border-radius:999px;background:var(--dsw-alias-border-l1, ${COLORS.border});display:flex;overflow:hidden}
.dpt-dock-seg{height:100%}
.dpt-dock-seg[data-part="done"]{background:${COLORS.done}}
.dpt-dock-seg[data-part="active"]{background:${COLORS.active};animation:dptPulse 1.4s ease-in-out infinite}
.dpt-dock-seg[data-part="blocked"]{background:${COLORS.blocked}}
.dpt-dock-seg[data-part="paused"]{background:${COLORS.paused}}
.dpt-dock-seg[data-part="pending"]{background:transparent}
.dpt-dock-percent{flex:none;font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary, ${COLORS.secondary})}
.dpt-dock-action{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary, ${COLORS.secondary});font-size:10px;line-height:1;cursor:pointer}
.dpt-dock-action:hover{background:var(--dsw-alias-interactive-bg-hover, ${COLORS.card});color:var(--dsw-alias-label-primary, ${COLORS.text})}
.dpt-dock-live{flex:none;width:6px;height:6px;border-radius:999px;background:${COLORS.tertiary};opacity:.45}
.dpt-dock-live[data-live="on"]{background:${COLORS.active};opacity:1;animation:dptPulse 1.2s ease-in-out infinite}
@keyframes dptPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dptBlink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes dptPop{0%{transform:scale(.6)}100%{transform:scale(1)}}
`

    function buildTree(nodes) {
      const byId = new Map()
      for (const node of nodes) byId.set(node.id, { ...node, children: [] })
      const roots = []
      for (const node of byId.values()) {
        const parent = node.parentId === null || node.parentId === undefined ? undefined : byId.get(node.parentId)
        if (parent === undefined) roots.push(node)
        else parent.children.push(node)
      }
      return roots
    }

    function subtreeStats(node) {
      let total = 1
      let done = 1
      if (node.status !== 'done') done = 0
      for (const child of node.children) {
        const stats = subtreeStats(child)
        total += stats.total
        done += stats.done
      }
      return { total, done }
    }

    function statusLabel(node, t) {
      return t('status.' + node.status)
    }

    function artifactAddress(sessionId, path) {
      const normalized = String(path).replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
      const encode = segment => encodeURIComponent(segment).replace(/%3A/gi, ':')
      const encoded = normalized.split('/').map(encode).join('/')
      if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
        return 'dsh-resource://file/absolute/' + encoded
      }
      if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
      return 'dsh-resource://file/session/' + encode(sessionId) + '/' + encoded
    }

    function withCopyFallback(path) {
      try {
        void navigator.clipboard?.writeText(path)
      } catch {
        // clipboard is best effort only
      }
    }

    // User overrides live in localStorage only: the host projection stays the
    // source of truth, and a refresh keeps whatever the user checked or skipped.
    const MANUAL_PREFIX = 'dsh.progress-tree.manual.'
    const manualStore = new Map()
    const manualListeners = new Set()

    function readManual(sessionId) {
      try {
        const raw = window.localStorage.getItem(MANUAL_PREFIX + sessionId)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch {
        return {}
      }
    }

    function snapshotManual(sessionId) {
      if (!manualStore.has(sessionId)) manualStore.set(sessionId, readManual(sessionId))
      return manualStore.get(sessionId)
    }

    function subscribeManual(listener) {
      manualListeners.add(listener)
      return () => {
        manualListeners.delete(listener)
      }
    }

    function writeManual(sessionId, manual) {
      manualStore.set(sessionId, manual)
      try {
        window.localStorage.setItem(MANUAL_PREFIX + sessionId, JSON.stringify(manual))
      } catch {
        // storage may be unavailable; overrides just do not persist
      }
      for (const listener of manualListeners) listener()
    }

    const MANUAL_STATUSES = new Set(['pending', 'done', 'skipped'])

    function applyManual(view, manual) {
      if (view === undefined || view === null || view.plan === undefined || view.plan === null) return view
      const nodes = (Array.isArray(view.plan.nodes) ? view.plan.nodes : []).map(node => {
        const override = manual[node.id]
        if (!MANUAL_STATUSES.has(override)) return node
        return { ...node, status: override, manual: true, autoDone: false }
      })
      const counts = { total: nodes.length, done: 0, active: 0, pending: 0, blocked: 0, paused: 0, skipped: 0 }
      for (const node of nodes) {
        if (counts[node.status] !== undefined) counts[node.status] += 1
      }
      const active = nodes.find(node => node.status === 'active')
      return {
        ...view,
        plan: { ...view.plan, nodes },
        nodes,
        counts,
        currentNodeId: active !== undefined ? active.id : null,
      }
    }

    function effectiveStatus(node, manual) {
      const override = manual[node.id]
      return MANUAL_STATUSES.has(override) ? override : node.status
    }

    function ArtifactChip({ sessionId, artifact, openTab, t }) {
      const path = typeof artifact === 'string' ? artifact : artifact.path
      const label = typeof artifact === 'string' ? path : artifact.label || artifact.path
      const onClick = event => {
        event.stopPropagation()
        if (/^(?:https?|mailto):/i.test(path)) {
          try {
            window.open(path, '_blank', 'noopener')
          } catch {
            withCopyFallback(path)
          }
          return
        }
        const address = artifactAddress(sessionId, path)
        try {
          if (address !== undefined && openTab !== undefined) {
            openTab.tab.actions.openResource(address)
            return
          }
        } catch {
          // fall through to copying the path
        }
        withCopyFallback(path)
      }
      return h('button', { type: 'button', className: 'dpt-chip', title: path || t('copyPath'), onClick }, label)
    }

    function TreeItem({ node, isLast, sessionId, openTab, t, onDone, onSkip }) {
      const artifacts = Array.isArray(node.artifacts) ? node.artifacts : []
      const stats = subtreeStats(node)
      const hasChildren = node.children.length > 0
      const className = 'dpt-tli' + (isLast && !hasChildren ? ' dpt-tli-end' : '')
      const skipped = node.status === 'skipped'
      return h(
        'li',
        { className, 'data-status': node.status },
        h(
          'div',
          { className: 'dpt-node' + (skipped ? ' dpt-node-skipped' : ''), 'data-status': node.status },
          h('span', { className: 'dpt-icon' }, GLYPH[node.status] ?? '○'),
          h(
            'div',
            { className: 'dpt-body' },
            h(
              'div',
              { className: 'dpt-row' },
              h('span', { className: 'dpt-name' }, node.title || node.id),
              node.lane ? h('span', { className: 'dpt-badge' }, t('lane') + ': ' + node.lane) : null,
              h('span', { className: 'dpt-badge' }, statusLabel(node, t)),
              node.autoDone === true ? h('span', { className: 'dpt-badge dpt-auto' }, t('autoDone')) : null,
              hasChildren ? h('span', { className: 'dpt-badge' }, stats.done + '/' + stats.total) : null,
              typeof onDone === 'function'
                ? h(
                    'span',
                    { className: 'dpt-acts' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpt-act',
                        'data-on': node.status === 'done',
                        title: t('markDone'),
                        onClick: event => {
                          event.stopPropagation()
                          onDone(node.id)
                        },
                      },
                      '✓',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpt-act',
                        'data-on': node.status === 'skipped',
                        title: t('markSkip'),
                        onClick: event => {
                          event.stopPropagation()
                          onSkip(node.id)
                        },
                      },
                      '⊘',
                    ),
                  )
                : null,
            ),
            node.note ? h('div', { className: 'dpt-note' }, node.note) : null,
            hasChildren
              ? h(
                  'div',
                  { className: 'dpt-mini' },
                  h('div', { className: 'dpt-mini-fill', style: { width: Math.round((stats.done / stats.total) * 100) + '%' } }),
                )
              : null,
            artifacts.length > 0
              ? h(
                  'div',
                  { className: 'dpt-artifacts' },
                  artifacts.map((artifact, index) =>
                    h(ArtifactChip, { key: index, sessionId, artifact, openTab, t }),
                  ),
                )
              : null,
          ),
        ),
        hasChildren
          ? h(
              'ul',
              { className: 'dpt-tree' },
              node.children.map((child, index) =>
                h(TreeItem, { key: child.id, node: child, isLast: index === node.children.length - 1, sessionId, openTab, t, onDone, onSkip }),
              ),
            )
          : null,
      )
    }

    function formatTime(at) {
      if (typeof at !== 'number' || !Number.isFinite(at)) return ''
      try {
        return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    function ProgressPane({ sessionId, useProjection, useTabInfo, t }) {
      const projected = useProjection('progressTree')
      const [manual, setManual] = React.useState(() => snapshotManual(sessionId))
      React.useEffect(() => {
        setManual(snapshotManual(sessionId))
      }, [sessionId])
      const view = applyManual(projected, manual)
      const tabInfo = useTabInfo !== undefined ? useTabInfo() : undefined
      const openTab = tabInfo !== undefined ? { tab: tabInfo.tab } : undefined
      const binding = bindingOf(sessionId, clientSessions)
      const live = useLiveFeed(binding)
      const [now, setNow] = React.useState(() => Date.now())
      React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
      }, [])
      const plan = view === undefined || view === null ? undefined : view.plan

      const toggleDone = nodeId => {
        setManual(previous => {
          const next = { ...previous }
          const hostNode = Array.isArray(projected?.plan?.nodes)
            ? projected.plan.nodes.find(node => node.id === nodeId)
            : undefined
          const current = effectiveStatus(hostNode ?? { id: nodeId, status: 'pending' }, previous)
          if (current === 'done') {
            if (next[nodeId] === 'done') delete next[nodeId]
            else next[nodeId] = 'pending'
          } else {
            next[nodeId] = 'done'
          }
          writeManual(sessionId, next)
          return next
        })
      }

      const toggleSkip = nodeId => {
        setManual(previous => {
          const next = { ...previous }
          if (next[nodeId] === 'skipped') delete next[nodeId]
          else next[nodeId] = 'skipped'
          writeManual(sessionId, next)
          return next
        })
      }

      if (plan === undefined || plan === null) {
        return h(
          'div',
          { className: 'dpt-root' },
          h(
            'div',
            { className: 'dpt-empty' },
            h('div', { className: 'dpt-empty-title' }, t('empty')),
            h('div', null, t('emptyHint')),
          ),
        )
      }

      const nodes = Array.isArray(plan.nodes) ? plan.nodes : []
      const counts = view.counts ?? { total: nodes.length, done: 0, active: 0, pending: 0, blocked: 0, paused: 0, skipped: 0 }
      const rawTotal = counts.total || nodes.length
      const total = Math.max(1, rawTotal - (counts.skipped || 0))
      const done = counts.done || 0
      const percent = Math.round((done / total) * 100)
      const activeNode = nodes.find(node => node.status === 'active')
      const blockedNodes = nodes.filter(node => node.status === 'blocked')
      const roots = buildTree(nodes)
      const notes = Array.isArray(view.notes) ? view.notes.slice(-8).reverse() : []
      const allDone = total > 0 && done >= total
      const lastDone = [...nodes].reverse().find(node => node.status === 'done')
      const nextPending = nodes.find(node => node.status === 'pending')
      const latestLive = Array.isArray(view.live) && view.live.length > 0 ? view.live[view.live.length - 1] : undefined
      const problemNode = blockedNodes[0]
      const problemText =
        view.lastError !== null && view.lastError !== undefined
          ? view.lastError.text
          : problemNode !== undefined
            ? problemNode.note || problemNode.title
            : undefined
      const stale =
        view.stale === true ||
        (typeof plan.updatedAt === 'number' && typeof view.lastUserAt === 'number' && view.lastUserAt > plan.updatedAt)
      const streaming = typeof live.streamText === 'string' ? live.streamText.trim() : ''
      const runningTool = live.running === null || live.running === undefined ? null : live.running.name
      const activity = view.activity ?? null
      const activityNow =
        activity === null
          ? ''
          : activity.tool !== null && activity.tool !== undefined
            ? toolLabel(activity.tool.name) + (activity.tool.detail ? ' · ' + activity.tool.detail : '')
            : activity.narration
              ? shortText(activity.narration, 140)
              : ''
      const activitySince = activity === null ? undefined : (activity.tool?.at ?? activity.startedAt)
      const activityElapsed = elapsedText(activitySince, now)
      const activityText = activity !== null && activity.text ? activity.text : (view.lastUserText ?? '')

      return h(
        'div',
        { className: 'dpt-root' + (stale ? ' dpt-root-stale' : '') },
        stale
          ? h(
              'div',
              { className: 'dpt-activity' },
              h('div', { className: 'dpt-activity-label' }, t('currentTask')),
              activityText ? h('div', { className: 'dpt-activity-request' }, shortText(activityText, 160)) : null,
              h(
                'div',
                { className: 'dpt-activity-now' },
                h('span', { className: 'dpt-spin' }, '◌'),
                h('span', null, (activityNow || t('analyzing')) + (activityElapsed ? ' · ' + activityElapsed : '')),
              ),
            )
          : null,
        stale
          ? h(
              'div',
              { className: 'dpt-tree-wrap dpt-tree-current' },
              h(
                'div',
                { className: 'dpt-tree-root' },
                h('span', { className: 'dpt-tree-root-dot' }),
                h('span', { className: 'dpt-tree-root-text' }, t('currentTask')),
              ),
              h(
                'ul',
                { className: 'dpt-tree' },
                h(TreeItem, {
                  node: {
                    id: '__activity',
                    title: activityNow || t('analyzing'),
                    status: 'active',
                    note: activityText ? shortText(activityText, 120) : null,
                    artifacts: [],
                    children: [],
                    lane: null,
                  },
                  isLast: true,
                  sessionId,
                  openTab,
                  t,
                }),
              ),
            )
          : null,
        stale
          ? h('div', { className: 'dpt-archived-label' }, t('previousTask') + ' · ' + plan.title)
          : null,
        h(
          'div',
          { className: 'dpt-head' },
          h('div', { className: 'dpt-title' }, plan.title),
          plan.summary ? h('div', { className: 'dpt-summary' }, plan.summary) : null,
          h('div', { className: 'dpt-bar' }, h('div', { className: 'dpt-bar-fill', style: { width: percent + '%' } })),
          h(
            'div',
            { className: 'dpt-meta' },
            h('span', null, t('progress') + ' ' + done + '/' + total),
            allDone
              ? h('span', { className: 'dpt-now', style: { color: COLORS.done } }, t('allDone'))
              : activeNode
                ? h('span', { className: 'dpt-now' }, t('current') + ': ' + (activeNode.title || activeNode.id))
                : null,
          ),
        ),
        stale
          ? null
          : h(
          'div',
          { className: 'dpt-live' },
          lastDone !== undefined
            ? h(
                'div',
                { className: 'dpt-live-row', 'data-kind': 'done' },
                h('span', { className: 'dpt-live-label' }, '✓ ' + t('liveDone')),
                h('span', { className: 'dpt-live-text' }, lastDone.title || lastDone.id),
              )
            : null,
          activeNode !== undefined
            ? h(
                'div',
                { className: 'dpt-live-row', 'data-kind': 'active' },
                h('span', { className: 'dpt-live-label' }, '● ' + t('liveNow')),
                h('span', { className: 'dpt-live-text' }, activeNode.title + (activeNode.note ? ' — ' + activeNode.note : '')),
              )
            : null,
          runningTool !== null
            ? h(
                'div',
                { className: 'dpt-live-row', 'data-kind': 'running' },
                h('span', { className: 'dpt-live-label' }, '⚙ ' + t('running')),
                h('span', { className: 'dpt-live-text' }, runningTool),
              )
            : null,
          nextPending !== undefined
            ? h(
                'div',
                { className: 'dpt-live-row', 'data-kind': 'next' },
                h('span', { className: 'dpt-live-label' }, '→ ' + t('liveNext')),
                h('span', { className: 'dpt-live-text' }, nextPending.title || nextPending.id),
              )
            : null,
          problemText !== undefined
            ? h(
                'div',
                { className: 'dpt-live-row', 'data-kind': 'problem' },
                h('span', { className: 'dpt-live-label' }, '! ' + t('liveProblem')),
                h('span', { className: 'dpt-live-text' }, problemText),
              )
            : null,
          streaming !== ''
            ? h(
                'div',
                { className: 'dpt-live-narration dpt-live-streaming' },
                h('span', { className: 'dpt-live-label' }, '▍ ' + t('liveNarration')),
                h('div', { className: 'dpt-live-text dpt-stream' }, streaming),
              )
            : latestLive !== undefined
              ? h(
                  'div',
                  { className: 'dpt-live-narration' },
                  h('span', { className: 'dpt-live-label' }, t('liveNarration')),
                  h('div', { className: 'dpt-live-text' }, latestLive.text),
                )
              : null,
        ),
        blockedNodes.length > 0
          ? h(
              'div',
              { className: 'dpt-alert' },
              h('strong', null, t('blocked')),
              h('span', null, blockedNodes[0].title + (blockedNodes[0].note ? ' — ' + blockedNodes[0].note : '')),
            )
          : null,
        view.lastError !== null && view.lastError !== undefined
          ? h('div', { className: 'dpt-error' }, view.lastError.text)
          : null,
        plan.lanes !== undefined && plan.lanes.length > 0
          ? h(
              'div',
              { className: 'dpt-lanes' },
              plan.lanes.map(lane => h('span', { key: lane.id, className: 'dpt-lane' }, lane.title + (lane.parallel ? ' ∥' : ''))),
            )
          : null,
        h(
          'div',
          { className: 'dpt-tree-wrap' },
          h(
            'div',
            { className: 'dpt-tree-root' },
            h('span', { className: 'dpt-tree-root-dot' }),
            h('span', { className: 'dpt-tree-root-text' }, plan.title),
          ),
          h(
            'ul',
            { className: 'dpt-tree' },
            roots.map((node, index) =>
              h(TreeItem, { key: node.id, node, isLast: index === roots.length - 1, sessionId, openTab, t, onDone: toggleDone, onSkip: toggleSkip }),
            ),
          ),
        ),
        notes.length > 0
          ? h(
              'div',
              { className: 'dpt-section' },
              h('div', { className: 'dpt-section-title' }, t('notes')),
              h(
                'div',
                { className: 'dpt-notes' },
                notes.map((note, index) =>
                  h(
                    'div',
                    { key: index, className: 'dpt-note-line', 'data-severity': note.severity ?? 'info' },
                    h('span', { className: 'dpt-note-time' }, formatTime(note.at)),
                    h('span', null, note.text),
                  ),
                ),
              ),
            )
          : null,
      )
    }

    const NO_LIVE = Object.freeze({
      streamText: '',
      running: null,
      lastUserAt: 0,
      lastAssistantAt: 0,
      lastAssistantText: '',
    })

    function chunkText(chunk) {
      return chunk !== null && typeof chunk === 'object' && chunk.type === 'text-delta' && typeof chunk.text === 'string'
        ? chunk.text
        : ''
    }

    function liveMessageText(event) {
      const data = event !== null && typeof event === 'object' && event.data !== null && typeof event.data === 'object' ? event.data : undefined
      const message = data !== undefined && data.message !== null && typeof data.message === 'object' ? data.message : data
      const content = message !== undefined ? (message.content ?? message.parts ?? data?.content) : undefined
      const pieces = []
      if (typeof content === 'string') pieces.push(content)
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part !== null && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string') pieces.push(part.text)
        }
      }
      const text = pieces.join(' ').replace(/\s+/g, ' ').trim()
      return text === '' ? '' : text.slice(0, 280)
    }

    function foldLiveEntry(acc, entry) {
      if (entry === null || typeof entry !== 'object') return acc
      if (entry.type === 'transient') {
        const event = entry.event
        if (event === null || typeof event !== 'object' || event.type !== 'assistant/live-chunk') return acc
        const delta = chunkText(event.data?.chunk)
        if (delta === '') return acc
        return { ...acc, streamText: (acc.streamText + delta).slice(-600) }
      }
      const event = entry.event
      if (event === null || typeof event !== 'object') return acc
      const data = event.data !== null && typeof event.data === 'object' ? event.data : {}
      if (event.type === 'user/message') {
        return { ...acc, streamText: '', running: null, lastUserAt: event.time, lastAssistantText: '' }
      }
      if (event.type === 'assistant/message') {
        return {
          ...acc,
          streamText: '',
          lastAssistantAt: event.time,
          lastAssistantText: liveMessageText(event) || acc.lastAssistantText,
        }
      }
      if (event.type === 'tool/call') {
        return {
          ...acc,
          running: { callId: data.callId ?? null, name: typeof data.name === 'string' ? data.name : null, at: event.time },
        }
      }
      if (event.type === 'tool/result') {
        const callId = data.message?.toolCallId ?? data.message?.source?.callId
        if (acc.running !== null && (callId === undefined || acc.running.callId === callId)) return { ...acc, running: null }
        return acc
      }
      if (event.type === 'turn/end') return { ...acc, running: null, streamText: '' }
      return acc
    }

    function liveFromWindow(window) {
      const entries = Array.isArray(window?.entries) ? window.entries : []
      let acc = NO_LIVE
      for (const entry of entries) acc = foldLiveEntry(acc, entry)
      return acc
    }

    function bindingOf(sessionId, sessions) {
      try {
        if (sessions === undefined || sessionId === undefined) return undefined
        return sessions.binding(sessionId)
      } catch {
        return undefined
      }
    }

    function createLiveStore(source) {
      const read = () => {
        try {
          return liveFromWindow(typeof source.getSnapshot === 'function' ? source.getSnapshot() : undefined)
        } catch {
          return NO_LIVE
        }
      }
      let acc = read()
      const listeners = new Set()
      let unsubscribe = null
      const ensure = () => {
        if (unsubscribe !== null) return
        unsubscribe =
          typeof source.subscribe === 'function'
            ? source.subscribe(() => {
                acc = read()
                for (const listener of listeners) listener()
              })
            : () => {}
      }
      return {
        get: () => acc,
        subscribe: listener => {
          ensure()
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        dispose: () => {
          if (typeof unsubscribe === 'function') unsubscribe()
          unsubscribe = null
        },
      }
    }

    function useLiveFeed(binding) {
      const source = binding === undefined ? undefined : binding.eventSource
      const store = React.useMemo(() => (source === undefined ? null : createLiveStore(source)), [source])
      React.useEffect(() => () => store?.dispose(), [store])
      const subscribe = React.useCallback(
        listener => (store === null ? NOOP_SUBSCRIBE() : store.subscribe(listener)),
        [store],
      )
      const getSnapshot = React.useCallback(() => (store === null ? NO_LIVE : store.get()), [store])
      return React.useSyncExternalStore(subscribe, getSnapshot)
    }

    function autoOpenKey(sessionId) {
      return 'dsh.progress-tree.auto.' + sessionId
    }

    function maybeAutoOpen(sessionId, view, openTab) {
      if (!view || !view.plan || typeof sessionId !== 'string' || typeof openTab !== 'function') return
      try {
        const key = autoOpenKey(sessionId)
        if (window.localStorage.getItem(key) === 'closed') return
        const stamp = String(view.plan.createdAt)
        if (window.localStorage.getItem(key) === stamp) return
        openTab()
        window.localStorage.setItem(key, stamp)
      } catch {
        // storage may be unavailable; skipping auto-open is safe
      }
    }

    function ProgressDock({ sessionId, face, openTab, useProjection, t }) {
      const subscribe = React.useCallback(
        listener => (face === undefined ? NOOP_SUBSCRIBE() : face.subscribe(listener)),
        [face],
      )
      const getSnapshot = React.useCallback(() => (face === undefined ? null : face.getSnapshot()), [face])
      const faceView = React.useSyncExternalStore(subscribe, getSnapshot)
      const projected = typeof useProjection === 'function' ? useProjection('progressTree') : undefined
      const manual = React.useSyncExternalStore(subscribeManual, () => snapshotManual(sessionId))
      const view = applyManual(faceView ?? projected, manual)
      const binding = bindingOf(sessionId, clientSessions)
      const live = useLiveFeed(binding)
      const open = typeof openTab === 'function' ? openTab : openProgressTab
      React.useEffect(() => {
        maybeAutoOpen(sessionId, view, openTab)
      }, [sessionId, view?.plan?.createdAt])

      if (view === null || view === undefined || view.plan === null || view.plan === undefined) return null
      const plan = view.plan
      const stale =
        view.stale === true ||
        (typeof plan.updatedAt === 'number' && typeof view.lastUserAt === 'number' && view.lastUserAt > plan.updatedAt)
      const activity = view.activity ?? null
      const dockNow =
        activity === null
          ? t('analyzing')
          : activity.tool !== null && activity.tool !== undefined
            ? toolLabel(activity.tool.name) + (activity.tool.detail ? ' · ' + activity.tool.detail : '')
            : shortText(activity.narration ?? '', 42) || t('analyzing')
      const counts = view.counts ?? { total: 0, done: 0, active: 0, blocked: 0, paused: 0, pending: 0, skipped: 0 }
      const total = Math.max(1, (counts.total || 0) - (counts.skipped || 0))
      const percent = Math.round(((counts.done || 0) / total) * 100)
      const status =
        stale
          ? 'stale'
          : (counts.blocked || 0) > 0
            ? 'blocked'
            : (counts.active || 0) > 0
              ? 'active'
              : percent === 100
                ? 'done'
                : 'pending'
      const segments = ['done', 'active', 'blocked', 'paused']
        .filter(part => (counts[part] || 0) > 0)
        .map(part => [part, counts[part]])
      const toggle = () => {
        open()
      }
      return h(
        'section',
        { className: 'dpt-dock' + (stale ? ' dpt-dock-stale' : ''), 'data-status': status },
        h(
          'div',
          {
            className: 'dpt-dock-bar',
            role: 'button',
            tabIndex: 0,
            title: t('reopen') + ' · ' + (stale ? dockNow : plan.title),
            onClick: toggle,
            onKeyDown: event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              toggle()
            },
          },
          h('span', {
            className: 'dpt-dock-live',
            'data-live': live.running !== null || live.streamText !== '' ? 'on' : 'off',
            title: live.running !== null ? t('running') + (live.running.name ? ': ' + live.running.name : '') : t('idle'),
          }),
          h('span', { className: 'dpt-dock-title' }, stale ? dockNow : plan.title),
          h(
            'div',
            { className: 'dpt-dock-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
            segments.map(([part, count]) =>
              h('span', {
                key: part,
                className: 'dpt-dock-seg',
                'data-part': part,
                style: { width: ((count / total) * 100).toFixed(1) + '%' },
              }),
            ),
          ),
          h('span', { className: 'dpt-dock-percent' }, percent + '%'),
          h(
            'button',
            {
              type: 'button',
              className: 'dpt-dock-action',
              title: t('reopen'),
              'aria-label': t('reopen'),
              onClick: event => {
                event.stopPropagation()
                toggle()
              },
            },
            '↗',
          ),
        ),
      )
    }

    function ensureStyle() {
      const existing = document.querySelector('style[data-plugin="' + ID + '"]')
      if (existing !== null) return existing
      const style = document.createElement('style')
      style.dataset.plugin = ID
      style.textContent = CSS
      document.head.appendChild(style)
      return style
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        clientSessions = ctx.sessions
        openProgressTab = () => ctx.sidebarRight.openTab(KIND)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-progress-tree: locale')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          const style = ensureStyle()
          return () => style.remove()
        }, 'dsh-progress-tree: styles')

        ctx.effect(
          () =>
            ctx.sidebarRightTabs.register({
              id: ID,
              kind: KIND,
              priority: 'extension',
              keepMounted: true,
              title: () => t('title'),
              guide: [
                {
                  title: () => t('guideTitle'),
                  description: () => t('guideDescription'),
                },
              ],
            }),
          'dsh-progress-tree: sidebar type',
        )

        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID, locale: NS }, ProgressPane),
        )

        // A compact dock above the composer, modeled on the official Timeline
        // TaskDock: plan title + segmented progress + percent + reopen button.
        const progressFace = sessionId => {
          const binding = bindingOf(sessionId, ctx.sessions)
          const openTab = () => ctx.sidebarRight.openTab(KIND)
          if (binding === undefined) return { sessionId, face: undefined, openTab }
          try {
            return { sessionId, face: binding.session.projections.faceOf('progressTree'), openTab }
          } catch {
            return { sessionId, face: undefined, openTab }
          }
        }
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            { name: 'conversation.input.dock', id: 'progress-tree', order: 3, locale: NS, inject: progressFace },
            ProgressDock,
          ),
        )
      },
    }
  },
})

