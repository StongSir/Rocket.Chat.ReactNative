type TSearchMessageLike = {
	_id?: string;
	id?: string;
};

export const normalizeSearchText = (searchText: string): string => searchText.trim();

export const getMessageId = (message: TSearchMessageLike): string => message._id ?? message.id ?? '';

export const buildFileTitleSearchText = (searchText: string): string => {
	const normalizedSearchText = normalizeSearchText(searchText.replace(/"/g, ' ').replace(/\s+/g, ' '));

	return normalizedSearchText ? `file-title:"${normalizedSearchText}"` : '';
};

export const appendUniqueMessages = <T extends TSearchMessageLike>(currentMessages: T[], incomingMessages: T[]): T[] => {
	const messageIds = new Set(currentMessages.map(getMessageId).filter(Boolean));
	const uniqueIncomingMessages = incomingMessages.filter(message => {
		const messageId = getMessageId(message);
		if (!messageId || messageIds.has(messageId)) {
			return false;
		}
		messageIds.add(messageId);
		return true;
	});

	return [...currentMessages, ...uniqueIncomingMessages];
};

export const mergeUniqueMessages = <T extends TSearchMessageLike>(...messageGroups: T[][]): T[] =>
	messageGroups.reduce<T[]>((messages, incomingMessages) => appendUniqueMessages(messages, incomingMessages), []);

export const searchMessagesByTextAndFileTitle = async <T extends TSearchMessageLike>(
	searchText: string,
	fetchMessages: (searchText: string) => Promise<T[]>
): Promise<T[]> => {
	const normalizedSearchText = normalizeSearchText(searchText);
	const fileTitleSearchText = buildFileTitleSearchText(normalizedSearchText);
	if (!fileTitleSearchText) {
		return fetchMessages(normalizedSearchText);
	}

	const [textMessages, fileTitleMessages] = await Promise.all([
		fetchMessages(normalizedSearchText),
		fetchMessages(fileTitleSearchText)
	]);

	return mergeUniqueMessages(textMessages, fileTitleMessages);
};
