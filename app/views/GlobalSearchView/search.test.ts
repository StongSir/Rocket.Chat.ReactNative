import { fetchGlobalSearchResults, getSearchMessageId, resolveSearchResultRoomInfo } from './search';

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

describe('GlobalSearchView search', () => {
	describe('getSearchMessageId', () => {
		it('uses _id from server messages', () => {
			expect(getSearchMessageId(serverMessage)).toBe('server-message-id');
		});

		it('uses id from local messages', () => {
			expect(getSearchMessageId({ id: 'local-message-id' })).toBe('local-message-id');
		});
	});

	describe('fetchGlobalSearchResults', () => {
		it('uses Rocket.Chat beta global search when the provider enables it', async () => {
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
			expect(localSearch).not.toHaveBeenCalled();
			expect(results).toEqual([
				{
					message: serverMessage,
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
