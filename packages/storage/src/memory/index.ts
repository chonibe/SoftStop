import type { DecisionListOptions, DecisionRecord, GovernorStorage } from "../interface";

export class MemoryGovernorStorage implements GovernorStorage {
  private decisions: DecisionRecord[] = [];

  async recordDecision(record: DecisionRecord): Promise<void> {
    this.decisions.push(record);
  }

  async listDecisions(options: DecisionListOptions): Promise<DecisionRecord[]> {
    return this.decisions
      .filter((decision) => decision.request.context.tenantId === options.tenantId)
      .slice(-(options.limit ?? 100))
      .reverse();
  }
}
