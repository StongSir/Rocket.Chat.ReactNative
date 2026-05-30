import { type ICustomEmojis } from '../../definitions';

const CUSTOM_EMOJI_SHORTNAME_REGEX = /:([a-zA-Z0-9_+-]+):/g;

export const extractCollectableCustomEmojiNames = (messageText = '', customEmojis: ICustomEmojis = {}): string[] => {
	const names = new Set<string>();
	let match: RegExpExecArray | null;

	while ((match = CUSTOM_EMOJI_SHORTNAME_REGEX.exec(messageText))) {
		const name = match[1];
		if (customEmojis[name]) {
			names.add(name);
		}
	}

	return Array.from(names);
};
