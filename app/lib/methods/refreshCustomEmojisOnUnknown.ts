import { getCustomEmojis } from './getCustomEmojis';
import log from './helpers/log';

const REFRESH_THROTTLE_MS = 30_000;

let lastRefreshAt: number | null = null;

export const refreshCustomEmojisOnUnknown = (name?: string) => {
	if (!name) {
		return;
	}

	const now = Date.now();
	if (lastRefreshAt !== null && now - lastRefreshAt < REFRESH_THROTTLE_MS) {
		return;
	}

	lastRefreshAt = now;
	getCustomEmojis().catch(log);
};

export const resetUnknownCustomEmojiRefreshForTests = () => {
	lastRefreshAt = null;
};
