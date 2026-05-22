import { SetMetadata } from "@nestjs/common";

export const API_WRAPPED_KEY = "api_wrapped";

/** Opt-in success/error envelope for mobile-first routes. */
export const ApiWrapped = () => SetMetadata(API_WRAPPED_KEY, true);
