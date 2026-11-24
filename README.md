# Progress Tree（进度树）

DeepSeek Harness 右侧栏任务树插件：把 AI 的多步任务折叠成可扫读的树，实时显示当前节点、状态、阻塞原因与产物。

![status](https://img.shields.io/badge/dsh-0.2.2--rc.5-blue)

## 功能

- 右侧栏「进度树」页签：标题、摘要、进度条、当前节点，以及带主干/分支连接线的任务树（可嵌套子节点）、泳道、过程记录。
- 输入框上方紧凑进度条（参照官方实验版 Timeline 的 TaskDock）：计划标题 + 分段进度 + 百分比 + 打开按钮；宽度 50%、高 18px、字号 10px（官方 `.timeline-dock` 的 `--dsh-composer-side-clearance` / `--dsh-composer-card-max-width` 约束减半），新计划首次出现时自动开页签。
- 过程标注：页签顶部固定展示「已完成 / 现在 / 接下来 / 问题」四行；宿主 projection 自动捕获助手每轮叙述的最后一句作为「AI 近况」（无需模型额外调用），模型也可用 `progress_note` 补充 warn/error 级别备注。
- 实时动向：客户端订阅会话 `eventSource`，运行中直接显示流式叙述（带光标）和正在运行的 tool 名；dock 上有直播脉冲点。投影的 `lastUserAt` 与 `stale` 会在需求变化但计划未更新时给出「需求已更新，计划待同步」提示。
- 计划随需求更新：模型可用 `progress_plan` 重建整棵树，或用 `progress_update {"id":"...","remove":true}` 删除过期节点（连同子节点）。
- 状态色：待开始灰、进行中蓝（脉冲）、已完成绿、阻塞红、暂停黄；阻塞节点附带原因。
- 节点产物 chip：点击用右侧栏文件预览打开；URL 产物用浏览器打开；失败时复制路径。
- 子 agent 自动进树：`subagent` 工具调用生成 `agent-<callId>` 节点，完成变绿、失败变红。

## 安装

```powershell
# 在 DSH 会话里执行（host 工具）
plugin_manager install_bundle D:\Dsh-dailywork\plugins\dsh-progress-tree
```

安装后刷新 Web GUI。替换已安装的包需要先 `remove_bundle` 再 `install_bundle`。

> 2026-11-24 验证：host 三个工具、投影 checkpoint（v4）、`sidebar.right.pane.tab` 与 `conversation.input.dock` 两处客户端注册均已生效；自动打开键 `dsh.progress-tree.auto.<sessionId>` 已写入。

## 工具

| 工具 | 作用 |
| --- | --- |
| `progress_plan` | 建立/替换任务树：`title`、`summary`、`mode`、`lanes`、`tasks` |
| `progress_update` | 更新节点：状态、备注、严重度、产物、标题、父节点、泳道；`remove:true` 删除该节点及子节点；新 id + title 追加节点 |
| `progress_note` | 追加一条过程记录（`text`、`nodeId`、`severity`） |

安装后系统提示会注入一段使用指引，模型会在多步任务里自动维护这棵树。

## 数据模型

- 会话级 projection `progressTree`（`stateVersion: 4`），从标准 `tool/call` / `tool/result`、`user/message`、`assistant/message` 折叠。
- 不新增 session event type，不调用 `appendPluginRecord`，不写额外文件；会话日志仍是唯一真相。
- 限制：节点 ≤ 200、泳道 ≤ 20、每节点产物 ≤ 8、过程记录保留最近 50 条。
- 客户端只读 host `wire.view`：`{version, revision, mode, plan, nodes, counts, currentNodeId, lastError, notes, live, lastUserAt, lastUserText, stale, updatedAt}`。

## 开发

```powershell
node --check D:\Dsh-dailywork\plugins\dsh-progress-tree\index.js
node --check D:\Dsh-dailywork\plugins\dsh-progress-tree\client.js
```

- host `index.js` 用普通 ToolDefinition（手写 JSON Schema），不 import `@deepseek-ai/dsh-tools`，因为外部 bundle 的裸导入从自身目录解析。
- client `client.js` 的 `__ModuleLoader__.load({ id })` 必须等于包名；React 从模块表 `require('react')`。
- 修改 projection 语义时 bump `stateVersion`，旧 checkpoint 才会失效并重放。
- 客户端改动需要刷新页面（或 `pnpm run dev:web` 的 HMR 接收器）后才生效。

## 目录

```
dsh-progress-tree/
  index.js          host：projection + 3 个工具 + 系统提示
  client.js         client：右侧栏页签 + input dock 进度条 + locale + 样式
  cordis.patch.yml  bundle 插入点
  locale/           en.json / zh.json 元数据
  docs/DETAIL.md    插件详情页
  icon.svg          插件图标
```
