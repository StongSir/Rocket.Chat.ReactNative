import { useCallback, useEffect, useState } from 'react';

import { type ICustomEmoji } from '../../definitions';
import log from '../methods/helpers/log';
import { listMyCustomEmojis } from '../services/customEmojiService';

const sortNewestFirst = (items: ICustomEmoji[]) =>
	[...items].sort((a, b) => {
		const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		if (createdAtA !== createdAtB) {
			return createdAtB - createdAtA;
		}
		return Number(b.id || 0) - Number(a.id || 0);
	});

export const useUserCustomEmojis = (enabled = true) => {
	const [emojis, setEmojis] = useState<ICustomEmoji[]>([]);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) {
			setEmojis([]);
			return;
		}
		setLoading(true);
		try {
			const items = await listMyCustomEmojis();
			setEmojis(sortNewestFirst(items));
		} catch (e) {
			log(e);
			setEmojis([]);
		} finally {
			setLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { emojis, loading, refresh };
};
