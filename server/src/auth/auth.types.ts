import { Request } from 'express'

export type AuthPrincipal = {
  id: string
  email: string
  name: string
}

export type AuthenticatedRequest = Request & { user: AuthPrincipal }
