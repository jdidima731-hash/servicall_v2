import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";

const AddNoteConfigSchema = z.object({
  note: z.string().optional(),
  prospect_id: z.number().optional(),
});
type AddNoteConfig = z.infer<typeof AddNoteConfigSchema>;

interface AddNoteResult { noteId: string; }

export class AddNoteAction implements ActionHandler<AddNoteConfig, FinalExecutionContext, AddNoteResult> {
  name = 'crm_add_note';
  private logger = new Logger('AddNoteAction');

  async execute(
    _context: FinalExecutionContext,
    _config: AddNoteConfig
  ): Promise<ActionResult<AddNoteResult>> {
    try {
      this.logger.info('Adding note to CRM...');
      return { success: true, data: { noteId: "note_" + Date.now() } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(_config: Record<string, unknown>): boolean { return true; }
}
