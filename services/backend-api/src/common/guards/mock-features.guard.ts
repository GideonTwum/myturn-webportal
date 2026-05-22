import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { isProductionTier } from "../platform-env";

/**
 * Blocks staging-only mock financial endpoints in production.
 * Apply at controller or handler level on mock routes.
 */
@Injectable()
export class MockFeaturesGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (isProductionTier()) {
      throw new ForbiddenException(
        "This endpoint is disabled in production. Mock payment flows are staging-only.",
      );
    }
    return true;
  }
}
