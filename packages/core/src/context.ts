import type { AuthorizeRequest } from "./types";

export const toolId = (request: AuthorizeRequest): string => {
  const { server, name } = request.tool;
  return server ? `${server}.${name}` : name;
};
