import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { isProductionTier } from "../platform-env";

/** Blocks weak staging auth shortcuts in production (e.g. member-phone login). */
@Injectable()
export class StagingAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (isProductionTier()) {
      throw new ForbiddenException(
        "This authentication shortcut is disabled in production.",
      );
    }
    return true;
  }
}
