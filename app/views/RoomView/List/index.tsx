import React, { forwardRef, useImperativeHandle } from 'react';

import { useDebounce } from '../../../lib/methods/helpers';
import { debugSearchJump } from '../../../lib/methods/helpers/debugSearchJump';
import EmptyRoom from './components/EmptyRoom';
import List from './components/List';
import { type IListContainerProps, type IListContainerRef, type IListProps } from './definitions';
import { useMessages, useScroll } from './hooks';

const ListContainer = forwardRef<IListContainerRef, IListContainerProps>(
	({ rid, tmid, renderRow, showMessageInMainThread, serverVersion, hideSystemMessages, listRef }, ref) => {
		const [messages, messagesIds, fetchMessages, loadMessage] = useMessages({
			rid,
			tmid,
			showMessageInMainThread,
			serverVersion,
			hideSystemMessages
		});
		const {
			jumpToBottom,
			jumpToMessage: scrollJumpToMessage,
			cancelJumpToMessage,
			viewabilityConfigCallbackPairs,
			handleScrollToIndexFailed,
			highlightedMessageId
		} = useScroll({ listRef, messagesIds });

		const onEndReached = useDebounce(() => {
			fetchMessages();
		}, 300);

		useImperativeHandle(ref, () => ({
			jumpToMessage: async (messageId: string) => {
				debugSearchJump('ListContainer.jumpToMessage.start', { messageId });
				await loadMessage(messageId);
				debugSearchJump('ListContainer.loadMessage.done', {
					messageId,
					loaded: messagesIds.current.includes(messageId),
					count: messagesIds.current.length
				});
				await scrollJumpToMessage(messageId);
				debugSearchJump('ListContainer.scrollJumpToMessage.done', { messageId });
			},
			cancelJumpToMessage
		}));

		const renderItem: IListProps['renderItem'] = ({ item, index }) => renderRow(item, messages[index + 1], highlightedMessageId);

		return (
			<>
				<EmptyRoom rid={rid} length={messages.length} />
				<List
					listRef={listRef}
					data={messages}
					renderItem={renderItem}
					onEndReached={onEndReached}
					onScrollToIndexFailed={handleScrollToIndexFailed}
					viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
					jumpToBottom={jumpToBottom}
					maintainVisibleContentPosition={{
						minIndexForVisible: 0,
						autoscrollToTopThreshold: 0
					}}
				/>
			</>
		);
	}
);

export default ListContainer;
