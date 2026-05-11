import { appendUniqueMessages, getMessageId, normalizeSearchText } from './utils';

describe('SearchMessagesView utils', () => {
	describe('normalizeSearchText', () => {
		it('trims whitespace around the query', () => {
			expect(normalizeSearchText('  rocket  ')).toBe('rocket');
		});
	});

	describe('getMessageId', () => {
		it('uses _id from server messages', () => {
			expect(getMessageId({ _id: 'server-message-id' })).toBe('server-message-id');
		});

		it('uses id from local database messages', () => {
			expect(getMessageId({ id: 'local-message-id' })).toBe('local-message-id');
		});
	});

	describe('appendUniqueMessages', () => {
		it('keeps existing messages and appends only new message ids', () => {
			const existingMessages: { _id?: string; id?: string }[] = [{ _id: 'a' }, { _id: 'b' }];
			const incomingMessages: { _id?: string; id?: string }[] = [{ _id: 'b' }, { id: 'c' }];

			expect(appendUniqueMessages(existingMessages, incomingMessages)).toEqual([{ _id: 'a' }, { _id: 'b' }, { id: 'c' }]);
		});
	});
});
