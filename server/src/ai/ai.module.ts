import { Module } from '@nestjs/common'
import { ModelGatewayService } from './model-gateway.service'

@Module({
  providers: [ModelGatewayService],
  exports: [ModelGatewayService],
})
export class AiModule {}
