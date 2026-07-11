import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { CurrentUser } from "../auth/auth.decorators";
import { DevicesService, type RegisteredDevice } from "./devices.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";

// Not @Public() — the global JwtAuthGuard applies, so `user` is guaranteed
// populated by the time the handler runs.
@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(200)
  @ApiOkResponse({
    description:
      "Registers (or re-registers) a push token for the caller. Always 200 for both create and update, since upsert does not report which occurred.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiBadRequestResponse({ description: "Invalid token shape or unsupported platform." })
  register(
    @CurrentUser() user: { userId: string },
    @Body() dto: RegisterDeviceDto,
  ): Promise<RegisteredDevice> {
    return this.devicesService.register(user.userId, dto);
  }
}
