import type { Governor, AuthorizeRequest } from "@governor/core";

export const createToolMiddleware = (governor: Governor) => {
  return async (request: AuthorizeRequest, next: () => Promise<unknown>) => {
    const decision = await governor.authorize(request);
    if (!decision.allowed) {
      return { decision };
    }
    const result = await next();
    return { decision, result };
  };
};
