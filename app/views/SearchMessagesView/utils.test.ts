import {
	appendUniqueMessages,
	buildFileTitleSearchText,
	getMessageId,
	mergeUniqueMessages,
	normalizeSearchText,
	searchMessagesByTextAndFileTitle
} from './utils';

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

	describe('buildFileTitleSearchText', () => {
		it('wraps the query in Rocket.Chat file title search syntax', () => {
			expect(buildFileTitleSearchText('weekly report')).toBe('file-title:"weekly report"');
		});

		it('removes quotes because the server parser uses quotes as delimiters', () => {
			expect(buildFileTitleSearchText('  report "final"  ')).toBe('file-title:"report final"');
		});
	});

	describe('mergeUniqueMessages', () => {
		it('keeps text search order and appends only new file-title matches', () => {
			const textSearchMessages: { _id?: string; id?: string }[] = [{ _id: 'a' }, { _id: 'b' }];
			const fileTitleSearchMessages: { _id?: string; id?: string }[] = [{ _id: 'b' }, { id: 'c' }];

			expect(mergeUniqueMessages(textSearchMessages, fileTitleSearchMessages)).toEqual([{ _id: 'a' }, { _id: 'b' }, { id: 'c' }]);
		});
	});

	describe('searchMessagesByTextAndFileTitle', () => {
		it('searches message text and file title, then merges unique messages', async () => {
			const fetchMessages = jest.fn((searchText: string) => {
				if (searchText === 'report') {
					return Promise.resolve([{ _id: 'text-match' }, { _id: 'shared-match' }]);
				}
				if (searchText === 'file-title:"report"') {
					return Promise.resolve([{ _id: 'shared-match' }, { _id: 'file-title-match' }]);
				}
				return Promise.resolve([]);
			});

			await expect(searchMessagesByTextAndFileTitle('report', fetchMessages)).resolves.toEqual([
				{ _id: 'text-match' },
				{ _id: 'shared-match' },
				{ _id: 'file-title-match' }
			]);
			expect(fetchMessages).toHaveBeenNthCalledWith(1, 'report');
			expect(fetchMessages).toHaveBeenNthCalledWith(2, 'file-title:"report"');
		});

		it('does not request file title search when the sanitized file title query is empty', async () => {
			const fetchMessages = jest.fn(() => Promise.resolve([{ _id: 'text-match' }]));

			await expect(searchMessagesByTextAndFileTitle('""', fetchMessages)).resolves.toEqual([{ _id: 'text-match' }]);
			expect(fetchMessages).toHaveBeenCalledTimes(1);
			expect(fetchMessages).toHaveBeenCalledWith('""');
		});
	});
});
