import { extractCollectableCustomEmojiNames } from './customEmojiCollect';

describe('extractCollectableCustomEmojiNames', () => {
	it('returns unique custom emoji names from a message', () => {
		const result = extractCollectableCustomEmojiNames('hello :u_first: :smile: :u_first: :u_second:', {
			u_first: { name: 'u_first', extension: 'png' },
			u_second: { name: 'u_second', extension: 'gif' }
		});

		expect(result).toEqual(['u_first', 'u_second']);
	});

	it('ignores unicode emoji shortnames and unknown custom emoji names', () => {
		const result = extractCollectableCustomEmojiNames(':heart: :unknown_custom:', {
			u_first: { name: 'u_first', extension: 'png' }
		});

		expect(result).toEqual([]);
	});
});
