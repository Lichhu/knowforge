export type SourceFact = {
  text: string
  quote: string
}

export type ClarificationProposal = {
  question: string
  rationale: string
  blocksDesign: boolean
}

export type AnalysisResult = {
  summary: string
  sourceFacts: SourceFact[]
  questions: ClarificationProposal[]
  assumptions: string[]
}

export type ScenarioProposal = {
  title: string
  objective: string
  steps: string[]
  expectedResult: string
  citations: Array<{ source: string; quote: string }>
}
