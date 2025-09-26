/**
 * Campaigns API service
 */
import { ApiResponse, apiRequest } from "./base";

export interface CampaignCharacter {
  id: string;
  name: string;
  class: string;
  level: number;
  race?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  gameSystem: string;
  gameMasterId: string;
  players: string[];
  characters: CampaignCharacter[];
  sessions: number;
  totalHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  gameSystem?: string;
  isActive?: boolean;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  gameSystem?: string;
  isActive?: boolean;
}

export class CampaignsApi {
  /**
   * Get all campaigns for the current user
   */
  static async getCampaigns(): Promise<ApiResponse<Campaign[]>> {
    return apiRequest<Campaign[]>("/api/v1/campaigns");
  }

  /**
   * Get campaigns where user is game master
   */
  static async getCampaignsAsMaster(): Promise<ApiResponse<Campaign[]>> {
    return apiRequest<Campaign[]>("/api/v1/campaigns/as-master");
  }

  /**
   * Get a specific campaign by ID
   */
  static async getCampaign(campaignId: string): Promise<ApiResponse<Campaign>> {
    return apiRequest<Campaign>(`/api/v1/campaigns/${campaignId}`);
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(request: CreateCampaignRequest): Promise<ApiResponse<Campaign>> {
    return apiRequest<Campaign>("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Update an existing campaign
   */
  static async updateCampaign(
    campaignId: string,
    request: UpdateCampaignRequest,
  ): Promise<ApiResponse<Campaign>> {
    return apiRequest<Campaign>(`/api/v1/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  /**
   * Delete a campaign
   */
  static async deleteCampaign(campaignId: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/v1/campaigns/${campaignId}`, {
      method: "DELETE",
    });
  }

  /**
   * Set active scene for a campaign
   */
  static async setActiveScene(campaignId: string, sceneId: string): Promise<ApiResponse<boolean>> {
    return apiRequest<boolean>(`/api/v1/campaigns/${campaignId}/active-scene`, {
      method: "POST",
      body: JSON.stringify({ sceneId }),
    });
  }
}
