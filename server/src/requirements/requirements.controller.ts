import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { AuthenticatedRequest } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Clarification } from '../entities/clarification.entity'
import { KnowledgeEntry } from '../entities/knowledge-entry.entity'
import { Requirement } from '../entities/requirement.entity'
import { System } from '../entities/system.entity'
import { SystemRole } from '../entities/system-membership.entity'
import { TestScenario } from '../entities/test-scenario.entity'
import { SystemAccessService } from '../systems/system-access.service'
import { ModelGatewayService, PROMPT_VERSIONS } from '../ai/model-gateway.service'
import { AnswerClarificationDto, CreateClarificationDto, CreateRequirementDto } from './requirement.dto'
import { SaveKnowledgeDto } from './knowledge.dto'

const EDIT_ROLES = [SystemRole.ADMIN, SystemRole.OWNER, SystemRole.TESTER]
const APPROVER_ROLES = [SystemRole.ADMIN, SystemRole.OWNER]
const cleanReferences = (values: string[]) => values.map((item) => item.trim()).filter(Boolean)

@UseGuards(JwtAuthGuard)
@Controller('systems/:systemId')
export class RequirementsController {
  constructor(
    private readonly access: SystemAccessService,
    private readonly model: ModelGatewayService,
    private readonly audit: AuditService,
    @InjectRepository(Requirement) private readonly requirements: Repository<Requirement>,
    @InjectRepository(Clarification) private readonly clarifications: Repository<Clarification>,
    @InjectRepository(TestScenario) private readonly scenarios: Repository<TestScenario>,
    @InjectRepository(KnowledgeEntry) private readonly knowledge: Repository<KnowledgeEntry>,
    @InjectRepository(System) private readonly systems: Repository<System>,
  ) {}

  @Get('dashboard')
  async dashboard(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const [requirements, clarifications, scenarios, knowledge] = await Promise.all([
      this.requirements.find({ where: { systemId }, order: { updatedAt: 'DESC' }, take: 100 }),
      this.clarifications.createQueryBuilder('item')
        .innerJoin('item.requirement', 'requirement')
        .where('requirement.system_id = :systemId', { systemId })
        .getMany(),
      this.scenarios.createQueryBuilder('scenario')
        .innerJoin('scenario.requirement', 'requirement')
        .where('requirement.system_id = :systemId', { systemId })
        .getMany(),
      this.knowledge.find({ where: { systemId, status: 'published' }, order: { updatedAt: 'DESC' }, take: 100 }),
    ])
    return {
      counts: {
        requirements: requirements.length,
        pendingClarifications: clarifications.filter((item) => item.status !== 'confirmed').length,
        pendingScenarios: scenarios.filter((item) => item.status === 'draft').length,
        publishedKnowledge: knowledge.length,
      },
      requirements: requirements.map((item) => this.toListItem(item, clarifications, scenarios)),
      recentKnowledge: knowledge.slice(0, 5).map(({ id, title, module, updatedAt }) => ({ id, title, module, updatedAt })),
    }
  }

  @Get('requirements')
  async list(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const [requirements, clarifications, scenarios] = await Promise.all([
      this.requirements.find({ where: { systemId }, relations: { creator: true }, order: { updatedAt: 'DESC' }, take: 100 }),
      this.clarifications.createQueryBuilder('item')
        .innerJoin('item.requirement', 'requirement')
        .where('requirement.system_id = :systemId', { systemId })
        .getMany(),
      this.scenarios.createQueryBuilder('scenario')
        .innerJoin('scenario.requirement', 'requirement')
        .where('requirement.system_id = :systemId', { systemId })
        .getMany(),
    ])
    return requirements.map((item) => ({
      ...this.toListItem(item, clarifications, scenarios),
      createdBy: item.creator.name,
    }))
  }

  @Get('scenarios')
  async listScenarios(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const rows = await this.scenarios.createQueryBuilder('scenario')
      .innerJoinAndSelect('scenario.requirement', 'requirement')
      .where('requirement.system_id = :systemId', { systemId })
      .orderBy('scenario.updatedAt', 'DESC')
      .take(200)
      .getMany()
    return rows.map(({ requirement, ...scenario }) => ({
      ...scenario,
      requirementTitle: requirement.title,
    }))
  }

  @Post('requirements')
  async create(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() body: CreateRequirementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const item = await this.requirements.save(this.requirements.create({
      systemId,
      createdBy: request.user.id,
      title: body.title.trim(),
      sourceName: body.sourceName?.trim() || null,
      sourceText: body.sourceText?.trim() ?? '',
      module: body.module?.trim() || '测试用例管理',
      status: 'needs_clarification',
    }))
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'requirement.created',
      entityType: 'requirement',
      entityId: item.id,
      details: { title: item.title, sourceName: item.sourceName },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return item
  }

  @Get('requirements/:requirementId')
  async get(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const item = await this.loadRequirement(systemId, requirementId)
    const [clarifications, scenarios] = await Promise.all([
      this.clarifications.find({ where: { requirementId }, relations: { confirmer: true }, order: { createdAt: 'ASC' } }),
      this.scenarios.find({ where: { requirementId }, relations: { creator: true, reviewer: true }, order: { createdAt: 'DESC' } }),
    ])
    return {
      ...item,
      clarifications: clarifications.map(({ confirmer, ...question }) => ({
        ...question,
        confirmedBy: confirmer ? { id: confirmer.id, name: confirmer.name } : null,
      })),
      scenarios: scenarios.map(({ creator, reviewer, ...scenario }) => ({
        ...scenario,
        createdBy: { id: creator.id, name: creator.name },
        reviewedBy: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
      })),
    }
  }

  @Post('requirements/:requirementId/analyze')
  async analyze(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const item = await this.loadRequirement(systemId, requirementId)
    if (!item.sourceText.trim()) throw new BadRequestException('请先添加需求原文，再发起 AI 澄清分析')
    const knowledge = await this.knowledge.find({
      where: { systemId, status: 'published' },
      order: { updatedAt: 'DESC' },
      take: 20,
    })
    const profile = await this.confirmedProfileContext(systemId)
    const result = await this.model.analyze({
      title: item.title,
      module: item.module,
      sourceName: item.sourceName,
      sourceText: item.sourceText,
      knowledge: knowledge.map(({ title, content }) => ({ title, content })),
      profile,
      sessionId: `ses_${requirementId.replaceAll('-', '')}`,
    })
    const existing = await this.clarifications.find({ where: { requirementId } })
    const existingQuestions = new Set(existing.map(({ question }) => question.trim().toLowerCase()))
    const additions = result.questions
      .filter((proposal) => proposal.question.trim() && !existingQuestions.has(proposal.question.trim().toLowerCase()))
      .map((proposal) => this.clarifications.create({
        requirementId,
        question: proposal.question.trim(),
        rationale: proposal.rationale.trim(),
        blocksDesign: Boolean(proposal.blocksDesign),
      }))
    if (additions.length) await this.clarifications.save(additions)
    item.aiSummary = {
      summary: result.summary,
      sourceFacts: result.sourceFacts,
      assumptions: result.assumptions,
      model: this.model.modelId,
      promptVersion: PROMPT_VERSIONS.clarification,
      generatedAt: new Date().toISOString(),
    }
    const outstandingQuestions = await this.clarifications.find({ where: { requirementId, blocksDesign: true } })
    item.status = outstandingQuestions.some((question) => question.status !== 'confirmed')
      ? 'needs_clarification'
      : 'ready_for_design'
    await this.requirements.save(item)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'requirement.ai_analyzed',
      entityType: 'requirement',
      entityId: item.id,
      details: {
        addedQuestions: additions.length,
        sourceFacts: result.sourceFacts.length,
        model: this.model.modelId,
        promptVersion: PROMPT_VERSIONS.clarification,
      },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return this.get(systemId, requirementId, request)
  }

  @Post('requirements/:requirementId/clarifications')
  async createClarification(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() body: CreateClarificationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const requirement = await this.loadRequirement(systemId, requirementId)
    const clarification = await this.clarifications.save(this.clarifications.create({
      requirementId,
      question: body.question.trim(),
      rationale: body.rationale?.trim() ?? '',
      blocksDesign: body.blocksDesign ?? true,
      status: 'open',
    }))
    requirement.status = 'needs_clarification'
    await this.requirements.save(requirement)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'clarification.created',
      entityType: 'clarification',
      entityId: clarification.id,
      details: { requirementId, blocksDesign: clarification.blocksDesign, source: 'manual' },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return clarification
  }

  @Post('requirements/:requirementId/clarifications/:clarificationId/answer')
  async answer(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('clarificationId', ParseUUIDPipe) clarificationId: string,
    @Body() body: AnswerClarificationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    await this.loadRequirement(systemId, requirementId)
    const question = await this.clarifications.findOneBy({ id: clarificationId, requirementId })
    if (!question) throw new NotFoundException('澄清问题不存在')
    if (question.status === 'confirmed') throw new ConflictException('已确认答案不可覆盖；如需变更请新增澄清记录')
    question.answer = body.answer.trim()
    question.status = 'answer_proposed'
    question.confirmedBy = null
    question.confirmedAt = null
    await this.clarifications.save(question)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'clarification.answer_proposed',
      entityType: 'clarification',
      entityId: question.id,
      details: { requirementId, answerLength: question.answer.length },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return question
  }

  @Post('requirements/:requirementId/clarifications/:clarificationId/confirm')
  async confirmAnswer(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('clarificationId', ParseUUIDPipe) clarificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, APPROVER_ROLES)
    const requirement = await this.loadRequirement(systemId, requirementId)
    const question = await this.clarifications.findOneBy({ id: clarificationId, requirementId })
    if (!question) throw new NotFoundException('澄清问题不存在')
    if (!question.answer?.trim()) throw new BadRequestException('确认前必须先记录业务答案')
    question.status = 'confirmed'
    question.confirmedBy = request.user.id
    question.confirmedAt = new Date()
    await this.clarifications.save(question)
    const blockers = await this.clarifications.count({ where: { requirementId, blocksDesign: true, status: 'open' } })
    const proposed = await this.clarifications.count({ where: { requirementId, blocksDesign: true, status: 'answer_proposed' } })
    requirement.status = blockers === 0 && proposed === 0 ? 'ready_for_design' : 'needs_clarification'
    await this.requirements.save(requirement)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'clarification.answer_confirmed',
      entityType: 'clarification',
      entityId: question.id,
      details: { requirementId },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return { clarification: question, requirementStatus: requirement.status }
  }

  @Post('requirements/:requirementId/scenarios/generate')
  async generateScenarios(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const requirement = await this.loadRequirement(systemId, requirementId)
    const questions = await this.clarifications.find({ where: { requirementId } })
    const blockers = questions.filter((item) => item.blocksDesign && item.status !== 'confirmed')
    if (blockers.length) throw new ConflictException('仍有影响测试预期的待确认问题，暂不能生成测试场景')
    const knowledge = await this.knowledge.find({
      where: { systemId, status: 'published' },
      order: { updatedAt: 'DESC' },
      take: 20,
    })
    const profile = await this.confirmedProfileContext(systemId)
    const proposals = await this.model.generateScenarios({
      title: requirement.title,
      module: requirement.module,
      sourceName: requirement.sourceName,
      sourceText: requirement.sourceText,
      confirmedAnswers: questions.filter((item) => item.status === 'confirmed').map((item) => `${item.question}\n确认答案：${item.answer}`),
      knowledge: knowledge.map(({ title, content }) => ({ title, content })),
      profile,
      sessionId: `ses_${requirementId.replaceAll('-', '')}`,
    })
    const scenarios = await this.scenarios.save(proposals.map((proposal) => this.scenarios.create({
      requirementId,
      title: proposal.title.trim(),
      objective: proposal.objective.trim(),
      steps: proposal.steps.map((step) => step.trim()).filter(Boolean),
      expectedResult: proposal.expectedResult.trim(),
      citations: proposal.citations,
      generationMetadata: {
        model: this.model.modelId,
        promptVersion: PROMPT_VERSIONS.scenarios,
        generatedAt: new Date().toISOString(),
      },
      status: 'draft',
      createdBy: request.user.id,
    })))
    requirement.status = 'design_generated'
    await this.requirements.save(requirement)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'test_scenarios.generated',
      entityType: 'requirement',
      entityId: requirementId,
      details: { scenarioCount: scenarios.length },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return scenarios
  }

  @Post('requirements/:requirementId/scenarios/:scenarioId/review')
  async reviewScenario(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('scenarioId', ParseUUIDPipe) scenarioId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    await this.loadRequirement(systemId, requirementId)
    const scenario = await this.scenarios.findOneBy({ id: scenarioId, requirementId })
    if (!scenario) throw new NotFoundException('测试场景不存在')
    const unresolvedBlockers = await this.clarifications.count({
      where: { requirementId, blocksDesign: true, status: 'open' },
    })
    const proposedBlockers = await this.clarifications.count({
      where: { requirementId, blocksDesign: true, status: 'answer_proposed' },
    })
    if (unresolvedBlockers || proposedBlockers) {
      throw new ConflictException('仍有待确认问题，当前不可审核此测试场景')
    }
    scenario.status = 'approved'
    scenario.reviewedBy = request.user.id
    await this.scenarios.save(scenario)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'test_scenario.approved',
      entityType: 'test_scenario',
      entityId: scenario.id,
      details: { requirementId },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return scenario
  }

  @Post('requirements/:requirementId/clarifications/:clarificationId/knowledge')
  async createKnowledgeFromAnswer(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('clarificationId', ParseUUIDPipe) clarificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const requirement = await this.loadRequirement(systemId, requirementId)
    const clarification = await this.clarifications.findOneBy({ id: clarificationId, requirementId, status: 'confirmed' })
    if (!clarification || !clarification.answer) throw new NotFoundException('只有已确认答案可以转为知识草稿')
    const entry = await this.knowledge.save(this.knowledge.create({
      systemId,
      title: clarification.question,
      content: clarification.answer,
      module: requirement.module,
      sourceReference: {
        requirementId,
        clarificationId,
        requirementTitle: requirement.title,
      },
      createdBy: request.user.id,
      status: 'draft',
    }))
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'knowledge.draft_created',
      entityType: 'knowledge_entry',
      entityId: entry.id,
      details: { requirementId, clarificationId },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return entry
  }

  @Post('knowledge')
  async createKnowledge(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() body: SaveKnowledgeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const entry = await this.knowledge.save(this.knowledge.create({
      systemId,
      title: body.title.trim(),
      content: body.content.trim(),
      module: body.module.trim(),
      sourceReference: { references: cleanReferences(body.sourceReferences) },
      createdBy: request.user.id,
      status: 'draft',
    }))
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'knowledge.draft_created',
      entityType: 'knowledge_entry',
      entityId: entry.id,
      details: { source: 'manual', module: entry.module },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return entry
  }

  @Put('knowledge/:knowledgeId')
  async updateKnowledgeDraft(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('knowledgeId', ParseUUIDPipe) knowledgeId: string,
    @Body() body: SaveKnowledgeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const entry = await this.knowledge.findOneBy({ id: knowledgeId, systemId })
    if (!entry) throw new NotFoundException('知识条目不存在')
    if (entry.status === 'published') {
      throw new ConflictException('已发布知识不可直接覆盖；请创建修订草稿。')
    }
    entry.title = body.title.trim()
    entry.content = body.content.trim()
    entry.module = body.module.trim()
    entry.sourceReference = {
      ...entry.sourceReference,
      references: cleanReferences(body.sourceReferences),
    }
    await this.knowledge.save(entry)
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'knowledge.draft_updated',
      entityType: 'knowledge_entry',
      entityId: entry.id,
      details: { module: entry.module },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return entry
  }

  @Post('knowledge/:knowledgeId/revise')
  async reviseKnowledge(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('knowledgeId', ParseUUIDPipe) knowledgeId: string,
    @Body() body: SaveKnowledgeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, EDIT_ROLES)
    const original = await this.knowledge.findOneBy({ id: knowledgeId, systemId, status: 'published' })
    if (!original) throw new NotFoundException('已发布的原知识条目不存在')
    const entry = await this.knowledge.save(this.knowledge.create({
      systemId,
      title: body.title.trim(),
      content: body.content.trim(),
      module: body.module.trim(),
      sourceReference: {
        ...original.sourceReference,
        references: cleanReferences(body.sourceReferences),
        revisionOf: original.id,
      },
      createdBy: request.user.id,
      status: 'draft',
    }))
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'knowledge.revision_created',
      entityType: 'knowledge_entry',
      entityId: entry.id,
      details: { revisionOf: original.id, module: entry.module },
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return entry
  }

  @Get('knowledge')
  async listKnowledge(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId)
    const entries = await this.knowledge.find({
      where: { systemId },
      relations: { creator: true, reviewer: true },
      order: { updatedAt: 'DESC' },
      take: 200,
    })
    return entries.map(({ creator, reviewer, ...entry }) => ({
      ...entry,
      creator: { id: creator.id, name: creator.name },
      reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
    }))
  }

  @Post('knowledge/:knowledgeId/publish')
  async publishKnowledge(
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Param('knowledgeId', ParseUUIDPipe) knowledgeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.access.requireRole(request.user.id, systemId, APPROVER_ROLES)
    let supersededId: string | null = null
    const entry = await this.knowledge.manager.transaction(async (manager) => {
      const repository = manager.getRepository(KnowledgeEntry)
      const draft = await repository.findOneBy({ id: knowledgeId, systemId })
      if (!draft) throw new NotFoundException('知识条目不存在')
      if (draft.status !== 'draft') throw new ConflictException('只有知识草稿可以发布')
      const revisionOf = draft.sourceReference?.revisionOf
      if (typeof revisionOf === 'string') {
        const original = await repository.findOneBy({ id: revisionOf, systemId })
        if (!original || original.status !== 'published') {
          throw new ConflictException('原知识已变化或不再发布，请刷新后重新创建修订草稿')
        }
        original.status = 'superseded'
        await repository.save(original)
        supersededId = original.id
      }
      draft.status = 'published'
      draft.reviewedBy = request.user.id
      return repository.save(draft)
    })
    if (supersededId) {
      await this.audit.record({
        systemId,
        actorId: request.user.id,
        action: 'knowledge.superseded',
        entityType: 'knowledge_entry',
        entityId: supersededId,
        details: { supersededBy: entry.id },
        ip: request.ip,
        userAgent: request.get('user-agent'),
      })
    }
    await this.audit.record({
      systemId,
      actorId: request.user.id,
      action: 'knowledge.published',
      entityType: 'knowledge_entry',
      entityId: entry.id,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    })
    return entry
  }

  private async loadRequirement(systemId: string, requirementId: string) {
    const item = await this.requirements.findOneBy({ id: requirementId, systemId })
    if (!item) throw new NotFoundException('需求不存在')
    return item
  }

  private async confirmedProfileContext(systemId: string) {
    const system = await this.systems.findOneBy({ id: systemId })
    if (!system || system.profileStatus !== 'confirmed') return null
    const profile = system.profile ?? {}
    const list = (name: string, items?: string[]) => items?.length ? `${name}：${items.join('、')}` : ''
    const content = [
      `系统名称：${system.name}`,
      `系统类型：${system.type}`,
      `系统简介：${system.description}`,
      list('业务归属', profile.businessLine ? [profile.businessLine] : []),
      list('系统别名', profile.aliases),
      list('功能模块', profile.modules),
      list('用户角色', profile.roles),
      list('核心流程', profile.workflows),
      list('上下游依赖', profile.dependencies),
      list('测试环境', profile.testEnvironments),
      list('安全与测试约束', profile.securityNotes ? [profile.securityNotes] : []),
      list('画像来源依据', profile.sourceReferences),
    ].filter(Boolean).join('\n')
    return { sourceName: `${system.name}（已确认系统画像）`, content }
  }

  private toListItem(item: Requirement, clarifications: Clarification[], scenarios: TestScenario[]) {
    const questions = clarifications.filter((question) => question.requirementId === item.id)
    const drafts = scenarios.filter((scenario) => scenario.requirementId === item.id)
    return {
      id: item.id,
      title: item.title,
      module: item.module,
      sourceName: item.sourceName,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      counts: {
        openQuestions: questions.filter((question) => question.status !== 'confirmed').length,
        scenarios: drafts.length,
      },
    }
  }
}
