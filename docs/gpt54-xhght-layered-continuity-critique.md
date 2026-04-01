# GPT54 XHGHT — 分层、显式、可转交连续性的架构批判与回撤方案

> 立场声明：这不是在“优化当前 thread / intent / scope / decision 流程”。
> 这是对目标本身的收缩：从“任何窗口都像跟同一个人自然继续对话”，退回到“同一个持续助手，但连续性是分层、显式、可转交的”。

---

## 1. 结论先行

当前 Nous 试图达成的强目标是：

> **无论在哪个窗口、无论话题如何切换，用户都可以像跟同一个人一样自然继续和 Nous 对话。**

这个目标的问题不在于“实现还不够完整”，而在于：

1. **它把多种不同类型的连续性强行混成了一种连续性**
2. **它要求 LLM + orchestration 系统模拟人类对话中的隐式共同世界**
3. **它在现有计算机界面结构与大语言模型本质上，没有稳定、低复杂度、可验证的实现路径**

因此，严厉的架构判断是：

> **强版本的“像人一样跨窗口连续对话”不应继续作为 Nous 的架构中心。**

可以保留的，不是“魔法般无缝继续”，而是：

> **同一个持续助手，但连续性必须分层、显式、可转交。**

也就是说：

- 不是所有窗口共享同一种连续性
- 不是所有消息都进入同一个治理面
- 不是所有 follow-up 都要被解释成某个显式 `intent / thread / decision` 状态变迁
- continuity 必须能被系统解释、观察、转交，而不是靠隐式猜测维持

---

## 2. 为什么当前目标在本质上过度

### 2.1 你试图统一三种本来就不同的连续性

当前架构里，至少有三种不同的“连续”：

1. **对话连续性**
   - 我们还在不在同一段谈话里
   - 更接近 UI / 会话 / channel surface

2. **工作连续性**
   - 我们还在不在做同一件事
   - 更接近 task / intent / flow / execution ownership

3. **认知连续性**
   - Nous 是否还理解“刚才说的那个东西”在当前上下文中是什么意思
   - 更接近 retrieval / matching / memory / grounding

这三者在人类经验里可以融合，是因为人脑天然做了统一。
但在计算机系统里，它们不是天然统一的。

把它们统一，意味着你必须在每一轮输入里不断猜：

- 这是同一段聊天吗
- 这是同一件工作吗
- 这是在补充旧约束，还是开新请求
- 这是“说一句话”，还是“发起一个 task”
- 这是需要保存进 memory 的事实，还是只是局部 conversational state

这会把系统推向一个高复杂度、低真值密度的区域：

> **状态越来越多，但没有唯一正确答案。**

### 2.2 LLM 没有“自然持续对话实体”的本体

必须明确：

- LLM 没有持续自我
- LLM 没有天然 thread state
- LLM 没有真正的长期共同生活世界
- 所谓“继续聊”，本质上是外部系统不断重建上下文，再让模型扮演那个连续体

所以 continuity 并不是“存在”，而是“被构造出来”。

一旦你要求：

> “在任意窗口里都像一个人那样继续”

你其实是在要求 orchestration 层接管大量本来属于人类认知系统的隐式工作：

- topic carry-over
- attention carry-over
- intent carry-over
- preference carry-over
- social memory carry-over
- interruption recovery
- ambiguity repair

这不是一个单纯增加 memory / RAG / retrieval 就能解决的问题。

### 2.3 计算机窗口不是中性的

窗口、surface、channel 自带不同语义：

- CLI：更像一次操作会话
- IDE：更像工程上下文与文件上下文
- Web chat：更像显式对话界面
- Notification：更像异步提醒

“无论在哪个窗口都像同一个人”这个目标，等于在要求系统跨越这些语义差异，提供一个统一人格化幻觉。

为了制造这种幻觉，你已经被迫引入：

- `thread`
- `intent`
- `flow`
- `decision`
- `scope`
- `contract`
- `grounding`
- `evidence`
- `turn trust receipt`
- `thread input router`
- `thread scope router`

这些对象单看都合理，但组合起来会出现一个更大的问题：

> **你不再是在表达真实边界，而是在不断修补“统一连续对话幻觉”的破绽。**

---

## 3. 当前架构已经暴露出来的高风险点

### 3.1 `thread` 与 `intent` 的边界不稳定

现有设计已经明确说：

- `thread` = communication continuity
- `intent` = work identity

这在文档上是对的。
但实现上：

- 用户 attach 到某个 thread 后，后续消息默认继续进入该 thread
- 即使语义上已切新任务，系统也经常仍停留在同一 thread
- 再依靠 router 去判断是 `current_intent` 还是 `new_intent`

这意味着：

- `thread` 既像轻量容器
- 又被用户感知成 topic
- 还被系统半拿来做治理路由

这是一个典型的“对象定义已经漂移”的信号。

### 3.2 clarification / scope update / preference update / follow-up refinement 混线

例如：

- “我不喜欢洋葱”

对用户来说可能是：

- 更新饮食偏好
- 顺便要求你基于新约束重算刚才的菜单

对当前系统来说却必须先二选一：

- 偏好更新 intent
- 当前 intent refinement

这类消息没有稳定真值。
一旦你要求系统总能做对，它就必须不断引入：

- 更复杂的 router
- 更多显式状态
- 更多 resume / handoff / scope update 分支

而不是更简单的边界。

### 3.3 默认把大量消息抬升到治理平面

现在的设计倾向于把很多本来应该是“轻对话”的东西抬升为：

- intent
- contract
- evidence
- plan
- completion artifact

这在 coding task 上可接受，在日常助手场景会迅速显得过度：

- 用户只是随口补一句偏好
- 系统却形成一个完整的 task contract
- 再发一个 answer artifact

这不是“更可靠”，而是“把本不该治理的东西也治理了”。

### 3.4 可观测性越强，越不像自然对话

`turn context / route / contract / worked for / evidence`
这些对象对调试非常有价值。

但它们的副作用是：

- 助手越来越像 workflow engine
- 每次对话都被暴露出一层内部治理结构
- 用户越能看见系统，越难把它当成“自然对话对象”

这不是坏事，但说明目标要改：

> **不要再追“像人一样自然继续”**
> **而要接受“这是持续助手，但它有显式工作层与显式可转交层”**

---

## 4. 结合其他框架的判断

### 4.1 Codex：thread / turn 明确分离，但不假装“任意窗口像同一个人”

Codex 的 v2 接口明确把：

- `thread/start`
- `turn/start`
- `turn/interrupt`
- `thread/read`

分成不同操作。

这背后的选择不是装饰，而是在承认：

- `thread` 是持久历史容器
- `turn` 是单次交互 / 执行单元
- continuity 需要显式恢复，而不是默认隐式漂移

它解决的问题是：

- how to persist history
- how to resume execution
- how to make model-visible history testable

它没有试图让所有 surface 自动共享一种“像人一样”的连续对话幻觉。

**Nous 应该借鉴的不是 Codex 的 UI 表象，而是它承认 continuity 是显式协议对象。**

### 4.2 Claude Code：`--continue` / `--resume` 更像工作连续性，不是人格式连续性

Claude Code / Claude Code Sourcemap 里，session 恢复与 compaction 很重要，但它的目标更接近：

- 工作恢复
- 会话恢复
- 上下文压缩

而不是：

- 任意窗口、任意切题仍像一个人继续自然对话

尤其关键的一点是：

> compaction 不是 memory 沉淀

这说明它在有意识地避免把所有 conversational state 自动抬升为持久理解。

**Nous 应该借鉴的是：把恢复做成显式机制，把“值得长期记住什么”做成更克制的策略。**

### 4.3 OpenClaw：更诚实地把 continuity 限制在 session / history budget 上

OpenClaw 直接对长会话做：

- sessionKey
- prompt mode (`minimal` / `full`)
- history turn limiting

它解决的是：

- token budget
- channel / session routing
- 运行时 prompt 规模

这不是同一个问题，但它提醒了一点：

> 很多所谓 continuity 问题，最后都要回到“当前 surface 允许保留多少上下文”这种现实约束。

OpenClaw 没有试图在对象模型上过度拟人化。
它的代价是 personal-assistant continuity 很弱；
但它避免了把系统推入过度抽象。

**Nous 不该照搬 OpenClaw，但要学习它在“session 只是 session”这件事上的诚实。**

---

## 5. 新方向：同一个持续助手，但连续性是分层、显式、可转交的

这是建议的新架构中心：

> **One persistent assistant. Multiple continuity layers. Explicit handoff.**

### 5.0 Mainline clarification after planning handoff

后续 deep-interview / consensus planning 又补上了两个主线边界：

1. **mainline 不再坚持“所有输入先进入统一 intent/task-intake pipeline”**
   - 现在的主线合同是：
   - **先判 `chat / work / handoff`，再决定是否进入工作治理**
2. **显式 handoff 很重要，但不是唯一 bridge**
   - mainline 允许：
   - **升级后的结构化 memory 在双门槛下直接恢复 work continuity**
   - 双门槛是：
     - 已升级为结构化 work/commonality memory
     - 当前场景通过 match + permission + boundary checks

因此，主线不是“只有显式 handoff”，
而是：

> **explicit handoff first-class + governed structured restoration allowed**

### 5.1 五层连续性，而不是一种 continuity

#### Layer A — Identity Continuity

“我在和同一个 Nous 说话。”

这是 daemon / local-first runtime 提供的：

- same assistant identity
- same local policy
- same memory substrate
- same background runtime

这层应该始终存在。
这是 Nous 最重要的连续性。

#### Layer B — Surface Continuity

“我现在附着在哪个 surface/container 上。”

这层是：

- CLI REPL session
- IDE panel
- Web chat tab
- notification reply surface

这层不该被强行当成人类对话 topic 真值。
它首先是一个 **UI / transport / attachment container**。

也就是说：

- surface continuity ≠ semantic continuity

#### Layer C — Work Continuity

“我们现在是不是还在做同一件工作。”

这层应该由更少、更稳定的对象负责，例如：

- `WorkItem` 或保留 `Intent`
- `Flow`
- `Decision`

但要注意：

- 只有进入工作模式的交互，才进入这层
- 不是每条聊天消息都应该生成 work object

#### Layer D — Transfer Continuity

“如果要从一个窗口/模式切到另一个，系统能否显式地把必要上下文转交过去。”

这是未来最关键的一层。

不要追求“自动无缝继续”，而要追求：

> **可显式转交**

例如：

- “继续刚才那个工作”
- “把这个对话转成一个明确任务”
- “把这个任务 attach 到 IDE”
- “把当前结论转成可恢复 capsule”

但主线后续澄清也说明：

- explicit handoff **不是唯一合法 bridge**
- 当 memory 已被提升为结构化对象，而且当前场景通过双门槛检查时，
- 系统也可以直接恢复 work continuity

所以更准确的说法是：

> **transfer continuity 应优先追求显式可转交；  
> memory continuity 只在被治理提升后，才可直接参与恢复。**

#### Layer E — Memory Continuity

“Nous 是否能检索到足够相关的长期事实 / 偏好 /工作记录。”

这层不应该冒充 thread continuity。
它应该是：

- selective
- provenance-aware
- retrieval-driven

而不是“因为还在同一 thread，所以自动理解一切”。

---

## 6. 建议的新交互模型

### 6.1 把 interaction mode 显式化

现在的问题之一是：所有消息都在走同一套大而全的解析链。

建议退回三种主模式：

#### 模式 1：Chat Mode

目标：

- 轻对话
- 轻问答
- 轻建议
- 轻偏好补充

特征：

- 默认不生成完整 `intent / contract / evidence`
- 允许 memory side effect
- 允许 retrieval
- 允许“继续聊”
- 但不默认进入工作治理面

#### 模式 2：Work Mode

目标：

- 明确让 Nous 帮你做一件事

特征：

- 进入 `intent / flow / decision / evidence`
- 可以异步
- 可以 attach / resume / verify
- 这是强治理平面

#### 模式 3：Handoff Mode

目标：

- 把当前上下文转交到另一个 surface / 另一个工作对象 / 另一个时间点

特征：

- 生成显式 handoff capsule
- capsule 可附着到：
  - 新 surface
  - 新 work item
  - 新 follow-up turn

这三种模式之间应该允许显式转换，而不是默认全混。

---

## 7. 对当前对象模型的回撤建议

### 7.1 `DialogueThread` 降级为 surface conversation container

不要再让 `DialogueThread` 背负：

- 语义 topic 真值
- work identity
- routing truth

应该明确它只是：

- 消息容器
- attach target
- delivery target
- replay / inspect target

它可以有 title，但 title 只是帮助识别，不是语义边界。

### 7.2 `Intent` 只在 Work Mode 中生成

不是每个 follow-up 都该进 `Intent`。

例如：

- “我也不喜欢洋葱”
- “换个说法”
- “说短一点”
- “你还记得刚才那个吗”

这些更像 chat-layer continuation，不该默认生成一个完整工作对象。

主线现在还进一步收紧为：

- 架构命名目标应迁向 `WorkItem`
- 但允许存在一个有边界的 `Intent -> WorkItem` 兼容迁移期

### 7.3 `Decision` 只服务工作阻塞，不接管普通对话澄清

当前 clarification 被设计得太靠近通用对话层。

应该区分：

- **chat clarification**
  - 轻量 conversational repair
  - 不一定进入 decision queue

- **work clarification**
  - 会阻塞执行
  - 需要 decision object

否则系统会把大量普通对话都治理化。

### 7.4 `Evidence / AnswerArtifact / TrustReceipt` 只在 Work Mode 默认展示

Chat Mode 下：

- 不默认展示 evidence
- 不默认展示 trust receipt
- 不默认展示 contract

Work Mode 下：

- 显式展示
- 因为这里的目标就是可观察、可治理、可恢复

---

## 8. 代码层的回撤路线

下面是我认为更现实的退回计划。

### Phase 0 — Freeze the fantasy

先停止继续加重“统一连续对话”的局部补丁。

包括谨慎对待：

- 更多 thread router 规则
- 更多 clarification 特判
- 更多“自动判断这是同一 topic 还是新 topic”

原因：

- 这些都会继续给幻觉型 continuity 续命
- 但不会真正把边界变清楚

### Phase 1 — 显式引入 interaction mode

在代码层新增一个更上位的输入分类结果，例如：

```typescript
type InteractionMode = "chat" | "work" | "handoff";
```

每条输入先判 mode，再决定是否进入工作治理链。

这一步的目标是：

- 不让所有消息默认走 `submitIntentBackground`
- 把普通对话从工作平面中剥离出来

**代码影响**

- `packages/infra/src/daemon/server.ts`
  - 在 `submit_intent` / `send_message` 入口前增加 mode resolution
- `packages/infra/src/intake/*router.ts`
  - thread router 不再直接负责全部 continuity 决策
- `packages/orchestrator`
  - 只处理进入 Work Mode 的输入

### Phase 2 — 重定义 `DialogueThread`

把 thread 定义落实为：

- attach container
- message replay unit
- delivery/outbox target

而不是：

- semantic topic truth
- work truth

**代码影响**

- `packages/core/src/types/dialogue.ts`
  - 增加更明确的 metadata 字段，区分：
    - `surfaceKind`
    - `originChannel`
    - optional `activeWorkId`
    - optional `handoffCapsuleId`
- `packages/infra/src/daemon/dialogue-service.ts`
  - `inferThreadTitle` 只作为 UI 帮助
  - 不再暗示 thread title 是 topic truth

### Phase 3 — 引入 `HandoffCapsule`

这是最关键的结构。

```typescript
interface HandoffCapsule {
  id: string;
  sourceSurfaceId?: string;
  sourceThreadId?: string;
  sourceWorkItemId?: string;
  summary: string;
  relevantFacts: string[];
  pendingQuestions: string[];
  suggestedNextAction?: "continue_chat" | "resume_work" | "start_new_work";
  createdAt: string;
}
```

它的作用是：

- 不再幻想“自动无缝继续”
- 而是把 continuity 变成显式可转交对象

例如：

- CLI 聊到一半，切到 IDE
- 把当前需要继续的部分显式打包成 capsule
- IDE attach 的不是“神秘统一 thread”，而是一个明确 handoff

但主线最终没有把它升级为“唯一合法 continuity bridge”。
它现在的地位是：

- **first-class**
- **strongly preferred for explicit transfer**
- **but coexists with governed structured-memory restoration**

### Phase 4 — Chat memory 与 Work memory 分离

当前 memory producer 太容易把 chat 跟 work 混在一起。

建议拆成：

- `ChatMemory`
  - 偏好
  - 关系语境
  -轻量 conversation facts

- `WorkMemory`
  - intent outcome
  - procedure traces
  - evidence
  - artifact-derived conclusions

这样可以避免：

- “一句闲聊”被抬升成工作记忆
- “一个工作 artifact”反过来污染轻对话 continuity

### Phase 5 — 把 follow-up refinement 作为显式工作能力，而不是 thread 魔法

像：

- “不要洋葱”
- “短一点”
- “换成面向老板的语气”

如果是针对上一条工作答案的 refinement，就应该有显式能力对象，例如：

- `RefineLastAnswer`
- `ReviseRecentWorkResult`

而不是通过 thread continuation + router 猜出来。

这一步会明显降低：

- scope update 误判
- preference update / work refinement 混淆

---

## 9. 代码上哪些东西应该降级，哪些应该保留

### 保留

- daemon / local-first runtime
- outbox / attach / replay
- explicit decision queue
- evidence / trust receipt（仅工作层）
- retrieval / matching layer
- memory / artifact distinction
- flow-governed work

### 降级

- thread 作为语义 topic 真值
- 所有 follow-up 默认都走 intent
- 普通对话默认显示 contract / evidence / worked-for
- 把 preference update 自动解释成工作 continuation
- 在单一 thread 中承载所有 continuity 责任

### 新增

- interaction mode
- handoff capsule
- chat continuity vs work continuity 区分
- chat clarification vs work clarification 区分

---

## 10. 最终应该追求的产品感受

不是：

> “任何窗口里都像跟一个人自然无缝继续。”

而是：

> “无论在哪个窗口，我都知道还是同一个 Nous；  
> 如果只是聊天，它自然轻便；  
> 如果进入工作，它清楚可靠；  
> 如果要切窗口或切模式，它能明确把上下文转交过去。” 

这比“像人一样”少一点幻觉，
但比现在这套正在膨胀的统一连续性架构，更可实现，也更诚实。

---

## 11. 一句话收束

当前问题不是某个 router、某个 retrieval、某个 prompt 还不够强。

真正的问题是：

> **Nous 现在试图把“身份连续性、对话连续性、工作连续性、认知连续性”压成一个统一抽象。**

这在现阶段会持续制造高复杂度、低真值密度的系统。

正确的回撤方向是：

> **保留同一个持续助手，放弃统一连续对话幻觉，把 continuity 改造成分层、显式、可转交。**

### 补充：`NousHumanLike` 分支

为了不丢失那条更激进的探索线，repo 现在还明确保留：

- `NousHumanLike`

它继续探索：

- “像人一样在任意窗口自然无缝继续对话”

但它与 mainline 的关系是：

- **独立探索**
- **不回流 main**
- **不重新定义 mainline 的合同**
