import { Module } from "@nestjs/common";
import { getTextProvider, loadAiEnv } from "@bombaypetcompany/ai";

import { AiAuditModule } from "../audit/ai-audit.module";
import { PetsModule } from "../pets/pets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { RemoteConfigModule } from "../remote-config/remote-config.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { CHAT_TEXT_MODEL_ID, CHAT_TEXT_PROVIDER } from "./chat.tokens";

// `RemoteConfigModule` (T106) is imported so `FeatureFlagGuard`'s
// `FeatureFlagsService` resolves for `ChatController`.
@Module({
  imports: [PrismaModule, PetsModule, QuotaModule, AiAuditModule, RemoteConfigModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    { provide: CHAT_TEXT_PROVIDER, useFactory: () => getTextProvider() },
    { provide: CHAT_TEXT_MODEL_ID, useFactory: () => loadAiEnv().AI_TEXT_MODEL },
  ],
})
export class ChatModule {}
