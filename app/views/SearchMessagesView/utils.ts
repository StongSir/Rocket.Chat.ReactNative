type TSearchMessageLike = {
	_id?: string;
	id?: string;
};

export const normalizeSearchText = (searchText: string): string => searchText.trim();

export const getMessageId = (message: TSearchMessageLike): string => message._id ?? message.id ?? '';

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
