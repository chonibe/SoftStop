import { GovernorEvent, GovernorUserState } from "../types";
import { Storage } from "./storage";

export class MemoryStorage implements Storage {
  private events: GovernorEvent[] = [];
  private states = new Map<string, GovernorUserState>();

  async getUserState(userId: string): Promise<GovernorUserState | null> {
    return this.states.get(userId) ?? null;
  }

  async upsertUserState(
    userId: string,
    state: GovernorUserState
  ): Promise<void> {
    this.states.set(userId, state);
  }

  async insertEvent(event: GovernorEvent): Promise<void> {
    this.events.push(event);
  }
}
