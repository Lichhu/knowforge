import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    const isHttpException = exception instanceof HttpException
    const status = isHttpException ? exception.getStatus() : 500
    const responseBody = isHttpException
      ? exception.getResponse()
      : { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }
    const message = this.messageOf(responseBody)
    const logMessage = `${request.method} ${request.path} -> ${status}: ${message}`

    if (status >= 500) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined)
    } else {
      this.logger.warn(logMessage)
    }

    response.status(status).json(responseBody)
  }

  private messageOf(body: string | object) {
    if (typeof body === 'string') return body
    if ('message' in body) {
      const message = body.message
      return Array.isArray(message) ? message.join('; ') : String(message)
    }
    return 'Request failed'
  }
}
