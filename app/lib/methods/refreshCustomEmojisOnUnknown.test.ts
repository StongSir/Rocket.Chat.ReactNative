import { refreshCustomEmojisOnUnknown, resetUnknownCustomEmojiRefreshForTests } from './refreshCustomEmojisOnUnknown';
import { getCustomEmojis } from './getCustomEmojis';

jest.mock('./getCustomEmojis', () => ({
	getCustomEmojis: jest.fn()
}));

const mockedGetCustomEmojis = getCustomEmojis as jest.MockedFunction<typeof getCustomEmojis>;

describe('refreshCustomEmojisOnUnknown', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(Date, 'now').mockReturnValue(1000);
		mockedGetCustomEmojis.mockResolvedValue();
		resetUnknownCustomEmojiRefreshForTests();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('refreshes custom emojis when an unknown emoji is rendered', () => {
		refreshCustomEmojisOnUnknown('u_new_emoji');

		expect(mockedGetCustomEmojis).toHaveBeenCalledTimes(1);
	});

	it('throttles repeated unknown emoji refreshes', () => {
		refreshCustomEmojisOnUnknown('u_first');
		refreshCustomEmojisOnUnknown('u_second');

		expect(mockedGetCustomEmojis).toHaveBeenCalledTimes(1);
	});

	it('allows another refresh after the throttle window', () => {
		refreshCustomEmojisOnUnknown('u_first');
		(Date.now as jest.Mock).mockReturnValue(31_001);
		refreshCustomEmojisOnUnknown('u_second');

		expect(mockedGetCustomEmojis).toHaveBeenCalledTimes(2);
	});
});
