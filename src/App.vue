<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Activity, ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Command, FileCheck2, FileQuestion, Files, Filter, GitBranch, History,
  LayoutDashboard, ListChecks, LockKeyhole, LogOut, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles, X,
} from 'lucide-vue-next'
import LoginView from './LoginView.vue'
import { api, ApiError } from './api'

type Role = 'admin' | 'system_owner' | 'tester' | 'auditor'
type Stage = '待澄清' | '待设计' | '待审核' | '已完成'
type SystemRef = { id: string; name: string; type: string; role: Role }
type Profile = { id: string; email: string; name: string; systems: SystemRef[] }
type QueueItem = {
  id: string
  title: string
  module: string
  source: string
  updated: string
  updatedAt: string
  stage: Stage
  owner: string
  initials: string
  color: string
  counts: { openQuestions: number; scenarios: number }
}
type Clarification = {
  id: string
  question: string
  rationale: string
  blocksDesign: boolean
  answer: string | null
  status: 'open' | 'answer_proposed' | 'confirmed'
  confirmedAt: string | null
  confirmedBy: { id: string; name: string } | null
}
type Scenario = {
  id: string
  requirementId: string
  title: string
  objective: string
  steps: string[]
  expectedResult: string
  status: string
  citations: Array<{ source: string; quote: string }>
}
type RequirementDetail = {
  id: string
  title: string
  module: string
  sourceName: string | null
  sourceText: string
  status: string
  aiSummary: {
    summary?: string
    sourceFacts?: Array<{ text: string; quote: string }>
    assumptions?: string[]
  }
  clarifications: Clarification[]
  scenarios: Scenario[]
}
type Dashboard = {
  counts: {
    requirements: number
    pendingClarifications: number
    pendingScenarios: number
    publishedKnowledge: number
  }
}
type Member = { id: string; user: { id: string; name: string; email: string; active: boolean }; role: Role; createdAt: string }
type AuditItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown>
  createdAt: string
  actor: { id: string; name: string; email: string } | null
}
type KnowledgeItem = {
  id: string
  title: string
  content: string
  module: string
  status: string
  createdAt: string
  updatedAt: string
  sourceReference: Record<string, unknown>
  creator?: { name: string }
  reviewer?: { name: string } | null
}
type SystemProfile = {
  id: string
  name: string
  type: string
  description: string
  status: string
  profile: {
    businessLine?: string
    ownerName?: string
    version?: string
    aliases?: string[]
    modules?: string[]
    roles?: string[]
    workflows?: string[]
    dependencies?: string[]
    testEnvironments?: string[]
    securityNotes?: string
    sourceReferences?: string[]
  }
  profileStatus: 'draft' | 'confirmed'
  profileConfirmedAt: string | null
  profileConfirmedBy: { id: string; name: string } | null
}
type SystemProfileDraft = {
  name: string
  type: string
  description: string
  businessLine: string
  ownerName: string
  version: string
  aliases: string
  modules: string
  roles: string
  workflows: string
  dependencies: string
  testEnvironments: string
  securityNotes: string
  sourceReferences: string
}

const authLoading = ref(true)
const authBusy = ref(false)
const authMessage = ref('')
const serviceUnavailable = ref(false)
const profile = ref<Profile | null>(null)
const activeSystemId = ref('')
const activeNav = ref('工作台')
const activeFilter = ref('全部事项')
const selectedModule = ref('全部模块')
const sortNewestFirst = ref(true)
const selectedItem = ref<QueueItem | null>(null)
const selectedDetail = ref<RequirementDetail | null>(null)
const drawerWidth = ref(560)
const showCreateModal = ref(false)
const showAccountMenu = ref(false)
const showSystemMenu = ref(false)
const showNotifications = ref(false)
const query = ref('')
const newTitle = ref('')
const newSource = ref('')
const newSourceText = ref('')
const notice = ref('')
const busyAction = ref('')
const answerDrafts = ref<Record<string, string>>({})
const queue = ref<QueueItem[]>([])
const dashboard = ref<Dashboard>({ counts: { requirements: 0, pendingClarifications: 0, pendingScenarios: 0, publishedKnowledge: 0 } })
const members = ref<Member[]>([])
const auditItems = ref<AuditItem[]>([])
const knowledgeItems = ref<KnowledgeItem[]>([])
const knowledgeFormVisible = ref(false)
const editingKnowledgeId = ref<string | null>(null)
const revisingKnowledgeId = ref<string | null>(null)
const knowledgeTitle = ref('')
const knowledgeContent = ref('')
const knowledgeModule = ref('测试用例管理')
const knowledgeSourceReferences = ref('')
const scenarios = ref<Array<Scenario & { requirementTitle: string }>>([])
const systemProfile = ref<SystemProfile | null>(null)
const profileDraft = ref<SystemProfileDraft | null>(null)
const profileEditing = ref(false)
const memberFormVisible = ref(false)
const memberEmail = ref('')
const memberName = ref('')
const memberPassword = ref('')
const memberRole = ref<Role>('tester')
const searchInput = ref<HTMLInputElement | null>(null)
const questionFormVisible = ref(false)
const newQuestion = ref('')
const newQuestionRationale = ref('')
const newQuestionBlocks = ref(true)
let drawerResizeStart: { pointerX: number; width: number } | null = null

const navItems = [
  { label: '工作台', icon: LayoutDashboard },
  { label: '需求与澄清', icon: MessageSquareText },
  { label: '测试设计', icon: ListChecks },
  { label: '系统画像', icon: GitBranch },
  { label: '知识库', icon: BookOpen },
]
const managementItems = [
  { label: '审计记录', icon: History },
  { label: '权限管理', icon: ShieldCheck },
]
const navDescription: Record<string, string> = {
  '需求与澄清': '管理需求材料、AI 识别结果和待确认问题。',
  '测试设计': '审核从已确认需求与知识生成的测试场景。',
  系统画像: '维护被测系统结构、流程、角色与版本信息。',
  知识库: '沉淀经审核的业务规则、操作约定与测试经验。',
  审计记录: '追踪知识变更、审核操作、AI 调用与导出记录。',
  权限管理: '管理用户、角色分配与系统级访问范围。',
}
const roleLabels: Record<Role, string> = {
  admin: '管理员',
  system_owner: '系统负责人',
  tester: '测试人员',
  auditor: '只读审计员',
}
const currentSystem = computed(() => profile.value?.systems.find((system) => system.id === activeSystemId.value) ?? null)
const currentRole = computed(() => currentSystem.value?.role ?? null)
const roleLabel = computed(() => currentRole.value ? roleLabels[currentRole.value] : '未分配角色')
const canEdit = computed(() => currentRole.value === 'admin' || currentRole.value === 'system_owner' || currentRole.value === 'tester')
const canApprove = computed(() => currentRole.value === 'admin' || currentRole.value === 'system_owner')
const canManageMembers = computed(() => currentRole.value === 'admin' || currentRole.value === 'system_owner')
const visibleNavItems = computed(() => navItems)
const visibleManagementItems = computed(() => managementItems.filter((item) =>
  item.label === '审计记录'
    ? ['admin', 'system_owner', 'auditor'].includes(currentRole.value ?? '')
    : canManageMembers.value,
))
const isDashboard = computed(() => activeNav.value === '工作台' || activeNav.value === '需求与澄清')
const pendingClarificationCount = computed(() => dashboard.value.counts.pendingClarifications)
const pendingReviewCount = computed(() => dashboard.value.counts.pendingScenarios)
const confirmedCount = computed(() => dashboard.value.counts.publishedKnowledge)
const canConfirmProfile = computed(() => {
  const draft = profileDraft.value
  return Boolean(draft?.name.trim() && draft.description.trim() && draft.modules.trim() && draft.workflows.trim())
})
const profileSections = computed(() => {
  const data = systemProfile.value?.profile ?? {}
  return [
    { title: '功能模块', values: data.modules ?? [] },
    { title: '用户角色', values: data.roles ?? [] },
    { title: '核心流程', values: data.workflows ?? [] },
    { title: '上下游依赖', values: data.dependencies ?? [] },
    { title: '测试环境', values: data.testEnvironments ?? [] },
    { title: '来源依据', values: data.sourceReferences ?? [] },
  ]
})

const filteredQueue = computed(() => {
  const search = query.value.trim().toLowerCase()
  return queue.value.filter((item) => {
    const matchesFilter =
      activeFilter.value === '全部事项' ||
      (activeFilter.value === '待澄清' && item.stage === '待澄清') ||
      (activeFilter.value === '待审核' && item.stage === '待审核')
    const matchesSearch =
      !search || `${item.title} ${item.id} ${item.module} ${item.owner}`.toLowerCase().includes(search)
    const matchesModule = selectedModule.value === '全部模块' || item.module === selectedModule.value
    return matchesFilter && matchesSearch && matchesModule
  }).sort((left, right) => {
    const difference = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    return sortNewestFirst.value ? -difference : difference
  })
})
const moduleOptions = computed(() => ['全部模块', ...new Set(queue.value.map((item) => item.module))])

function notify(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2800)
}

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function auditAction(action: string) {
  const labels: Record<string, string> = {
    'auth.login': '用户登录',
    'auth.logout': '用户退出',
    'auth.login_failed': '登录失败',
    'membership.created': '添加系统成员',
    'membership.role_updated': '调整成员角色',
    'requirement.created': '创建需求',
    'requirement.ai_analyzed': 'AI 分析需求',
    'clarification.created': '添加澄清问题',
    'clarification.answer_proposed': '提交澄清答案',
    'clarification.answer_confirmed': '确认澄清答案',
    'test_scenarios.generated': '生成测试场景',
    'test_scenario.approved': '审核测试场景',
    'knowledge.draft_created': '创建知识草稿',
    'knowledge.published': '发布知识',
  }
  return labels[action] ?? action
}

function auditEntity(entityType: string) {
  const labels: Record<string, string> = {
    user: '用户',
    system_membership: '成员角色',
    requirement: '需求',
    clarification: '澄清问题',
    test_scenario: '测试场景',
    knowledge_entry: '知识条目',
  }
  return labels[entityType] ?? entityType
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

function minDrawerWidth() {
  return Math.min(420, Math.max(280, window.innerWidth - 24))
}

function maxDrawerWidth() {
  return Math.max(minDrawerWidth(), Math.min(1000, window.innerWidth - 320))
}

function clampDrawerWidth(width: number) {
  return Math.min(maxDrawerWidth(), Math.max(minDrawerWidth(), width))
}

function startDrawerResize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  drawerResizeStart = { pointerX: event.clientX, width: drawerWidth.value }
  document.body.classList.add('is-resizing-drawer')
  window.addEventListener('pointermove', moveDrawerResize)
  window.addEventListener('pointerup', stopDrawerResize)
  window.addEventListener('pointercancel', stopDrawerResize)
}

function moveDrawerResize(event: PointerEvent) {
  if (!drawerResizeStart) return
  drawerWidth.value = clampDrawerWidth(
    drawerResizeStart.width + drawerResizeStart.pointerX - event.clientX,
  )
}

function stopDrawerResize() {
  drawerResizeStart = null
  document.body.classList.remove('is-resizing-drawer')
  window.removeEventListener('pointermove', moveDrawerResize)
  window.removeEventListener('pointerup', stopDrawerResize)
  window.removeEventListener('pointercancel', stopDrawerResize)
}

function resizeDrawerByKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 64 : 24
  if (event.key === 'ArrowLeft') drawerWidth.value = clampDrawerWidth(drawerWidth.value + step)
  else if (event.key === 'ArrowRight') drawerWidth.value = clampDrawerWidth(drawerWidth.value - step)
  else if (event.key === 'Home') drawerWidth.value = minDrawerWidth()
  else if (event.key === 'End') drawerWidth.value = maxDrawerWidth()
  else return
  event.preventDefault()
}

function displayStage(status: string): Stage {
  if (status === 'ready_for_design') return '待设计'
  if (status === 'design_generated') return '待审核'
  if (status === 'approved' || status === 'completed') return '已完成'
  return '待澄清'
}

function stageClass(stage: Stage) {
  return {
    'status-question': stage === '待澄清',
    'status-review': stage === '待审核' || stage === '待设计',
    'status-confirmed': stage === '已完成',
  }
}

function mapQueueItem(item: {
  id: string; title: string; module: string; sourceName: string | null; status: string;
  updatedAt: string; createdBy?: string; counts: { openQuestions: number; scenarios: number }
}): QueueItem {
  const name = item.createdBy || profile.value?.name || '—'
  return {
    ...item,
    source: item.sourceName || '未关联来源材料',
    updated: formatDate(item.updatedAt),
    stage: displayStage(item.status),
    owner: name,
    initials: name.slice(0, 1),
    color: 'sage',
  }
}

async function refreshDashboard() {
  if (!activeSystemId.value) return
  const [summary, requirements, loadedProfile] = await Promise.all([
    api<Dashboard & { requirements: Parameters<typeof mapQueueItem>[0][] }>(`/systems/${activeSystemId.value}/dashboard`),
    api<Parameters<typeof mapQueueItem>[0][]>(`/systems/${activeSystemId.value}/requirements`),
    api<SystemProfile>(`/systems/${activeSystemId.value}/profile`),
  ])
  dashboard.value = summary
  queue.value = requirements.map(mapQueueItem)
  systemProfile.value = loadedProfile
  if (!profileEditing.value) profileDraft.value = toProfileDraft(loadedProfile)
}

async function setProfile(next: Profile) {
  if (!next.systems.length) {
    profile.value = next
    activeSystemId.value = ''
    authMessage.value = '当前账户尚未加入任何系统，请联系平台管理员。'
    return
  }
  activeSystemId.value = next.systems[0].id
  serviceUnavailable.value = false
  await refreshDashboard()
  profile.value = next
}

async function initialize() {
  try {
    const result = await api<{ user: Profile }>('/auth/me')
    await setProfile(result.user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      profile.value = null
    } else {
      serviceUnavailable.value = true
    }
  } finally {
    authLoading.value = false
  }
}

async function login(credentials: { email: string; password: string }) {
  authBusy.value = true
  authMessage.value = ''
  serviceUnavailable.value = false
  try {
    const result = await api<{ user: Profile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    await setProfile(result.user)
  } catch (error) {
    if (error instanceof ApiError) authMessage.value = error.message
    else serviceUnavailable.value = true
  } finally {
    authBusy.value = false
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' })
  } finally {
    profile.value = null
    selectedItem.value = null
    selectedDetail.value = null
    showAccountMenu.value = false
    activeNav.value = '工作台'
  }
}

async function selectNav(label: string) {
  activeNav.value = label
  selectedItem.value = null
  selectedDetail.value = null
  try {
    if (label === '审计记录') auditItems.value = await api(`/systems/${activeSystemId.value}/audit`)
    if (label === '权限管理') members.value = await api(`/systems/${activeSystemId.value}/members`)
    if (label === '知识库') knowledgeItems.value = await api(`/systems/${activeSystemId.value}/knowledge`)
    if (label === '测试设计') scenarios.value = await api(`/systems/${activeSystemId.value}/scenarios`)
    if (label === '系统画像') await loadSystemProfile()
  } catch (error) {
    notify(error instanceof Error ? error.message : '页面数据加载失败')
  }
}

async function switchSystem(system: SystemRef) {
  activeSystemId.value = system.id
  showSystemMenu.value = false
  activeNav.value = '工作台'
  selectedItem.value = null
  selectedDetail.value = null
  systemProfile.value = null
  profileDraft.value = null
  profileEditing.value = false
  try {
    await refreshDashboard()
  } catch (error) {
    notify(error instanceof Error ? error.message : '切换系统失败')
  }
}

function toProfileDraft(profile: SystemProfile): SystemProfileDraft {
  const data = profile.profile ?? {}
  const lines = (items?: string[]) => items?.join('\n') ?? ''
  return {
    name: profile.name,
    type: profile.type,
    description: profile.description ?? '',
    businessLine: data.businessLine ?? '',
    ownerName: data.ownerName ?? '',
    version: data.version ?? '',
    aliases: lines(data.aliases),
    modules: lines(data.modules),
    roles: lines(data.roles),
    workflows: lines(data.workflows),
    dependencies: lines(data.dependencies),
    testEnvironments: lines(data.testEnvironments),
    securityNotes: data.securityNotes ?? '',
    sourceReferences: lines(data.sourceReferences),
  }
}

function profileLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

async function loadSystemProfile() {
  systemProfile.value = await api<SystemProfile>(`/systems/${activeSystemId.value}/profile`)
  profileDraft.value = toProfileDraft(systemProfile.value)
  profileEditing.value = false
}

async function saveSystemProfile() {
  if (!profileDraft.value) return
  busyAction.value = 'save-profile'
  const draft = profileDraft.value
  try {
    systemProfile.value = await api<SystemProfile>(`/systems/${activeSystemId.value}/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        name: draft.name.trim(),
        type: draft.type,
        description: draft.description.trim(),
        businessLine: draft.businessLine.trim(),
        ownerName: draft.ownerName.trim(),
        version: draft.version.trim(),
        aliases: profileLines(draft.aliases),
        modules: profileLines(draft.modules),
        roles: profileLines(draft.roles),
        workflows: profileLines(draft.workflows),
        dependencies: profileLines(draft.dependencies),
        testEnvironments: profileLines(draft.testEnvironments),
        securityNotes: draft.securityNotes.trim(),
        sourceReferences: profileLines(draft.sourceReferences),
      }),
    })
    profileDraft.value = toProfileDraft(systemProfile.value)
    profileEditing.value = false
    if (profile.value) {
      profile.value = {
        ...profile.value,
        systems: profile.value.systems.map((item) =>
          item.id === systemProfile.value?.id
            ? { ...item, name: systemProfile.value.name, type: systemProfile.value.type }
            : item,
        ),
      }
    }
    notify('系统画像草稿已保存并写入审计')
  } catch (error) {
    notify(error instanceof Error ? error.message : '系统画像保存失败')
  } finally {
    busyAction.value = ''
  }
}

async function confirmSystemProfile() {
  if (!systemProfile.value) return
  busyAction.value = 'confirm-profile'
  try {
    systemProfile.value = await api<SystemProfile>(`/systems/${activeSystemId.value}/profile/confirm`, {
      method: 'POST',
    })
    profileDraft.value = toProfileDraft(systemProfile.value)
    notify('系统画像已确认，后续 AI 设计可使用该画像')
  } catch (error) {
    notify(error instanceof Error ? error.message : '系统画像确认失败')
  } finally {
    busyAction.value = ''
  }
}

async function openItem(item: QueueItem) {
  selectedItem.value = item
  selectedDetail.value = null
  answerDrafts.value = {}
  try {
    const detail = await api<RequirementDetail>(`/systems/${activeSystemId.value}/requirements/${item.id}`)
    selectedDetail.value = detail
    for (const clarification of detail.clarifications) {
      answerDrafts.value[clarification.id] = clarification.answer ?? ''
    }
  } catch (error) {
    notify(error instanceof Error ? error.message : '需求详情加载失败')
    selectedItem.value = null
  }
}

async function addRequirement() {
  if (!newTitle.value.trim() || !activeSystemId.value) return
  busyAction.value = 'create-requirement'
  try {
    const created = await api<{ id: string }>(`/systems/${activeSystemId.value}/requirements`, {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle.value.trim(),
        sourceName: newSource.value.trim() || undefined,
        sourceText: newSourceText.value.trim() || undefined,
        module: '测试用例管理',
      }),
    })
    newTitle.value = ''
    newSource.value = ''
    newSourceText.value = ''
    showCreateModal.value = false
    activeFilter.value = '全部事项'
    activeNav.value = '工作台'
    await refreshDashboard()
    const item = queue.value.find((entry) => entry.id === created.id)
    if (item) await openItem(item)
    notify('需求已保存到澄清队列')
  } catch (error) {
    notify(error instanceof Error ? error.message : '需求创建失败')
  } finally {
    busyAction.value = ''
  }
}

async function analyzeRequirement() {
  if (!selectedItem.value) return
  busyAction.value = 'analyze'
  try {
    selectedDetail.value = await api<RequirementDetail>(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/analyze`,
      { method: 'POST' },
    )
    for (const clarification of selectedDetail.value.clarifications) {
      answerDrafts.value[clarification.id] = clarification.answer ?? ''
    }
    await refreshDashboard()
    notify('分析完成；生成内容仍需人工审核')
  } catch (error) {
    notify(error instanceof Error ? error.message : 'AI 分析失败')
  } finally {
    busyAction.value = ''
  }
}

async function addClarification() {
  if (!selectedItem.value || !newQuestion.value.trim()) return
  busyAction.value = 'add-clarification'
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/clarifications`,
      {
        method: 'POST',
        body: JSON.stringify({
          question: newQuestion.value.trim(),
          rationale: newQuestionRationale.value.trim(),
          blocksDesign: newQuestionBlocks.value,
        }),
      },
    )
    newQuestion.value = ''
    newQuestionRationale.value = ''
    newQuestionBlocks.value = true
    questionFormVisible.value = false
    await openItem(selectedItem.value)
    await refreshDashboard()
    notify('澄清问题已加入并写入审计')
  } catch (error) {
    notify(error instanceof Error ? error.message : '澄清问题创建失败')
  } finally {
    busyAction.value = ''
  }
}

async function saveAnswer(question: Clarification) {
  if (!selectedItem.value) return
  const answer = answerDrafts.value[question.id]?.trim()
  if (!answer) return notify('请先填写业务确认答案')
  busyAction.value = `answer-${question.id}`
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/clarifications/${question.id}/answer`,
      { method: 'POST', body: JSON.stringify({ answer }) },
    )
    await openItem(selectedItem.value)
    notify('答案已保存，等待负责人确认')
  } catch (error) {
    notify(error instanceof Error ? error.message : '答案保存失败')
  } finally {
    busyAction.value = ''
  }
}

async function confirmAnswer(question: Clarification) {
  if (!selectedItem.value) return
  busyAction.value = `confirm-${question.id}`
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/clarifications/${question.id}/confirm`,
      { method: 'POST' },
    )
    await openItem(selectedItem.value)
    await refreshDashboard()
    notify('业务答案已确认并留痕')
  } catch (error) {
    notify(error instanceof Error ? error.message : '确认失败')
  } finally {
    busyAction.value = ''
  }
}

async function generateScenarios() {
  if (!selectedItem.value) return
  busyAction.value = 'generate-scenarios'
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/scenarios/generate`,
      { method: 'POST' },
    )
    await openItem(selectedItem.value)
    await refreshDashboard()
    notify('测试场景已生成，状态为待审核')
  } catch (error) {
    notify(error instanceof Error ? error.message : '测试场景生成失败')
  } finally {
    busyAction.value = ''
  }
}

async function approveScenario(scenario: Scenario) {
  const requirementId = selectedItem.value?.id ?? scenario.requirementId
  if (!requirementId) {
    notify('无法定位该场景所属需求，请刷新列表后重试')
    return
  }
  busyAction.value = `approve-${scenario.id}`
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${requirementId}/scenarios/${scenario.id}/review`,
      { method: 'POST' },
    )
    if (selectedItem.value?.id === requirementId) await openItem(selectedItem.value)
    if (activeNav.value === '测试设计') {
      scenarios.value = await api(`/systems/${activeSystemId.value}/scenarios`)
    }
    await refreshDashboard()
    notify('测试场景已审核')
  } catch (error) {
    notify(error instanceof Error ? error.message : '测试场景审核失败')
  } finally {
    busyAction.value = ''
  }
}

async function createKnowledge(question: Clarification) {
  if (!selectedItem.value) return
  busyAction.value = `knowledge-${question.id}`
  try {
    await api(
      `/systems/${activeSystemId.value}/requirements/${selectedItem.value.id}/clarifications/${question.id}/knowledge`,
      { method: 'POST' },
    )
    notify('已创建知识草稿，可在知识库中审核发布')
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识草稿创建失败')
  } finally {
    busyAction.value = ''
  }
}

function knowledgeReferenceText(entry: KnowledgeItem) {
  const refs = entry.sourceReference?.references
  const references = Array.isArray(refs) ? refs.filter((value): value is string => typeof value === 'string') : []
  const requirementTitle = entry.sourceReference?.requirementTitle
  if (typeof requirementTitle === 'string' && !references.includes(`需求：${requirementTitle}`)) {
    references.unshift(`需求：${requirementTitle}`)
  }
  const revisionOf = entry.sourceReference?.revisionOf
  if (typeof revisionOf === 'string' && !references.includes(`修订自：${revisionOf}`)) {
    references.unshift(`修订自：${revisionOf}`)
  }
  return references.join('\n')
}

function startNewKnowledge() {
  editingKnowledgeId.value = null
  revisingKnowledgeId.value = null
  knowledgeTitle.value = ''
  knowledgeContent.value = ''
  knowledgeModule.value = '测试用例管理'
  knowledgeSourceReferences.value = ''
  knowledgeFormVisible.value = true
}

function startEditKnowledge(entry: KnowledgeItem) {
  editingKnowledgeId.value = entry.id
  revisingKnowledgeId.value = null
  knowledgeTitle.value = entry.title
  knowledgeContent.value = entry.content
  knowledgeModule.value = entry.module
  knowledgeSourceReferences.value = knowledgeReferenceText(entry)
  knowledgeFormVisible.value = true
}

function startReviseKnowledge(entry: KnowledgeItem) {
  editingKnowledgeId.value = null
  revisingKnowledgeId.value = entry.id
  knowledgeTitle.value = entry.title
  knowledgeContent.value = entry.content
  knowledgeModule.value = entry.module
  knowledgeSourceReferences.value = knowledgeReferenceText(entry)
  knowledgeFormVisible.value = true
}

function cancelKnowledgeForm() {
  knowledgeFormVisible.value = false
  editingKnowledgeId.value = null
  revisingKnowledgeId.value = null
}

async function saveKnowledgeDraft() {
  busyAction.value = 'save-knowledge'
  const body = JSON.stringify({
    title: knowledgeTitle.value.trim(),
    content: knowledgeContent.value.trim(),
    module: knowledgeModule.value.trim(),
    sourceReferences: profileLines(knowledgeSourceReferences.value),
  })
  try {
    if (editingKnowledgeId.value) {
      await api(`/systems/${activeSystemId.value}/knowledge/${editingKnowledgeId.value}`, {
        method: 'PUT',
        body,
      })
    } else if (revisingKnowledgeId.value) {
      await api(`/systems/${activeSystemId.value}/knowledge/${revisingKnowledgeId.value}/revise`, {
        method: 'POST',
        body,
      })
    } else {
      await api(`/systems/${activeSystemId.value}/knowledge`, {
        method: 'POST',
        body,
      })
    }
    knowledgeItems.value = await api(`/systems/${activeSystemId.value}/knowledge`)
    cancelKnowledgeForm()
    notify('知识草稿已保存；发布前不会参与 AI 检索')
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识保存失败')
  } finally {
    busyAction.value = ''
  }
}

async function publishKnowledge(entry: KnowledgeItem) {
  busyAction.value = `publish-${entry.id}`
  try {
    await api(`/systems/${activeSystemId.value}/knowledge/${entry.id}/publish`, { method: 'POST' })
    knowledgeItems.value = await api(`/systems/${activeSystemId.value}/knowledge`)
    await refreshDashboard()
    notify('知识已发布，可用于后续检索')
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识发布失败')
  } finally {
    busyAction.value = ''
  }
}

async function addMember() {
  if (!memberEmail.value.trim() || !memberName.value.trim() || memberPassword.value.length < 12) return
  busyAction.value = 'add-member'
  try {
    await api(`/systems/${activeSystemId.value}/members`, {
      method: 'POST',
      body: JSON.stringify({
        email: memberEmail.value.trim(),
        name: memberName.value.trim(),
        initialPassword: memberPassword.value,
        role: memberRole.value,
      }),
    })
    members.value = await api(`/systems/${activeSystemId.value}/members`)
    memberEmail.value = ''
    memberName.value = ''
    memberPassword.value = ''
    memberFormVisible.value = false
    notify('系统成员已保存，角色变更已审计')
  } catch (error) {
    notify(error instanceof Error ? error.message : '成员保存失败')
  } finally {
    busyAction.value = ''
  }
}

onMounted(() => {
  void initialize()
  window.addEventListener('keydown', onGlobalKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  stopDrawerResize()
})
</script>

<template>
  <div v-if="authLoading" class="boot-screen">
    <div class="boot-mark"><span></span><span></span><span></span></div>
    <p>正在建立安全会话…</p>
  </div>
  <LoginView
    v-else-if="!profile"
    :service-unavailable="serviceUnavailable"
    :busy="authBusy"
    :message="authMessage"
    @login="login"
  />
  <main v-else-if="profile && !profile.systems.length" class="no-access-screen">
    <div class="no-access-card">
      <div class="preview-icon"><ShieldCheck :size="21" /></div>
      <span class="preview-kicker">SYSTEM ACCESS REQUIRED</span>
      <h1>尚未分配系统权限</h1>
      <p>{{ authMessage || '请联系平台管理员加入试点系统后再访问工作台。' }}</p>
      <button class="secondary-button" @click="logout"><LogOut :size="15" />退出登录</button>
    </div>
  </main>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><span></span><span></span><span></span></div>
        <div class="brand-copy">
          <strong>测试知识工作台</strong>
          <span>AI TEST DESIGN</span>
        </div>
      </div>

      <div class="system-switcher-wrap">
        <button class="system-switcher" @click="showSystemMenu = !showSystemMenu">
          <span class="system-monogram">测</span>
          <span class="system-copy">
            <small>当前被测系统</small>
            <strong>{{ currentSystem?.name ?? '未分配系统' }}</strong>
          </span>
          <ChevronDown :size="15" class="muted-icon" />
        </button>
        <div v-if="showSystemMenu" class="system-options">
          <p>切换系统</p>
          <button
            v-for="system in profile.systems"
            :key="system.id"
            class="system-option"
            @click="switchSystem(system)"
          >
            <span class="system-option-name">{{ system.name }}</span>
            <span class="system-option-role">{{ roleLabels[system.role] }}</span>
            <Check v-if="system.id === activeSystemId" :size="14" />
          </button>
        </div>
      </div>

      <div class="nav-section-label">工作空间</div>
      <nav class="primary-nav" aria-label="主导航">
        <button
          v-for="item in visibleNavItems"
          :key="item.label"
          class="nav-item"
          :class="{ active: activeNav === item.label }"
          @click="selectNav(item.label)"
        >
          <component :is="item.icon" :size="17" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <span v-if="item.label === '需求与澄清' && pendingClarificationCount" class="nav-badge">{{ pendingClarificationCount }}</span>
        </button>
      </nav>

      <div class="nav-section-label management-label">治理</div>
      <nav class="primary-nav" aria-label="治理导航">
        <button
          v-for="item in visibleManagementItems"
          :key="item.label"
          class="nav-item"
          :class="{ active: activeNav === item.label }"
          @click="selectNav(item.label)"
        >
          <component :is="item.icon" :size="17" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <div class="sidebar-status">
          <span class="status-dot"></span>
          <span>受控工作区</span>
          <span class="status-separator">·</span>
          <span>系统隔离</span>
        </div>
        <button class="nav-item help-item" @click="notice = '问题请联系当前系统负责人'">
          <CircleHelp :size="17" :stroke-width="1.8" />
          <span>帮助与反馈</span>
          <ArrowUpRight :size="14" class="help-arrow" />
        </button>
        <div class="workspace-user">
          <div class="user-avatar">{{ profile.name.slice(0, 1) }}</div>
          <div class="user-copy">
            <strong>{{ profile.name }}</strong>
            <span>{{ roleLabel }}</span>
          </div>
          <button
            class="icon-button user-menu-button"
            aria-label="账户选项"
            @click="showAccountMenu = !showAccountMenu"
          >
            <MoreHorizontal :size="18" />
          </button>
          <div v-if="showAccountMenu" class="role-menu account-menu">
            <p>当前账户</p>
            <div class="account-email">{{ profile.email }}</div>
            <div class="account-role"><ShieldCheck :size="14" />{{ roleLabel }}</div>
            <button class="logout-button" @click="logout"><LogOut :size="14" />退出登录</button>
          </div>
        </div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="breadcrumb">
          <span>工作空间</span>
          <ChevronRight :size="14" />
          <strong>{{ activeNav }}</strong>
        </div>
        <div class="topbar-actions">
          <span class="demo-pill"><span></span>已认证会话</span>
          <button
            class="icon-button notification-button"
            aria-label="通知"
            @click="showNotifications = !showNotifications"
          >
            <Bell :size="18" :stroke-width="1.8" />
            <span class="notification-dot"></span>
          </button>
          <div v-if="showNotifications" class="notification-popover">
            <div class="popover-heading">
              <strong>通知</strong>
              <button @click="showNotifications = false"><X :size="16" /></button>
            </div>
            <p class="empty-notice">目前没有新的通知</p>
            <small>关键操作与内容变更均写入审计记录。</small>
          </div>
          <div class="topbar-divider"></div>
          <button class="help-link" @click="notice = '更多帮助内容将在后续版本提供'">
            <CircleHelp :size="16" />
            <span>帮助中心</span>
          </button>
        </div>
      </header>

      <div class="page-content">
        <template v-if="isDashboard">
          <section class="page-heading">
            <div>
              <div class="eyebrow"><span class="eyebrow-line"></span>测试管理平台 / 试点空间</div>
              <h1>{{ activeNav }}<span class="heading-period">.</span></h1>
              <p class="page-intro">把需求、系统知识与测试设计串在一起。先确认事实，再生成场景。</p>
            </div>
            <button v-if="canEdit" class="primary-button" @click="showCreateModal = true">
              <Plus :size="17" />
              新建需求
            </button>
          </section>

          <section class="system-banner">
            <div class="banner-icon"><Command :size="19" :stroke-width="1.8" /></div>
            <div class="banner-main">
              <div class="banner-title-row">
                <span class="banner-kicker">试点系统</span>
                <span class="banner-status">
                  <span></span>{{ currentSystem?.type === 'web' ? 'Web 试点' : currentSystem?.type }}
                  · {{ systemProfile?.profileStatus === 'confirmed' ? '画像已确认' : '画像待完善' }}
                </span>
              </div>
              <h2>{{ currentSystem?.name }}</h2>
              <p>聚焦测试用例管理流程 · 系统级权限已启用</p>
            </div>
            <div class="banner-progress">
              <div class="progress-label">
                <span>系统画像完整度</span>
                  <strong>{{ systemProfile?.profileStatus === 'confirmed' ? '已确认' : '待完善' }}</strong>
                </div>
                <div class="progress-track"><span :class="systemProfile?.profileStatus === 'confirmed' ? 'progress-complete' : 'progress-unknown'"></span></div>
              <button @click="selectNav('系统画像')">继续完善画像 <ArrowRight :size="14" /></button>
            </div>
            <div class="banner-watermark">01</div>
          </section>

          <section class="overview-grid" aria-label="工作概览">
            <article class="overview-card">
              <div class="overview-top">
                <span>待澄清问题</span>
                <div class="metric-icon question-icon"><FileQuestion :size="17" /></div>
              </div>
              <div class="metric-row">
                <strong>{{ String(pendingClarificationCount).padStart(2, '0') }}</strong>
                <span class="metric-note">需要业务确认</span>
              </div>
              <div class="metric-foot">
                <span class="metric-foot-muted">等待确认后才能生成预期</span>
                <button @click="activeFilter = '待澄清'">查看队列 <ArrowRight :size="13" /></button>
              </div>
            </article>
            <article class="overview-card">
              <div class="overview-top">
                <span>待审核场景</span>
                <div class="metric-icon review-icon"><FileCheck2 :size="17" /></div>
              </div>
              <div class="metric-row">
                <strong>{{ String(pendingReviewCount).padStart(2, '0') }}</strong>
                <span class="metric-note">等待测试人员审核</span>
              </div>
              <div class="metric-foot">
                <span class="metric-foot-muted">需人工确认后方可发布</span>
                <button @click="selectNav('测试设计')">查看场景 <ArrowRight :size="13" /></button>
              </div>
            </article>
            <article class="overview-card knowledge-card">
              <div class="overview-top">
                <span>已发布知识</span>
                <div class="metric-icon knowledge-icon"><BookOpen :size="17" /></div>
              </div>
              <div class="metric-row">
                <strong>{{ String(confirmedCount).padStart(2, '0') }}</strong>
                <span class="metric-note">条 · 当前系统可检索</span>
              </div>
              <div class="metric-foot">
                <span class="metric-foot-muted">仅检索已发布条目</span>
                <button @click="selectNav('知识库')">查看知识库 <ArrowRight :size="13" /></button>
              </div>
            </article>
          </section>

          <section class="work-section">
            <div class="section-header">
              <div>
                <div class="section-overline">NEXT ACTIONS</div>
                <h2>需求与澄清 <span class="section-count">{{ queue.length }}</span></h2>
              </div>
              <button class="text-button" @click="selectNav('需求与澄清')">
                查看全部需求 <ArrowRight :size="15" />
              </button>
            </div>

            <div class="queue-toolbar">
              <div class="filter-tabs" role="tablist" aria-label="筛选需求">
                <button
                  v-for="filter in ['全部事项', '待澄清', '待审核']"
                  :key="filter"
                  :class="{ selected: activeFilter === filter }"
                  role="tab"
                  :aria-selected="activeFilter === filter"
                  @click="activeFilter = filter"
                >
                  {{ filter }}
                  <span v-if="filter === '全部事项'">{{ String(queue.length).padStart(2, '0') }}</span>
                </button>
              </div>
              <div class="toolbar-right">
                <label class="search-field">
                  <Search :size="15" />
                  <input ref="searchInput" v-model="query" placeholder="搜索需求…" aria-label="搜索需求" />
                  <kbd>⌘ / Ctrl K</kbd>
                </label>
                <label class="module-filter">
                  <Filter :size="14" />
                  <select v-model="selectedModule" aria-label="按模块筛选">
                    <option v-for="module in moduleOptions" :key="module" :value="module">{{ module }}</option>
                  </select>
                </label>
                <button class="icon-button sort-button" :aria-label="sortNewestFirst ? '按更新时间倒序' : '按更新时间正序'" @click="sortNewestFirst = !sortNewestFirst">
                  <ArrowDown :size="15" :class="{ 'sort-reversed': !sortNewestFirst }" />
                </button>
              </div>
            </div>

            <div class="queue-table-wrap">
              <table class="queue-table">
                <thead>
                  <tr>
                    <th class="req-column">需求 / 来源</th>
                    <th>所属模块</th>
                    <th>状态</th>
                    <th>负责人</th>
                    <th>最近更新</th>
                    <th class="action-column"><span class="sr-only">操作</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in filteredQueue"
                    :key="item.id"
                    class="queue-row"
                    @click="openItem(item)"
                  >
                    <td class="req-cell">
                      <div class="req-title-line">
                        <strong>{{ item.title }}</strong>
                        <span class="req-id">{{ item.id }}</span>
                      </div>
                      <div class="source-line"><Files :size="13" />{{ item.source }}</div>
                    </td>
                    <td><span class="module-tag">{{ item.module }}</span></td>
                    <td><span class="status-pill" :class="stageClass(item.stage)"><i></i>{{ item.stage }}</span></td>
                    <td>
                      <div class="owner-cell">
                        <span class="owner-avatar" :class="`avatar-${item.color}`">{{ item.initials }}</span>
                        <span>{{ item.owner }}</span>
                      </div>
                    </td>
                    <td class="updated-cell">{{ item.updated }}</td>
                    <td class="row-action"><ArrowRight :size="15" /></td>
                  </tr>
                  <tr v-if="filteredQueue.length === 0">
                    <td colspan="6" class="empty-row">
                      <Search :size="18" />
                      没有找到匹配的需求
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="table-footer">
                <span>显示 {{ filteredQueue.length }} 项 <span class="footer-dot">·</span> 当前系统权限范围内</span>
                <div class="pagination">
                  <button class="icon-button page-arrow" aria-label="上一页" disabled><ChevronLeft :size="15" /></button>
                  <span class="page-number">1</span>
                  <button class="icon-button page-arrow" aria-label="下一页" disabled><ChevronRight :size="15" /></button>
                </div>
              </div>
            </div>
          </section>

          <section class="bottom-grid">
            <article class="principle-card">
              <div class="principle-label"><Sparkles :size="15" />设计原则</div>
              <h3>推测不等于事实。</h3>
              <p>AI 发现信息缺口、给出候选问题；业务与系统负责人确认后，才进入正式知识与测试预期。</p>
              <div class="principle-foot"><LockKeyhole :size="14" />权限过滤贯穿检索、生成与审核</div>
            </article>
            <article class="activity-card">
              <div class="activity-heading">
                <div>
                  <div class="section-overline">RECENT ACTIVITY</div>
                  <h3>最近动态</h3>
                </div>
                <button
                  v-if="['admin', 'system_owner', 'auditor'].includes(currentRole ?? '')"
                  class="icon-button"
                  aria-label="查看审计动态"
                  @click="selectNav('审计记录')"
                ><MoreHorizontal :size="18" /></button>
              </div>
              <div v-for="item in queue.slice(0, 2)" :key="item.id" class="activity-line">
                <span class="activity-marker" :class="item.stage === '待澄清' ? 'marker-amber' : 'marker-green'">
                  <Clock3 v-if="item.stage === '待澄清'" :size="13" />
                  <CheckCheck v-else :size="13" />
                </span>
                <div><strong>{{ item.title }}</strong><span>{{ item.stage }} · {{ item.updated }}</span></div>
              </div>
              <div v-if="!queue.length" class="activity-empty">暂无动态。新建需求后，这里会显示最近进展。</div>
            </article>
          </section>

          <footer class="page-footer">
            <span>测试知识工作台 <span class="footer-dot">·</span> {{ currentSystem?.name }}</span>
            <span><Activity :size="13" /> 操作受系统权限控制</span>
          </footer>
        </template>

        <template v-else>
          <section class="page-heading subpage-heading">
            <div>
              <div class="eyebrow"><span class="eyebrow-line"></span>测试管理平台 / 试点空间</div>
              <h1>{{ activeNav }}<span class="heading-period">.</span></h1>
              <p class="page-intro">{{ navDescription[activeNav] || '工作空间与平台设置。' }}</p>
            </div>
            <button class="secondary-button" @click="selectNav('工作台')">
              <ChevronLeft :size="16" />返回工作台
            </button>
          </section>
          <section v-if="activeNav === '审计记录'" class="data-panel">
            <div class="data-panel-heading">
              <div><span class="preview-kicker">IMMUTABLE ACTIVITY LOG</span><h2>操作审计</h2></div>
              <span class="secure-label"><LockKeyhole :size="14" />仅限授权角色查看</span>
            </div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead><tr><th>操作</th><th>执行人</th><th>对象</th><th>时间</th></tr></thead>
                <tbody>
                  <tr v-for="event in auditItems" :key="event.id">
                    <td><strong>{{ auditAction(event.action) }}</strong><small>{{ auditEntity(event.entityType) }}</small></td>
                    <td>{{ event.actor?.name ?? '系统' }}</td>
                    <td class="mono-cell">{{ event.entityId ?? '—' }}</td>
                    <td>{{ formatDate(event.createdAt) }}</td>
                  </tr>
                  <tr v-if="!auditItems.length"><td colspan="4" class="empty-data">暂无审计记录</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section v-else-if="activeNav === '权限管理'" class="data-panel">
            <div class="data-panel-heading">
              <div><span class="preview-kicker">SYSTEM-SCOPED ACCESS</span><h2>系统成员与角色</h2></div>
              <button class="primary-button" @click="memberFormVisible = !memberFormVisible">
                <Plus :size="15" />添加成员
              </button>
            </div>
            <form v-if="memberFormVisible" class="member-form" @submit.prevent="addMember">
              <label>姓名<input v-model="memberName" required maxlength="100" /></label>
              <label>工作邮箱<input v-model="memberEmail" type="email" required maxlength="254" /></label>
              <label>初始密码<input v-model="memberPassword" type="password" required minlength="12" autocomplete="new-password" /></label>
              <label>系统角色
                <select v-model="memberRole">
                  <option value="tester">测试人员</option>
                  <option v-if="currentRole === 'admin'" value="system_owner">系统负责人</option>
                  <option v-if="currentRole === 'admin'" value="auditor">只读审计员</option>
                  <option v-if="currentRole === 'admin'" value="admin">管理员</option>
                </select>
              </label>
              <p class="member-form-note"><LockKeyhole :size="14" />密码至少 12 位；角色授权会写入审计记录。</p>
              <div class="member-form-actions">
                <button type="button" class="secondary-button" @click="memberFormVisible = false">取消</button>
                <button type="submit" class="primary-button" :disabled="busyAction === 'add-member'">保存成员</button>
              </div>
            </form>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead><tr><th>成员</th><th>系统角色</th><th>状态</th><th>加入时间</th></tr></thead>
                <tbody>
                  <tr v-for="member in members" :key="member.id">
                    <td><strong>{{ member.user.name }}</strong><small>{{ member.user.email }}</small></td>
                    <td><span class="role-chip">{{ roleLabels[member.role] }}</span></td>
                    <td>{{ member.user.active ? '有效' : '已停用' }}</td>
                    <td>{{ formatDate(member.createdAt) }}</td>
                  </tr>
                  <tr v-if="!members.length"><td colspan="4" class="empty-data">暂无成员</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section v-else-if="activeNav === '知识库'" class="data-panel">
            <div class="data-panel-heading">
              <div><span class="preview-kicker">REVIEWED SYSTEM KNOWLEDGE</span><h2>知识条目</h2></div>
              <div class="knowledge-heading-actions">
                <span class="secure-label"><BookOpen :size="14" />仅已发布条目参与 AI 检索</span>
                <button v-if="canEdit" class="primary-button" @click="startNewKnowledge">
                  <Plus :size="15" />新建知识
                </button>
              </div>
            </div>
            <form v-if="knowledgeFormVisible" class="knowledge-form" @submit.prevent="saveKnowledgeDraft">
              <div class="knowledge-form-heading">
                <div>
                  <span class="preview-kicker">{{ revisingKnowledgeId ? 'REVISION DRAFT' : editingKnowledgeId ? 'EDIT DRAFT' : 'NEW KNOWLEDGE' }}</span>
                  <h3>{{ revisingKnowledgeId ? '创建修订草稿' : editingKnowledgeId ? '编辑知识草稿' : '新建知识草稿' }}</h3>
                </div>
                <button type="button" class="icon-button" aria-label="关闭知识表单" @click="cancelKnowledgeForm"><X :size="17" /></button>
              </div>
              <div class="knowledge-form-grid">
                <label class="profile-field">
                  <span>知识标题</span>
                  <input v-model="knowledgeTitle" required minlength="3" maxlength="240" placeholder="描述这条知识要解决的问题或规则" />
                </label>
                <label class="profile-field">
                  <span>所属模块</span>
                  <input v-model="knowledgeModule" required maxlength="120" placeholder="如：测试用例管理 · 审核" />
                </label>
                <label class="profile-field profile-field-wide">
                  <span>已确认的规则或经验</span>
                  <textarea v-model="knowledgeContent" required minlength="3" maxlength="20000" rows="5" placeholder="填写经业务/系统负责人确认的事实；不要把 AI 推测直接写成知识。"></textarea>
                </label>
                <label class="profile-field profile-field-wide">
                  <span>来源依据 <small>每行一项，记录需求编号、文档名、版本或确认记录</small></span>
                  <textarea v-model="knowledgeSourceReferences" maxlength="10000" rows="3" placeholder="需求 XQ2026-0295&#10;系统负责人确认，2026-11-27"></textarea>
                </label>
              </div>
              <div class="profile-form-footer">
                <span><LockKeyhole :size="14" />保存后仍为草稿；仅负责人发布后会用于 AI 检索。</span>
                <div>
                  <button type="button" class="secondary-button" @click="cancelKnowledgeForm">取消</button>
                  <button type="submit" class="primary-button" :disabled="busyAction === 'save-knowledge'">
                    <Check :size="14" />{{ busyAction === 'save-knowledge' ? '保存中…' : '保存草稿' }}
                  </button>
                </div>
              </div>
            </form>
            <div class="knowledge-list">
              <article v-for="entry in knowledgeItems" :key="entry.id" class="knowledge-row">
                <div
                  class="knowledge-status"
                  :class="entry.status === 'published' ? 'published' : entry.status === 'superseded' ? 'superseded' : 'draft'"
                >
                  {{ entry.status === 'published' ? '已发布' : entry.status === 'superseded' ? '已被修订' : '草稿' }}
                </div>
                <div class="knowledge-copy">
                  <h3>{{ entry.title }}</h3>
                  <p>{{ entry.content }}</p>
                  <small>{{ entry.module }} · {{ entry.creator?.name ?? '—' }} · {{ formatDate(entry.updatedAt) }}</small>
                  <small v-if="knowledgeReferenceText(entry)" class="knowledge-references">来源：{{ knowledgeReferenceText(entry) }}</small>
                </div>
                <button
                  v-if="entry.status === 'draft' && canEdit"
                  class="secondary-button knowledge-action"
                  @click="startEditKnowledge(entry)"
                >编辑草稿</button>
                <button
                  v-if="entry.status === 'published' && canEdit"
                  class="secondary-button knowledge-action"
                  @click="startReviseKnowledge(entry)"
                >创建修订</button>
                <button
                  v-if="entry.status === 'draft' && canApprove"
                  class="secondary-button"
                  :disabled="busyAction === `publish-${entry.id}`"
                  @click="publishKnowledge(entry)"
                >审核并发布</button>
              </article>
              <div v-if="!knowledgeItems.length" class="empty-data">暂无知识条目。可手动新建草稿，也可从已确认的澄清答案生成知识草稿。</div>
            </div>
          </section>
          <section v-else-if="activeNav === '测试设计'" class="data-panel">
            <div class="data-panel-heading">
              <div><span class="preview-kicker">HUMAN-REVIEWED TEST DESIGN</span><h2>测试场景</h2></div>
              <span class="secure-label"><CheckCheck :size="14" />AI 产物需经人工审核</span>
            </div>
            <div class="scenario-list">
              <article v-for="scenario in scenarios" :key="scenario.id" class="scenario-row">
                <div class="scenario-heading">
                  <div><h3>{{ scenario.title }}</h3><small>{{ scenario.requirementTitle }}</small></div>
                  <span class="status-pill" :class="scenario.status === 'approved' ? 'status-confirmed' : 'status-review'"><i></i>{{ scenario.status === 'approved' ? '已审核' : '待审核' }}</span>
                </div>
                <p>{{ scenario.objective }}</p>
                <ol><li v-for="(step, index) in scenario.steps" :key="index">{{ step }}</li></ol>
                <div class="scenario-expected"><strong>预期结果</strong><span>{{ scenario.expectedResult || '未提供有来源依据的预期' }}</span></div>
                <div v-if="scenario.citations.length" class="citation-list">
                  <span v-for="citation in scenario.citations" :key="citation.quote">依据：{{ citation.quote }}</span>
                </div>
                <button
                  v-if="scenario.status !== 'approved' && canEdit"
                  class="secondary-button scenario-approve"
                  :disabled="busyAction === `approve-${scenario.id}`"
                  @click="approveScenario(scenario)"
                ><Check :size="14" />{{ busyAction === `approve-${scenario.id}` ? '审核中…' : '审核通过' }}</button>
              </article>
              <div v-if="!scenarios.length" class="empty-data">暂无测试场景。先完成需求澄清，再从需求详情生成候选场景。</div>
            </div>
          </section>
          <section v-else-if="activeNav === '系统画像'" class="data-panel profile-panel">
            <div v-if="!systemProfile || !profileDraft" class="profile-loading">正在读取当前系统画像…</div>
            <template v-else>
              <div class="data-panel-heading">
                <div>
                  <span class="preview-kicker">SYSTEM PROFILE / {{ systemProfile.type.toUpperCase() }}</span>
                  <h2>系统画像</h2>
                </div>
                <div class="profile-heading-actions">
                  <span class="status-pill" :class="systemProfile.profileStatus === 'confirmed' ? 'status-confirmed' : 'status-question'">
                    <i></i>{{ systemProfile.profileStatus === 'confirmed' ? '已确认' : '草稿 / 待确认' }}
                  </span>
                  <button
                    v-if="canManageMembers && !profileEditing"
                    class="secondary-button"
                    @click="profileEditing = true"
                  ><Settings2 :size="14" />编辑画像</button>
                  <button
                    v-if="canManageMembers && !profileEditing && systemProfile.profileStatus !== 'confirmed'"
                    class="primary-button"
                    :disabled="!canConfirmProfile || busyAction === 'confirm-profile'"
                    @click="confirmSystemProfile"
                  ><Check :size="14" />{{ busyAction === 'confirm-profile' ? '确认中…' : '确认并发布' }}</button>
                </div>
              </div>

              <form v-if="profileEditing" class="profile-form" @submit.prevent="saveSystemProfile">
                <div class="profile-form-grid">
                  <label class="profile-field">
                    <span>系统名称 <b>必填</b></span>
                    <input v-model="profileDraft.name" maxlength="160" required />
                  </label>
                  <label class="profile-field">
                    <span>系统类型</span>
                    <select v-model="profileDraft.type">
                      <option value="web">Web / 移动端</option>
                      <option value="api">API / 微服务</option>
                      <option value="batch">批处理</option>
                      <option value="data">数据平台</option>
                      <option value="messaging">消息驱动</option>
                      <option value="hybrid">混合类型</option>
                    </select>
                  </label>
                  <label class="profile-field profile-field-wide">
                    <span>系统简介 <b>确认画像必填</b></span>
                    <textarea v-model="profileDraft.description" rows="3" maxlength="5000" placeholder="系统用途、业务边界和主要用户"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>业务归属</span>
                    <input v-model="profileDraft.businessLine" maxlength="160" placeholder="如：零售银行 / 测试管理" />
                  </label>
                  <label class="profile-field">
                    <span>系统负责人</span>
                    <input v-model="profileDraft.ownerName" maxlength="160" placeholder="负责人姓名或团队" />
                  </label>
                  <label class="profile-field">
                    <span>适用版本</span>
                    <input v-model="profileDraft.version" maxlength="80" placeholder="如：2026.11 / SIT-3.2" />
                  </label>
                  <label class="profile-field">
                    <span>系统别名 <small>每行一项</small></span>
                    <textarea v-model="profileDraft.aliases" rows="3" maxlength="4000" placeholder="平台简称"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>功能模块 <b>确认画像必填</b><small>每行一项</small></span>
                    <textarea v-model="profileDraft.modules" rows="4" maxlength="12000" placeholder="测试用例管理&#10;测试计划"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>用户角色 <small>每行一项</small></span>
                    <textarea v-model="profileDraft.roles" rows="4" maxlength="6000" placeholder="项目管理员&#10;测试人员&#10;审核人"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>核心业务流程 <b>确认画像必填</b><small>每行一条流程</small></span>
                    <textarea v-model="profileDraft.workflows" rows="5" maxlength="20000" placeholder="创建测试项目 → 维护测试用例 → 提交审核 → 加入测试集"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>上下游依赖 <small>每行一项</small></span>
                    <textarea v-model="profileDraft.dependencies" rows="4" maxlength="12000" placeholder="需求管理系统&#10;统一身份认证"></textarea>
                  </label>
                  <label class="profile-field">
                    <span>测试环境 <small>每行一项</small></span>
                    <textarea v-model="profileDraft.testEnvironments" rows="3" maxlength="6000" placeholder="SIT / UAT"></textarea>
                  </label>
                  <label class="profile-field profile-field-wide">
                    <span>安全与测试约束</span>
                    <textarea v-model="profileDraft.securityNotes" rows="3" maxlength="5000" placeholder="脱敏规则、禁止操作、测试数据限制等"></textarea>
                  </label>
                  <label class="profile-field profile-field-wide">
                    <span>来源依据 <small>每行一项，记录文档名、版本或访谈来源</small></span>
                    <textarea v-model="profileDraft.sourceReferences" rows="3" maxlength="10000" placeholder="测试管理平台用户手册 v2.1&#10;系统负责人访谈，2026-11-27"></textarea>
                  </label>
                </div>
                <div class="profile-form-footer">
                  <span><LockKeyhole :size="14" />保存为草稿；确认后才会作为 AI 系统上下文使用。</span>
                  <div>
                    <button type="button" class="secondary-button" @click="profileDraft = toProfileDraft(systemProfile); profileEditing = false">取消</button>
                    <button type="submit" class="primary-button" :disabled="busyAction === 'save-profile'">
                      <Check :size="14" />{{ busyAction === 'save-profile' ? '保存中…' : '保存草稿' }}
                    </button>
                  </div>
                </div>
              </form>

              <div v-else class="profile-view">
                <section class="profile-summary">
                  <div class="profile-monogram"><Command :size="20" /></div>
                  <div>
                    <div class="profile-summary-kicker">当前被测系统</div>
                    <h3>{{ systemProfile.name }}</h3>
                    <p>{{ systemProfile.description || '尚未填写系统简介。由系统负责人维护用途、业务边界和主要用户。' }}</p>
                    <div v-if="systemProfile.profile.aliases?.length" class="profile-aliases">
                      <span v-for="alias in systemProfile.profile.aliases" :key="alias">{{ alias }}</span>
                    </div>
                  </div>
                </section>
                <div class="profile-facts">
                  <div><span>业务归属</span><strong>{{ systemProfile.profile.businessLine || '未填写' }}</strong></div>
                  <div><span>系统负责人</span><strong>{{ systemProfile.profile.ownerName || '未填写' }}</strong></div>
                  <div><span>适用版本</span><strong>{{ systemProfile.profile.version || '未填写' }}</strong></div>
                  <div><span>画像状态</span><strong>{{ systemProfile.profileStatus === 'confirmed' ? `由 ${systemProfile.profileConfirmedBy?.name || '负责人'} 确认` : '草稿 / 待确认' }}</strong></div>
                </div>
                <div class="profile-sections">
                  <article v-for="section in profileSections" :key="section.title" class="profile-section">
                    <h3>{{ section.title }} <span>{{ section.values.length }}</span></h3>
                    <ul v-if="section.values.length">
                      <li v-for="value in section.values" :key="value">{{ value }}</li>
                    </ul>
                    <p v-else>尚未维护</p>
                  </article>
                </div>
                <section class="profile-security">
                  <h3><LockKeyhole :size="15" />安全与测试约束</h3>
                  <p>{{ systemProfile.profile.securityNotes || '尚未记录安全、脱敏或测试数据限制。' }}</p>
                  <small v-if="systemProfile.profileConfirmedAt">最近确认：{{ formatDate(systemProfile.profileConfirmedAt) }}</small>
                </section>
                <div v-if="!canManageMembers" class="profile-readonly-note">
                  当前角色为只读；请联系系统负责人或管理员维护、确认系统画像。
                </div>
              </div>
            </template>
          </section>
          <section v-else class="module-preview">
            <div class="preview-icon"><Settings2 :size="20" /></div>
            <div class="preview-copy">
              <span class="preview-kicker">WORKSPACE</span>
              <h2>{{ activeNav }}</h2>
              <p>该模块正在建设中。</p>
            </div>
          </section>
        </template>

        <div v-if="notice" class="toast" role="status">{{ notice }}</div>
      </div>
    </main>

    <Transition name="drawer">
      <div v-if="selectedItem" class="drawer-backdrop" @click.self="selectedItem = null">
        <aside
          class="detail-drawer"
          aria-label="需求详情"
          :style="{ '--drawer-width': `${drawerWidth}px` }"
        >
          <div
            class="drawer-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整需求详情面板宽度"
            :aria-valuemin="minDrawerWidth()"
            :aria-valuemax="maxDrawerWidth()"
            :aria-valuenow="drawerWidth"
            :aria-valuetext="`宽度 ${drawerWidth} 像素；向左拖动可加宽`"
            tabindex="0"
            @pointerdown="startDrawerResize"
            @keydown="resizeDrawerByKey"
          ><span class="drawer-resize-grip"></span></div>
          <div class="drawer-topline">
            <span class="drawer-label"><FileQuestion :size="15" />需求详情</span>
            <button class="icon-button" aria-label="关闭详情" @click="selectedItem = null"><X :size="18" /></button>
          </div>
          <div class="drawer-content">
            <div v-if="!selectedDetail" class="detail-loading">正在读取需求与权限范围内的知识…</div>
            <template v-else>
              <div class="drawer-id">{{ selectedDetail.id }} <span>·</span> {{ selectedDetail.module }}</div>
              <h2>{{ selectedDetail.title }}</h2>
              <span class="status-pill drawer-status" :class="stageClass(displayStage(selectedDetail.status))"><i></i>{{ displayStage(selectedDetail.status) }}</span>

              <div class="drawer-divider"></div>
              <div class="detail-section">
                <h3>需求来源</h3>
                <div class="source-card"><Files :size="16" /><span>{{ selectedDetail.sourceName || '未命名材料' }}</span></div>
                <details class="source-text">
                  <summary>查看需求原文</summary>
                  <p>{{ selectedDetail.sourceText || '未录入需求原文。请补充材料文本后再发起 AI 分析。' }}</p>
                </details>
              </div>
              <div v-if="selectedDetail.aiSummary?.summary" class="detail-section">
                <h3><Sparkles :size="14" />需求理解 <span class="ai-generated-label">AI 生成 · 待审核</span></h3>
                <p class="summary-copy">{{ selectedDetail.aiSummary.summary }}</p>
              </div>
              <div v-if="selectedDetail.aiSummary?.sourceFacts?.length" class="detail-section">
                <h3>材料明示信息 <span class="ai-generated-label">AI 抽取，待核查</span></h3>
                <div v-for="(fact, index) in selectedDetail.aiSummary.sourceFacts" :key="index" class="source-fact">
                  <p>{{ fact.text }}</p><blockquote>“{{ fact.quote }}”</blockquote>
                </div>
              </div>
              <div class="detail-section">
                <h3>
                  待确认问题
                  <span class="section-count">{{ selectedDetail.clarifications.filter((question) => question.status !== 'confirmed').length }}</span>
                  <button v-if="canEdit" class="inline-add" @click="questionFormVisible = !questionFormVisible">
                    <Plus :size="13" />手动添加
                  </button>
                </h3>
                <form v-if="questionFormVisible" class="manual-question-form" @submit.prevent="addClarification">
                  <textarea v-model="newQuestion" rows="2" maxlength="2000" required placeholder="写下需要业务或系统负责人确认的问题"></textarea>
                  <input v-model="newQuestionRationale" maxlength="2000" placeholder="影响说明（可选）" />
                  <label><input v-model="newQuestionBlocks" type="checkbox" />影响测试预期，确认前阻止生成场景</label>
                  <div class="question-actions">
                    <button type="button" class="secondary-button" @click="questionFormVisible = false">取消</button>
                    <button type="submit" class="primary-button" :disabled="busyAction === 'add-clarification'">保存问题</button>
                  </div>
                </form>
                <div v-for="(question, index) in selectedDetail.clarifications" :key="question.id" class="clarification-card">
                  <div class="question-block">
                    <span class="question-index">Q{{ index + 1 }}</span>
                    <div>
                      <p>{{ question.question }}</p>
                      <small>{{ question.rationale || '建议由业务或系统负责人确认' }}</small>
                    </div>
                  </div>
                  <span class="status-pill" :class="question.status === 'confirmed' ? 'status-confirmed' : question.status === 'answer_proposed' ? 'status-review' : 'status-question'">
                    <i></i>{{ question.status === 'confirmed' ? '已确认' : question.status === 'answer_proposed' ? '待负责人确认' : '待澄清' }}
                  </span>
                  <div v-if="question.status === 'confirmed'" class="confirmed-answer">
                    <Check :size="15" />
                    <div><p>{{ question.answer }}</p><small>由 {{ question.confirmedBy?.name || '系统负责人' }} 确认 · {{ formatDate(question.confirmedAt || undefined) }}</small></div>
                  </div>
                  <template v-else>
                    <textarea
                      v-if="canEdit"
                      v-model="answerDrafts[question.id]"
                      class="answer-input"
                      rows="3"
                      placeholder="记录业务或系统负责人确认的规则；未确认时不要填写推测。"
                    ></textarea>
                    <p v-else class="detail-caption">当前角色只读；请由测试人员或系统负责人补充答案。</p>
                    <div v-if="canEdit" class="question-actions">
                      <button
                        class="secondary-button"
                        :disabled="busyAction === `answer-${question.id}`"
                        @click="saveAnswer(question)"
                      >保存答案</button>
                      <button
                        v-if="canApprove && question.status === 'answer_proposed'"
                        class="primary-button"
                        :disabled="busyAction === `confirm-${question.id}`"
                        @click="confirmAnswer(question)"
                      ><Check :size="14" />负责人确认</button>
                    </div>
                  </template>
                  <button
                    v-if="question.status === 'confirmed' && canEdit"
                    class="knowledge-draft-button"
                    :disabled="busyAction === `knowledge-${question.id}`"
                    @click="createKnowledge(question)"
                  ><BookOpen :size="13" />转为知识草稿</button>
                </div>
                <div v-if="!selectedDetail.clarifications.length" class="fact-empty">
                  <CircleHelp :size="15" />尚无澄清问题。请先基于来源材料运行 AI 分析。
                </div>
              </div>
              <div v-if="selectedDetail.aiSummary?.assumptions?.length" class="detail-section">
                <h3>临时假设 <span class="ai-generated-label">禁止作为预期</span></h3>
                <div v-for="(assumption, index) in selectedDetail.aiSummary.assumptions" :key="index" class="assumption-block">
                  <span>待确认</span><p>{{ assumption }}</p>
                </div>
              </div>
              <div v-if="selectedDetail.scenarios.length" class="detail-section">
                <h3>测试场景 <span class="section-count">{{ selectedDetail.scenarios.length }}</span></h3>
                <article v-for="scenario in selectedDetail.scenarios" :key="scenario.id" class="drawer-scenario">
                  <div class="drawer-scenario-title">
                    <strong>{{ scenario.title }}</strong>
                    <span class="status-pill" :class="scenario.status === 'approved' ? 'status-confirmed' : 'status-review'"><i></i>{{ scenario.status === 'approved' ? '已审核' : '待审核' }}</span>
                  </div>
                  <p>{{ scenario.objective }}</p>
                  <ol><li v-for="(step, index) in scenario.steps" :key="index">{{ step }}</li></ol>
                  <div class="scenario-expected"><strong>预期</strong><span>{{ scenario.expectedResult || '未提供' }}</span></div>
                  <div v-for="citation in scenario.citations" :key="citation.quote" class="drawer-citation">依据：{{ citation.quote }}</div>
                  <button v-if="scenario.status !== 'approved' && canEdit" class="knowledge-draft-button" :disabled="busyAction === `approve-${scenario.id}`" @click="approveScenario(scenario)">
                    <Check :size="13" />{{ busyAction === `approve-${scenario.id}` ? '审核中…' : '审核通过' }}
                  </button>
                </article>
              </div>
              <div class="detail-section provenance">
                <span>负责人 <strong>{{ selectedItem.owner }}</strong></span>
                <span>最近更新 <strong>{{ selectedItem.updated }}</strong></span>
              </div>
            </template>
          </div>
          <div class="drawer-actions">
            <button
              v-if="canEdit"
              class="secondary-button"
              :disabled="!selectedDetail?.sourceText || busyAction === 'analyze'"
              @click="analyzeRequirement"
            ><Sparkles :size="14" />{{ busyAction === 'analyze' ? '分析中…' : 'AI 分析需求' }}</button>
            <button
              v-if="canEdit && selectedDetail?.clarifications.every((question) => !question.blocksDesign || question.status === 'confirmed')"
              class="primary-button"
              :disabled="busyAction === 'generate-scenarios'"
              @click="generateScenarios"
            ><ListChecks :size="15" />{{ busyAction === 'generate-scenarios' ? '生成中…' : '生成测试场景' }}</button>
          </div>
        </aside>
      </div>
    </Transition>

    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <section class="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div class="modal-heading">
          <div>
            <span class="modal-kicker">需求工作流 / 01</span>
            <h2 id="create-title">新建需求</h2>
          </div>
          <button class="icon-button" aria-label="关闭" @click="showCreateModal = false"><X :size="18" /></button>
        </div>
        <p class="modal-intro">录入需求标题与材料原文。来源材料将用于 AI 分析，并保留在当前试点系统的权限范围内。</p>
        <form @submit.prevent="addRequirement">
          <label class="form-label" for="req-title">需求标题 <span>必填</span></label>
          <input id="req-title" v-model="newTitle" class="form-input" placeholder="例如：测试用例支持批量复制" required />
          <label class="form-label" for="req-source">需求材料 / 来源</label>
          <div class="upload-placeholder">
            <Files :size="17" />
            <input id="req-source" v-model="newSource" placeholder="如：测试用例审核流程说明_v1.docx" />
            <span>可选</span>
          </div>
          <label class="form-label" for="req-source-text">需求材料原文 <span>用于 AI 分析</span></label>
          <textarea
            id="req-source-text"
            v-model="newSourceText"
            class="form-textarea"
            rows="5"
            maxlength="100000"
            placeholder="粘贴经过授权、脱敏的需求片段或验收条件。暂不支持直接上传文件。"
          ></textarea>
          <div class="form-note"><LockKeyhole :size="14" />请仅录入获准用于 AI 分析的材料；不要填写生产凭证或客户敏感信息。</div>
          <div class="modal-actions">
            <button type="button" class="secondary-button" @click="showCreateModal = false">取消</button>
            <button type="submit" class="primary-button" :disabled="busyAction === 'create-requirement'">
              <Plus :size="16" />{{ busyAction === 'create-requirement' ? '保存中…' : '加入澄清队列' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
