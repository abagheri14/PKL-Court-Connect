export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

export const UPLOAD_PURPOSE = {
	PROFILE_PHOTO: "profile-photo",
	CHAT_IMAGE: "chat-image",
	COURT_PHOTO: "court-photo",
	FEED: "feed",
	PROFILE: "profile",
	COURT: "court",
	GAME: "game",
	GROUP: "group",
	COACHING: "coaching",
	CHAT: "chat",
	GENERAL: "general",
} as const;

export type UploadPurpose = typeof UPLOAD_PURPOSE[keyof typeof UPLOAD_PURPOSE];

export const UPLOAD_PURPOSES: readonly UploadPurpose[] = Object.values(UPLOAD_PURPOSE);
export const DEFAULT_UPLOAD_PURPOSE = UPLOAD_PURPOSE.GENERAL;

export function isUploadPurpose(value: string): value is UploadPurpose {
	return (UPLOAD_PURPOSES as readonly string[]).includes(value);
}
