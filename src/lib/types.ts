export interface VideoSummary {
  id: string;
  desc: string;
  authorUsername: string;
  authorNickname: string;
  authorAvatar?: string;
  cover?: string;
  playCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  duration?: number;
  url: string;
  /** Direct MP4 from TikWM (client-side, no backend). */
  playUrl?: string;
}

export interface UserSummary {
  username: string;
  nickname: string;
  avatar?: string;
  signature?: string;
  verified?: boolean;
  stats?: {
    followerCount?: number;
    followingCount?: number;
    heartCount?: number;
    videoCount?: number;
  };
}

export interface SearchResponse {
  items: VideoSummary[];
  user?: UserSummary | null;
  source?: string;
  error?: string;
}