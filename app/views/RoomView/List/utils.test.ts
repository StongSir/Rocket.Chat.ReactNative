import { getJumpToMessageFetchCount, shouldUseJumpWindow } from './utils';

describe('RoomView List utils', () => {
	describe('getJumpToMessageFetchCount', () => {
		it('keeps the current count when the message is already loaded', () => {
			expect(getJumpToMessageFetchCount({ countNewer: 20, currentCount: 50, querySize: 50 })).toBe(50);
		});

		it('expands past the target message when it is older than the loaded range', () => {
			expect(getJumpToMessageFetchCount({ countNewer: 125, currentCount: 50, querySize: 50 })).toBe(175);
		});
	});

	describe('shouldUseJumpWindow', () => {
		it('keeps normal loading for nearby messages', () => {
			expect(shouldUseJumpWindow({ forceCount: 300, querySize: 50 })).toBe(false);
		});

		it('uses a local window for far historical messages', () => {
			expect(shouldUseJumpWindow({ forceCount: 301, querySize: 50 })).toBe(true);
		});
	});
});
