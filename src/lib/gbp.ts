// Google Business Profile API adapter for Core 30 publishing.
// Handles posts, services, Q&A, and review replies via GBP API v4.
//
// Prerequisites:
//   1. OAuth2 credentials with https://www.googleapis.com/auth/business.manage scope
//   2. G Suite admin enabled for Business Profile API
//   3. Location verified (required for review replies)
//
// Usage:
//   const gbp = new GBPAdapter({ accessToken: process.env.GBP_ACCESS_TOKEN });
//   await gbp.createPost(accountId, locationId, { summary: "..." });
//   await gbp.replyToReview(accountId, locationId, reviewId, "Thanks for the review!");

const GBP_API = "https://mybusiness.googleapis.com/v4";

export interface GBPConfig {
  accessToken: string;
  accountId?: string;  // Optional: set once, reuse across calls
}

export interface LocalPost {
  summary: string;
  callToAction?: {
    actionType: "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
    url?: string;
  };
  topicType?: "STANDARD" | "EVENT" | "OFFER";
  event?: {
    title: string;
    start: string;  // ISO timestamp
    end: string;
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  media?: {
    mediaFormat: "PHOTO" | "VIDEO";
    sourceUrl: string;
  }[];
}

export interface ReviewReply {
  comment: string;  // max 4096 bytes
}

export class GBPAdapter {
  private accessToken: string;
  private accountId?: string;

  constructor(config: GBPConfig) {
    this.accessToken = config.accessToken;
    this.accountId = config.accountId;
  }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${GBP_API}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...opts.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`GBP API ${res.status}: ${error}`);
    }

    return res.json();
  }

  // === ACCOUNTS ===

  /** List all accounts the authenticated user has access to. */
  async listAccounts(): Promise<{ name: string; accountName: string; type: string }[]> {
    const data = await this.request<{ accounts: { name: string; accountName: string; type: string }[] }>("/accounts");
    return data.accounts || [];
  }

  // === LOCATIONS ===

  /** List locations for an account. */
  async listLocations(accountId: string): Promise<{ name: string; locationName: string }[]> {
    const data = await this.request<{ locations: { name: string; locationName: string }[] }>(
      `/accounts/${accountId}/locations`
    );
    return data.locations || [];
  }

  /** Get a single location. */
  async getLocation(accountId: string, locationId: string) {
    return this.request(`/accounts/${accountId}/locations/${locationId}`);
  }

  // === LOCAL POSTS ===

  /** Create a local post (GBP posts appear in the Updates tab). */
  async createPost(
    accountId: string,
    locationId: string,
    post: LocalPost
  ): Promise<{ name: string; state: string }> {
    return this.request(`/accounts/${accountId}/locations/${locationId}/localPosts`, {
      method: "POST",
      body: JSON.stringify(post),
    });
  }

  /** List local posts. */
  async listPosts(
    accountId: string,
    locationId: string,
    pageSize = 100
  ): Promise<{ name: string; summary: string; state: string }[]> {
    const data = await this.request<{ localPosts: any[] }>(
      `/accounts/${accountId}/locations/${locationId}/localPosts?pageSize=${pageSize}`
    );
    return (data.localPosts || []).map((p) => ({
      name: p.name,
      summary: p.summary,
      state: p.state,
    }));
  }

  /** Delete a local post. */
  async deletePost(accountId: string, locationId: string, postId: string): Promise<void> {
    await this.request(`/accounts/${accountId}/locations/${locationId}/localPosts/${postId}`, {
      method: "DELETE",
    });
  }

  // === REVIEWS ===

  /** List reviews for a location. */
  async listReviews(
    accountId: string,
    locationId: string,
    pageSize = 50
  ): Promise<{ name: string; reviewer: string; starRating: string; comment?: string }[]> {
    const data = await this.request<{ reviews: any[] }>(
      `/accounts/${accountId}/locations/${locationId}/reviews?pageSize=${pageSize}`
    );
    return (data.reviews || []).map((r) => ({
      name: r.name,
      reviewer: r.reviewer?.displayName || "Anonymous",
      starRating: r.starRating,
      comment: r.comment,
    }));
  }

  /** Reply to a review. Location must be verified. */
  async replyToReview(
    accountId: string,
    locationId: string,
    reviewId: string,
    comment: string
  ): Promise<{ comment: string; updateTime: string }> {
    // Extract just the review ID if full name passed
    const reviewName = reviewId.includes("/")
      ? reviewId
      : `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}`;

    return this.request(`${reviewName}/reply`, {
      method: "PUT",
      body: JSON.stringify({ comment }),
    });
  }

  /** Delete a review reply. */
  async deleteReply(
    accountId: string,
    locationId: string,
    reviewId: string
  ): Promise<void> {
    const reviewName = reviewId.includes("/")
      ? reviewId
      : `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}`;

    await this.request(`${reviewName}/reply`, { method: "DELETE" });
  }

  // === Q&A ===

  /** List questions for a location. */
  async listQuestions(
    accountId: string,
    locationId: string,
    pageSize = 50
  ): Promise<{ name: string; text: string; author: string; answers: { text: string }[] }[]> {
    const data = await this.request<{ questions: any[] }>(
      `/accounts/${accountId}/locations/${locationId}/questions?pageSize=${pageSize}`
    );
    return (data.questions || []).map((q) => ({
      name: q.name,
      text: q.text,
      author: q.author?.displayName || "Anonymous",
      answers: (q.answers || []).map((a: any) => ({ text: a.text })),
    }));
  }

  /** Create a question (seed Q&A). */
  async createQuestion(
    accountId: string,
    locationId: string,
    text: string
  ): Promise<{ name: string; text: string }> {
    return this.request(`/accounts/${accountId}/locations/${locationId}/questions`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  /** Answer a question. */
  async answerQuestion(
    accountId: string,
    locationId: string,
    questionId: string,
    text: string
  ): Promise<{ name: string; text: string }> {
    return this.request(
      `/accounts/${accountId}/locations/${locationId}/questions/${questionId}/answers`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    );
  }

  // === SERVICES ===

  /** List services for a location. */
  async listServices(
    accountId: string,
    locationId: string
  ): Promise<{ name: string; displayName: string }[]> {
    const data = await this.request<{ services: any[] }>(
      `/accounts/${accountId}/locations/${locationId}/services`
    );
    return (data.services || []).map((s) => ({
      name: s.name,
      displayName: s.displayName,
    }));
  }

  // Note: GBP API does not expose a public endpoint for creating/updating services.
  // Services are managed via the GBP dashboard or bulk upload spreadsheet.

  // === INSIGHTS ===

  /** Get basic metrics for a location (impressions, searches, actions). */
  async getInsights(
    accountId: string,
    locationId: string,
    startTime: string,
    endTime: string
  ) {
    return this.request(`/accounts/${accountId}/locations/${locationId}:reportInsights`, {
      method: "POST",
      body: JSON.stringify({
        basicRequest: {
          metricRequests: [{ metric: "ALL" }],
          timeRange: { startTime, endTime },
        },
      }),
    });
  }
}

// === AUTH HELPERS ===

/**
 * OAuth2 flow for GBP. Requires G Suite admin to enable Business Profile API.
 * 
 * 1. Create OAuth2 credentials in Google Cloud Console
 * 2. Add redirect URI: https://your-app.com/auth/gbp/callback
 * 3. Request scopes: https://www.googleapis.com/auth/business.manage
 * 4. Exchange auth code for tokens
 */
export function getGBPOAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
    state: state || "",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGBPToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return res.json();
}
