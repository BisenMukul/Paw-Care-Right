import { Controller, Get, Query } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Breed } from "@pawcareright/data";

import { Public } from "../auth/auth.decorators";
import { BreedsQueryDto } from "./dto/breeds-query.dto";
import { BreedsService } from "./breeds.service";

// Public, unauthenticated, cached breed lookup/autocomplete. No
// `@SkipThrottle()`: per Amendment A0 this route keeps the global 100/60s
// rate limiter, same as any other public endpoint (T017 posture). The
// e2e p95 spec's TestingModule overrides `ThrottlerGuard` with a
// pass-through for its own high-volume timing run instead.
@ApiTags("breeds")
@Controller("breeds")
@Public()
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  @ApiOkResponse({
    description: "Breeds for the species, filtered/ranked by q (empty q = full list).",
  })
  @ApiBadRequestResponse({ description: "Missing or invalid species." })
  find(@Query() query: BreedsQueryDto): Promise<Breed[]> {
    return this.breedsService.search(query.species, query.q);
  }
}
