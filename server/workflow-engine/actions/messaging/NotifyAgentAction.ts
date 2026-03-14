import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";

interface NotifyAgentResult { method: string; recipient: string; }

export class NotifyAgentAction implements ActionHandler<Record<string, unknown>, FinalExecutionContext, NotifyAgentResult> {
  name = 'notify_agent';
  private logger = new Logger('NotifyAgentAction');

  async execute(
    _context: FinalExecutionContext,
    _config: Record<string, unknown>
  ): Promise<ActionResult<NotifyAgentResult>> {
    try {
      this.logger.info('Notifying agent...');
      return { success: true, data: { method: "internal_notification", recipient: "agent" } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(_config: Record<string, unknown>): boolean { return true; }
}
