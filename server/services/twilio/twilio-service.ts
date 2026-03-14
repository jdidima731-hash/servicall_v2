import twilio from "twilio";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private configured: boolean = false;

  constructor(config: TwilioConfig) {
    this.fromNumber = config.fromNumber;
    
    // Vérifier si les credentials Twilio sont valides avant d'initialiser
    const isValidSid = config.accountSid && config.accountSid.startsWith("AC");
    const isValidToken = config.authToken && config.authToken.length > 10 && !config.authToken.includes("your_");
    
    if (isValidSid && isValidToken) {
      try {
        this.client = twilio(config.accountSid, config.authToken);
        this.configured = true;
        console.log("✅ [TwilioService] Initialisé avec succès");
      } catch (error) {
        console.warn("⚠️ [TwilioService] Impossible d'initialiser Twilio:", error);
        this.configured = false;
      }
    } else {
      console.warn("⚠️ [TwilioService] Credentials Twilio non configurés - mode simulation activé");
      this.configured = false;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async makeCall(toNumber: string, message: string): Promise<string> {
    if (!this.configured || !this.client) {
      console.log(`📞 [SIMULATION] Appel vers ${toNumber}: ${message}`);
      return `sim_call_${Date.now()}`;
    }
    try {
      const call = await this.client.calls.create({
        url: `${process.env.APP_URL || 'https://your-domain.com'}/api/twilio/twiml?message=${encodeURIComponent(message)}`,
        to: toNumber,
        from: this.fromNumber,
      });
      console.log(`📞 Call initiated: ${call.sid}`);
      return call.sid;
    } catch (error) {
      console.error(`❌ Error making call: ${error}`);
      throw error;
    }
  }

  async getCallStatus(callSid: string): Promise<string> {
    if (!this.configured || !this.client) {
      return "simulated";
    }
    try {
      const call = await this.client.calls(callSid).fetch();
      return call.status;
    } catch (error) {
      console.error(`❌ Error fetching call status: ${error}`);
      throw error;
    }
  }

  async sendSMS(toNumber: string, message: string): Promise<string> {
    if (!this.configured || !this.client) {
      console.log(`📱 [SIMULATION] SMS vers ${toNumber}: ${message}`);
      return `sim_sms_${Date.now()}`;
    }
    try {
      const sms = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: toNumber,
      });
      console.log(`📱 SMS sent: ${sms.sid}`);
      return sms.sid;
    } catch (error) {
      console.error(`❌ Error sending SMS: ${error}`);
      throw error;
    }
  }
}
