import { Body, Controller, Get, NotFoundException, Post } from "@nestjs/common";
import { IsString } from "class-validator";

// Test-only DTO used to exercise the global ValidationPipe.
class EchoDto {
  @IsString()
  name!: string;
}

// Test-only controller. Never imported by AppModule and excluded from
// tsconfig.build.json (so it never ships in production dist). It is
// injected directly into the Nest testing module by app.e2e-spec.ts.
@Controller("__test__")
export class TestThrowController {
  @Get("boom")
  boom(): never {
    throw new NotFoundException("boom");
  }

  @Post("echo")
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }
}
