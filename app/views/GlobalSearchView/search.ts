import type { SubscriptionType, TMessageModel, TSubscriptionModel } from '../../definitions';

export type TGlobalSearchMessage = Partial<TMessageModel> & {
	_id?: string;
	id?: string;
	rid?: string;
	ts?: TMessageModel['ts'] | { $date: string | number };
	_raw?: {
		rid?: string;
	};
	r?: {
		name?: string;
		t?: SubscriptionType | string;
	};
};

export interface IGlobalSearchResult {
	message: TGlobalSearchMessage;
	roomName: string;
	roomType: SubscriptionType | string;
	subscription?: TSubscriptionModel;
	rid: string;
}

export const getGlobalSearchVisualState = ({
	isSearching,
	resultCount,
	searchText
}: {
	isSearching: boolean;
	resultCount: number;
	searchText: string;
}) => {
	const hasSearchText = searchText.trim().length > 0;
	return {
		showInputLoading: isSearching && hasSearchText,
		showFullLoading: isSearching && hasSearchText && resultCount === 0,
		showInlineLoading: isSearching && hasSearchText && resultCount > 0,
		showEmpty: !isSearching && hasSearchText && resultCount === 0
	};
};

type TSearchProvider = {
	settings?: {
		GlobalSearchEnabled?: boolean;
	};
};

type TServerSearchResponse = {
	message?: {
		docs?: TGlobalSearchMessage[];
	};
};

type TMethodCallWrapper = (method: string, ...params: any[]) => Promise<any>;

export const getSearchMessageId = (message: Pick<TGlobalSearchMessage, '_id' | 'id'>): string => message._id ?? message.id ?? '';

export const getSearchMessageRid = (message: TGlobalSearchMessage): string => message.rid ?? message._raw?.rid ?? '';

const normalizeSearchMessage = (message: TGlobalSearchMessage): TGlobalSearchMessage => {
	if (message.ts && typeof message.ts === 'object' && '$date' in message.ts) {
		return {
			...message,
			ts: new Date(message.ts.$date)
		};
	}
	return message;
};

const mapServerMessageToResult = (message: TGlobalSearchMessage): IGlobalSearchResult | null => {
	const normalizedMessage = normalizeSearchMessage(message);
	const rid = getSearchMessageRid(normalizedMessage);
	const messageId = getSearchMessageId(normalizedMessage);
	if (!rid || !messageId) {
		return null;
	}
	return {
		message: normalizedMessage,
		roomName: normalizedMessage.r?.name || rid,
		roomType: normalizedMessage.r?.t || '',
		rid
	};
};

const mapServerSearchResults = (response: TServerSearchResponse): IGlobalSearchResult[] =>
	(response.message?.docs ?? []).map(mapServerMessageToResult).filter((result): result is IGlobalSearchResult => result !== null);

const isGlobalSearchEnabled = (provider: TSearchProvider | undefined): boolean =>
	provider?.settings?.GlobalSearchEnabled === true;

export const fetchGlobalSearchResults = async ({
	text,
	userId,
	limit,
	methodCallWrapper,
	localSearch
}: {
	text: string;
	userId?: string;
	limit: number;
	methodCallWrapper: TMethodCallWrapper;
	localSearch: (text: string) => Promise<IGlobalSearchResult[]>;
}): Promise<IGlobalSearchResult[]> => {
	const searchText = text.trim();
	if (!searchText) {
		return [];
	}

	try {
		const provider = (await methodCallWrapper('rocketchatSearch.getProvider')) as TSearchProvider | undefined;
		if (isGlobalSearchEnabled(provider)) {
			const response = (await methodCallWrapper(
				'rocketchatSearch.search',
				searchText,
				{ uid: userId, rid: '' },
				{ limit, searchAll: true }
			)) as TServerSearchResponse;
			return mapServerSearchResults(response);
		}
	} catch {
		// Fall through to local search when the server method is unavailable or fails.
	}

	return localSearch(searchText);
};

export const resolveSearchResultRoomInfo = (
	results: IGlobalSearchResult[],
	getSubscriptionByRoomId: (rid: string) => Promise<TSubscriptionModel | null>,
	getRoomTitle: (subscription: TSubscriptionModel) => string
): Promise<IGlobalSearchResult[]> =>
	Promise.all(
		results.map(async result => {
			let { subscription }: { subscription?: TSubscriptionModel | null } = result;
			if (!subscription) {
				subscription = await getSubscriptionByRoomId(result.rid);
			}
			if (!subscription) {
				return result;
			}

			return {
				...result,
				roomName: getRoomTitle(subscription),
				roomType: subscription.t || result.roomType,
				subscription
			};
		})
	);
