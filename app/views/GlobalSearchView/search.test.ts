import {
	fetchGlobalSearchResults,
	getGlobalSearchMessagePreview,
	getGlobalSearchVisualState,
	getLocalGlobalSearchTextCondition,
	getSearchMessageId,
	resolveSearchResultRoomInfo
} from './search';

const serverMessage = {
	_id: 'server-message-id',
	rid: 'room-id',
	msg: 'hello from server',
	ts: new Date('2026-05-11T00:00:00.000Z'),
	u: {
		_id: 'user-id',
		username: 'alice',
		name: 'Alice'
	},
	r: {
		name: 'general',
		t: 'c'
	}
};

const serverMessageWithEjsonDate = {
	...serverMessage,
	ts: {
		$date: 1778457600000
	}
};

const serverFileMessage = {
	...serverMessage,
	_id: 'server-file-message-id',
	msg: '',
	attachments: [
		{
			title: 'weekly-report.pdf'
		}
	]
};

describe('GlobalSearchView search', () => {
	describe('getSearchMessageId', () => {
		it('uses _id from server messages', () => {
			expect(getSearchMessageId(serverMessage)).toBe('server-message-id');
		});

		it('uses id from local messages', () => {
			expect(getSearchMessageId({ id: 'local-message-id' })).toBe('local-message-id');
		});
	});

	describe('getGlobalSearchVisualState', () => {
		it('shows a full loading placeholder only while searching with no visible results', () => {
			expect(getGlobalSearchVisualState({ isSearching: true, resultCount: 0, searchText: 'hello' })).toEqual({
				showInputLoading: true,
				showFullLoading: true,
				showInlineLoading: false,
				showEmpty: false
			});
			expect(getGlobalSearchVisualState({ isSearching: false, resultCount: 0, searchText: 'hello' })).toEqual({
				showInputLoading: false,
				showFullLoading: false,
				showInlineLoading: false,
				showEmpty: true
			});
		});

		it('keeps current results visible and adds inline loading while a new search is running', () => {
			expect(getGlobalSearchVisualState({ isSearching: true, resultCount: 3, searchText: 'hello' })).toEqual({
				showInputLoading: true,
				showFullLoading: false,
				showInlineLoading: true,
				showEmpty: false
			});
		});
	});

	describe('getGlobalSearchMessagePreview', () => {
		it('uses message text when present', () => {
			expect(getGlobalSearchMessagePreview(serverMessage)).toBe('hello from server');
		});

		it('uses the first attachment title when the message text is empty', () => {
			expect(getGlobalSearchMessagePreview(serverFileMessage)).toBe('weekly-report.pdf');
		});
	});

	describe('getLocalGlobalSearchTextCondition', () => {
		it('matches local message text or serialized attachment data', () => {
			expect(getLocalGlobalSearchTextCondition('report')).toEqual({
				type: 'or',
				conditions: [
					{
						type: 'where',
						left: 'msg',
						comparison: {
							operator: 'like',
							right: { value: '%report%' }
						}
					},
					{
						type: 'where',
						left: 'attachments',
						comparison: {
							operator: 'like',
							right: { value: '%report%' }
						}
					}
				]
			});
		});
	});

	describe('fetchGlobalSearchResults', () => {
		it('uses Rocket.Chat beta global search for message text and file title when the provider enables it', async () => {
			const methodCallWrapper = jest
				.fn()
				.mockResolvedValueOnce({
					settings: {
						GlobalSearchEnabled: true
					}
				})
				.mockResolvedValueOnce({
					message: {
						docs: [serverMessage]
					}
				})
				.mockResolvedValueOnce({
					message: {
						docs: [serverMessage, serverFileMessage]
					}
				});
			const localSearch = jest.fn();

			const results = await fetchGlobalSearchResults({
				text: 'hello',
				userId: 'user-id',
				limit: 50,
				methodCallWrapper,
				localSearch
			});

			expect(methodCallWrapper).toHaveBeenNthCalledWith(1, 'rocketchatSearch.getProvider');
			expect(methodCallWrapper).toHaveBeenNthCalledWith(
				2,
				'rocketchatSearch.search',
				'hello',
				{ uid: 'user-id', rid: '' },
				{ limit: 50, searchAll: true }
			);
			expect(methodCallWrapper).toHaveBeenNthCalledWith(
				3,
				'rocketchatSearch.search',
				'file-title:"hello"',
				{ uid: 'user-id', rid: '' },
				{ limit: 50, searchAll: true }
			);
			expect(localSearch).not.toHaveBeenCalled();
			expect(results).toEqual([
				{
					message: serverMessage,
					roomName: 'general',
					roomType: 'c',
					rid: 'room-id'
				},
				{
					message: serverFileMessage,
					roomName: 'general',
					roomType: 'c',
					rid: 'room-id'
				}
			]);
		});

		it('normalizes EJSON dates returned by method calls', async () => {
			const methodCallWrapper = jest
				.fn()
				.mockResolvedValueOnce({
					settings: {
						GlobalSearchEnabled: true
					}
				})
				.mockResolvedValueOnce({
					message: {
						docs: [serverMessageWithEjsonDate]
					}
				})
				.mockResolvedValueOnce({
					message: {
						docs: []
					}
				});

			const [result] = await fetchGlobalSearchResults({
				text: 'hello',
				userId: 'user-id',
				limit: 50,
				methodCallWrapper,
				localSearch: jest.fn()
			});

			expect(result.message.ts).toEqual(new Date(1778457600000));
		});

		it('falls back to local search when the server provider has global search disabled', async () => {
			const localResults = [
				{
					message: { id: 'local-message-id', rid: 'local-room-id' },
					roomName: 'local-room',
					roomType: 'p',
					rid: 'local-room-id'
				}
			];
			const methodCallWrapper = jest.fn().mockResolvedValue({
				settings: {
					GlobalSearchEnabled: false
				}
			});
			const localSearch = jest.fn().mockResolvedValue(localResults);

			await expect(
				fetchGlobalSearchResults({
					text: 'hello',
					userId: 'user-id',
					limit: 50,
					methodCallWrapper,
					localSearch
				})
			).resolves.toEqual(localResults);
			expect(methodCallWrapper).toHaveBeenCalledWith('rocketchatSearch.getProvider');
			expect(localSearch).toHaveBeenCalledWith('hello');
		});
	});

	describe('resolveSearchResultRoomInfo', () => {
		it('uses local subscription title instead of the server room slug when available', async () => {
			const subscription = {
				rid: 'room-id',
				t: 'p',
				name: 'ce4-shi4-yi1-hao4-qun2',
				fname: '测试群'
			};

			const [result] = await resolveSearchResultRoomInfo(
				[
					{
						message: serverMessage,
						roomName: 'ce4-shi4-yi1-hao4-qun2',
						roomType: 'p',
						rid: 'room-id'
					}
				],
				jest.fn().mockResolvedValue(subscription),
				sub => sub.fname || sub.name
			);

			expect(result).toEqual({
				message: serverMessage,
				roomName: '测试群',
				roomType: 'p',
				subscription,
				rid: 'room-id'
			});
		});
	});
});
