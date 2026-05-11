import { QUERY_SIZE } from './constants';

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
	forceCount > querySize * 6;
