import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";

const AddTagConfigSchema = z.object({
  tag: z.string().optional(),
});
type AddTagConfig = z.infer<typeof AddTagConfigSchema>;

interface AddTagResult { tag: string; }

export class AddTagAction implements ActionHandler<AddTagConfig, FinalExecutionContext, AddTagResult> {
  name = 'crm_add_tag';
  private logger = new Logger('AddTagAction');

  async execute(
    _context: FinalExecutionContext,
    config: AddTagConfig
  ): Promise<ActionResult<AddTagResult>> {
    try {
      this.logger.info('Adding tag in CRM...');
      return { success: true, data: { tag: config.tag ?? "auto-tagged" } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(_config: Record<string, unknown>): boolean { return true; }
}
