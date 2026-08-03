import type { Governor, AuthorizeRequest } from "@governor/core";

export const authorizeToolCall = (governor: Governor, request: AuthorizeRequest) => {
  return governor.authorize(request);
};
