import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeWorkflow } from "./workflowService";
import * as db from "../db";
import * as email from "./emailService";
import axios from "axios";

// Mock dependencies
vi.mock("../db", () => ({
  getWorkflowsByTenant: vi.fn(),
  updateProspect: vi.fn(),
  createTask: vi.fn(),
  createAppointment: vi.fn(),
}));

vi.mock("./twilioService", () => ({
  sendSMS: vi.fn(),
}));

vi.mock("./emailService", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("axios");

describe("workflowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute send_email action", async () => {
    const tenantId = 1;
    const trigger = "prospect_created";
    const context = { tenantId, prospectId: 1, prospectEmail: "test@example.com", prospectName: "John" };
    
    const mockWorkflow = {
      id: 1,
      trigger,
      actions: [
        {
          type: "send_email",
          config: {
            subject: "Welcome {{prospectName}}",
            body: "Hello {{prospectName}}, welcome to Servicall!",
          },
        },
      ],
    };

    db.getWorkflowsByTenant.mockResolvedValue([mockWorkflow]);
    email.sendEmail.mockResolvedValue({});

    await executeWorkflow(tenantId, trigger, context);

    expect(email.sendEmail).toHaveBeenCalledWith(
      "test@example.com",
      "Welcome John",
      "Hello John, welcome to Servicall!"
    );
  });

  it("should execute create_task action", async () => {
    const tenantId = 1;
    const trigger = "prospect_created";
    const context = { tenantId, prospectId: 1, agentId: 2 };
    
    const mockWorkflow = {
      id: 1,
      trigger,
      actions: [
        {
          type: "create_task",
          config: {
            title: "Follow up with prospect",
            description: "New prospect created, please follow up.",
          },
        },
      ],
    };

    db.getWorkflowsByTenant.mockResolvedValue([mockWorkflow]);
    db.createTask.mockResolvedValue({});

    await executeWorkflow(tenantId, trigger, context);

    expect(db.createTask).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId: 2,
      title: "Follow up with prospect",
    }));
  });

  it("should execute webhook action", async () => {
    const tenantId = 1;
    const trigger = "prospect_created";
    const context = { tenantId, prospectId: 1 };
    
    const mockWorkflow = {
      id: 1,
      trigger,
      actions: [
        {
          type: "webhook",
          config: {
            url: "https://example.com/webhook",
            method: "POST",
          },
        },
      ],
    };

    db.getWorkflowsByTenant.mockResolvedValue([mockWorkflow]);
    axios.mockResolvedValue({ data: {} });

    await executeWorkflow(tenantId, trigger, context);

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/webhook",
      method: "POST",
    }));
  });
});
