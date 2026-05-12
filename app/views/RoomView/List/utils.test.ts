import { MessageTypeLoad } from '../../../lib/constants/messageTypeLoad';
import {
	getExpandedJumpWindowSideSize,
	getJumpToMessageFetchCount,
	getJumpWindowMessages,
	getScrollToIndexFailedOffset,
	shouldUseJumpWindow
} from './utils';

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
			expect(shouldUseJumpWindow({ forceCount: 150, querySize: 50 })).toBe(false);
		});

		it('uses a local window for far historical messages', () => {
			expect(shouldUseJumpWindow({ forceCount: 151, querySize: 50 })).toBe(true);
		});
	});

	describe('getScrollToIndexFailedOffset', () => {
		it('estimates an offset from the target index and average item length', () => {
			expect(getScrollToIndexFailedOffset({ index: 177, averageItemLength: 137.5 })).toBe(24337.5);
		});

		it('never returns a negative offset', () => {
			expect(getScrollToIndexFailedOffset({ index: -1, averageItemLength: 137.5 })).toBe(0);
		});
	});

	describe('getJumpWindowMessages', () => {
		it('keeps a historical jump window bounded by load markers around the target message', () => {
			const messages = [
				{ id: 'newest' },
				{ id: 'next-loader', t: MessageTypeLoad.NEXT_CHUNK },
				{ id: 'newer' },
				{ id: 'target' },
				{ id: 'older' },
				{ id: 'previous-loader', t: MessageTypeLoad.PREVIOUS_CHUNK },
				{ id: 'oldest' }
			] as any;

			expect(getJumpWindowMessages(messages, 'target').map((message: { id: string }) => message.id)).toEqual([
				'next-loader',
				'newer',
				'target',
				'older',
				'previous-loader'
			]);
		});

		it('limits a large cached range around the target when no load markers are nearby', () => {
			const messages = Array.from({ length: 380 }, (_, index) => ({ id: `message-${index}` })) as any;

			const windowMessages = getJumpWindowMessages(messages, 'message-233');

			expect(windowMessages).toHaveLength(51);
			expect(windowMessages[0].id).toBe('message-208');
			expect(windowMessages[25].id).toBe('message-233');
			expect(windowMessages[50].id).toBe('message-258');
		});
	});

	describe('getExpandedJumpWindowSideSize', () => {
		it('expands the jump window by one side chunk at a time', () => {
			expect(getExpandedJumpWindowSideSize(25)).toBe(50);
			expect(getExpandedJumpWindowSideSize(50)).toBe(75);
		});
	});
});
