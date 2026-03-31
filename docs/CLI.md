# Nous CLI

这份文档描述当前 Nous 的 CLI / REPL 控制面。

当前实现的核心原则是：

- 任务面：自然语言任务、线程回复、普通对话
- 控制面：状态、attach、debug、permissions、network、命令发现
- CLI 帮助、REPL `/commands`、自然语言控制映射，应该共享同一份操作目录

当前操作目录草案位于：

- [packages/infra/src/cli/catalog.ts](/Users/joey/Projects/Nous/packages/infra/src/cli/catalog.ts)

## 默认交互

```bash
nous
```

- 当 daemon 正在运行时：进入 REPL
- 当 daemon 未运行时：显示帮助

```bash
nous "<你的任务>"
```

- 当 daemon 正在运行时：把任务提交给 daemon，并返回 thread/message 信息
- 当 daemon 未运行时：走前台单次执行路径

## 命令发现

```bash
nous help
nous help network
nous commands thread
```

- `help` / `commands` 是同义入口
- 支持按主题搜索控制操作

在 REPL 里：

```text
/commands
/commands network
/help
```

- `/help` 是 `/commands` 的别名
- `/commands [query]` 会按当前上下文展示可用操作

## 顶层 CLI 命令

### Core

```bash
nous status
```

- 查看当前 intent / task / daemon 活动概览

### Daemon

```bash
nous daemon start
nous daemon stop
nous daemon status
```

- 启动、停止、检查 daemon 传输状态

### Threads

```bash
nous attach <threadId>
nous attach <threadId> --once
```

- attach 到持久化线程
- 默认进入 REPL attach 模式
- `--once` 只打印一次当前线程快照

### Inspect

```bash
nous debug daemon
nous debug thread <threadId>
nous events [N]
nous memory [search]
nous agents
```

- `debug daemon`：看 daemon 级别状态
- `debug thread`：看 thread / intent / decision / process surface
- `events`：看近期事件
- `memory`：浏览或搜索记忆
- `agents`：当前是前台模式能力，daemon 路径还没接上

### Permissions

```bash
nous permissions
nous permissions grant-all
nous permissions reset
nous permissions allow <action>
nous permissions revoke <action>
```

常见 `action`：

- `fs.read`
- `fs.write`
- `shell.exec`
- `network.http`
- `memory.write`

### Network

```bash
nous network status
nous network enable
nous network pause
nous network policy
nous network procedures
nous network export <fingerprint> [--out <path>]
nous network import <bundlePath>
nous network log [N]
```

## REPL 控制命令

```text
/commands [query]
/help [query]
/status
/attach <threadId>
/detach
/exit
/quit
```

语义：

- `/commands`：查看控制面能力
- `/status`：查看 daemon 活动
- `/attach`：切到某个 thread
- `/detach`：离开当前 thread，回到全局 REPL 模式
- `/exit` / `/quit`：退出 REPL

## REPL 自然语言控制

REPL 现在支持一小部分“高置信自然语言控制映射”。

例如：

- `what can you do here?`
- `show daemon status`
- `attach to thread_abc123`
- `你现在能做什么`
- `查看 daemon 状态`
- `切到 thread_abc123`

当前策略是：

- 高置信：直接映射到控制操作，并显示解释后的控制命令
- 中等置信：先让用户澄清
- 低置信：继续当普通对话，发给当前 thread / daemon

这意味着自然语言控制不是一套新的执行引擎，而只是控制面的输入路由层。

## 可用性边界

不同操作有不同上下文前提：

- 某些操作需要 daemon 已运行
  - 例如 `attach`
- 某些操作需要当前已经 attach 到 thread
  - 例如 REPL `/detach`
- 某些操作当前只在前台模式可用
  - 例如 `nous agents`

因此“你现在能做什么”不是一个纯静态答案，而是：

- 操作目录
- 当前 surface（CLI / REPL）
- 当前 daemon 状态
- 当前 thread 绑定状态

共同决定的上下文答案。
