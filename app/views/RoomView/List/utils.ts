import { QUERY_SIZE } from './constants';
import { type TAnyMessageModel } from '../../../definitions';
import { MessageTypeLoad } from '../../../lib/constants/messageTypeLoad';

export const JUMP_WINDOW_SIDE_SIZE = 25;

export const getExpandedJumpWindowSideSize = (currentSideSize: number, increment = JUMP_WINDOW_SIDE_SIZE) =>
	currentSideSize + increment;

export const getJumpToMessageFetchCount = ({
	countNewer,
	currentCount,
	querySize = QUERY_SIZE
}: {
	countNewer: number;
	currentCount: number;
	querySize?: number;
}) => {
	if (countNewer < currentCount) {
		return currentCount;
	}
	return countNewer + querySize;
};

export const shouldUseJumpWindow = ({ forceCount, querySize = QUERY_SIZE }: { forceCount: number; querySize?: number }) =>
	forceCount > querySize * 3;

export const getScrollToIndexFailedOffset = ({
	index,
	averageItemLength
}: {
	index: number;
	averageItemLength: number;
}) => Math.max(0, index * averageItemLength);

export const getJumpWindowMessages = (messages: TAnyMessageModel[], targetMessageId: string, sideSize = JUMP_WINDOW_SIDE_SIZE) => {
	const targetIndex = messages.findIndex(message => message.id === targetMessageId);
	if (targetIndex === -1) {
		return [];
	}

	let startIndex = Math.max(0, targetIndex - sideSize);
	for (let i = targetIndex - 1; i >= 0; i--) {
		if (messages[i].t === MessageTypeLoad.NEXT_CHUNK) {
			startIndex = Math.max(i, startIndex);
			break;
		}
	}

	let endIndex = Math.min(messages.length - 1, targetIndex + sideSize);
	for (let i = targetIndex + 1; i < messages.length; i++) {
		if ([MessageTypeLoad.MORE, MessageTypeLoad.PREVIOUS_CHUNK].includes(messages[i].t as MessageTypeLoad)) {
			endIndex = Math.min(i, endIndex);
			break;
		}
	}

	return messages.slice(startIndex, endIndex + 1);
};
