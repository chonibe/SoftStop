import { GovernorEvent, GovernorUserState } from "../types";

export interface Storage {
  getUserState(userId: string): Promise<GovernorUserState | null>;
  upsertUserState(userId: string, state: GovernorUserState): Promise<void>;
  insertEvent(event: GovernorEvent): Promise<void>;
}
