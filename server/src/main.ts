import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import express, { NextFunction, Request, Response } from 'express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173'

  app.setGlobalPrefix('api')
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use(cookieParser())
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    if (isWrite && request.cookies?.access_token && request.get('origin') !== origin) {
      response.status(403).json({ message: '请求来源未通过校验' })
      return
    }
    next()
  })
  app.enableCors({ origin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  app.useGlobalFilters(new HttpExceptionFilter())

  const port = Number(process.env.API_PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
  console.log(`KnowForge API listening on http://localhost:${port}/api`)
}

void bootstrap()
