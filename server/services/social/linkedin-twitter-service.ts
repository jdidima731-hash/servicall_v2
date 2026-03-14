/**
 * LinkedIn & Twitter/X Service - Servicall v3
 */

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  organizationId: string;
}

export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
}

export interface SocialPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  simulated?: boolean;
}

export class LinkedInService {
  private config: LinkedInConfig;
  private configured: boolean = false;
  private baseUrl = "https://api.linkedin.com/v2";

  constructor(config: LinkedInConfig) {
    this.config = config;
    const isValid = config.accessToken && 
                    !config.accessToken.includes("your_") &&
                    config.organizationId &&
                    !config.organizationId.includes("your_");
    
    if (isValid) {
      this.configured = true;
      console.log("✅ [LinkedInService] Initialisé avec succès");
    } else {
      console.warn("⚠️ [LinkedInService] Credentials LinkedIn non configurés - mode simulation activé");
    }
  }

  isConfigured(): boolean { return this.configured; }

  async publishPost(content: { message: string; imageUrl?: string; hashtags?: string[] }): Promise<SocialPostResult> {
    if (!this.configured) {
      console.log(`💼 [SIMULATION LinkedIn] Post publié: ${content.message.substring(0, 50)}...`);
      return {
        success: true,
        postId: `sim_li_${Date.now()}`,
        postUrl: `https://www.linkedin.com/feed/update/urn:li:activity:sim_${Date.now()}`,
        simulated: true
      };
    }

    try {
      const fullText = content.hashtags 
        ? `${content.message}\n\n${content.hashtags.map(h => `#${h}`).join(" ")}`
        : content.message;

      const body: Record<string, unknown> = {
        author: `urn:li:organization:${this.config.organizationId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: fullText },
            shareMediaCategory: content.imageUrl ? "IMAGE" : "NONE",
            ...(content.imageUrl ? {
              media: [{
                status: "READY",
                description: { text: fullText.substring(0, 200) },
                originalUrl: content.imageUrl
              }]
            } : {})
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      const response = await fetch(`${this.baseUrl}/ugcPosts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json() as Record<string, unknown>;
      const postId = (data as Record<string, unknown>).id as string;

      if (!(data as Record<string, unknown>).id) {
        return { success: false, error: JSON.stringify(data) };
      }

      return {
        success: true,
        postId,
        postUrl: `https://www.linkedin.com/feed/update/${postId}`
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export class TwitterService {
  private config: TwitterConfig;
  private configured: boolean = false;
  private baseUrl = "https://api.twitter.com/2";

  constructor(config: TwitterConfig) {
    this.config = config;
    const isValid = config.accessToken && 
                    !config.accessToken.includes("your_") &&
                    config.apiKey &&
                    !config.apiKey.includes("your_");
    
    if (isValid) {
      this.configured = true;
      console.log("✅ [TwitterService] Initialisé avec succès");
    } else {
      console.warn("⚠️ [TwitterService] Credentials Twitter non configurés - mode simulation activé");
    }
  }

  isConfigured(): boolean { return this.configured; }

  async publishTweet(content: { text: string; imageUrl?: string; hashtags?: string[] }): Promise<SocialPostResult> {
    if (!this.configured) {
      console.log(`🐦 [SIMULATION Twitter] Tweet publié: ${content.text.substring(0, 50)}...`);
      return {
        success: true,
        postId: `sim_tw_${Date.now()}`,
        postUrl: `https://twitter.com/servicall/status/sim_${Date.now()}`,
        simulated: true
      };
    }

    try {
      const fullText = content.hashtags 
        ? `${content.text}\n${content.hashtags.map(h => `#${h}`).join(" ")}`
        : content.text;

      // Limiter à 280 caractères
      const tweetText = fullText.substring(0, 280);

      const response = await fetch(`${this.baseUrl}/tweets`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: tweetText })
      });

      const data = await response.json() as Record<string, unknown>;
      const tweetId = ((data as Record<string, unknown>).data as Record<string, unknown>)?.id as string;

      if (!tweetId) {
        return { success: false, error: JSON.stringify(data) };
      }

      return {
        success: true,
        postId: tweetId,
        postUrl: `https://twitter.com/servicall/status/${tweetId}`
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export function createLinkedInService(): LinkedInService {
  return new LinkedInService({
    clientId: process.env.LINKEDIN_CLIENT_ID || "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN || "",
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID || ""
  });
}

export function createTwitterService(): TwitterService {
  return new TwitterService({
    apiKey: process.env.TWITTER_API_KEY || "",
    apiSecret: process.env.TWITTER_API_SECRET || "",
    accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
    bearerToken: process.env.TWITTER_BEARER_TOKEN || ""
  });
}
