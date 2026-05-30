import { initStore } from '../store/auxStore';
import { mockedStore } from '../../reducers/mockedStore';
import { setUser } from '../../actions/login';
import { selectServerSuccess } from '../../actions/server';
import { deleteMyCustomEmoji, getCustomEmojiServiceErrorMessage } from './customEmojiService';

describe('customEmojiService', () => {
	beforeEach(() => {
		initStore(mockedStore);
		mockedStore.dispatch(selectServerSuccess({ server: 'https://chat.example.com', version: '8.3.0', name: 'test' }));
		mockedStore.dispatch(setUser({ id: 'user-id', token: 'auth-token' }));
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: jest.fn().mockResolvedValue({ success: true })
		}) as any;
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('deletes a custom emoji relation with Rocket.Chat auth headers', async () => {
		await deleteMyCustomEmoji('emoji-relation-id');

		expect(global.fetch).toHaveBeenCalledWith(
			'https://chat.example.com/emoji-api/v1/me/emojis/emoji-relation-id',
			expect.objectContaining({
				method: 'DELETE',
				headers: expect.objectContaining({
					'X-User-Id': 'user-id',
					'X-Auth-Token': 'auth-token'
				})
			})
		);
	});

	it('maps service error codes to user-facing Chinese messages', () => {
		expect(getCustomEmojiServiceErrorMessage(new Error('{"success":false,"error":"file_too_large"}'))).toBe(
			'文件过大，请选择更小的图片'
		);
		expect(getCustomEmojiServiceErrorMessage(new Error('{"success":false,"error":"already_collected"}'))).toBe('已在我的表情中');
		expect(getCustomEmojiServiceErrorMessage(new Error('plain network failure'))).toBe('表情服务异常，请稍后重试');
	});
});
