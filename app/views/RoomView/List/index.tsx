import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { useDebounce } from '../../../lib/methods/helpers';
import { debugSearchJump } from '../../../lib/methods/helpers/debugSearchJump';
import EmptyRoom from './components/EmptyRoom';
import List from './components/List';
import { type IListContainerProps, type IListContainerRef, type IListProps } from './definitions';
import { useMessages, useScroll } from './hooks';
import { shouldHandleJumpWindowBoundary } from './utils';

const BOUNDARY_EXPANSION_SUPPRESSION_MS = 1200;

const ListContainer = forwardRef<IListContainerRef, IListContainerProps>(
	({ rid, tmid, renderRow, showMessageInMainThread, serverVersion, hideSystemMessages, listRef }, ref) => {
		const isBoundaryExpansionSuppressed = useRef(false);
		const boundaryExpansionSuppressionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
		const [messages, messagesIds, fetchMessages, loadMessage, isJumpWindow, expandJumpWindow] = useMessages({
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

		useEffect(
			() => () => {
				if (boundaryExpansionSuppressionTimeout.current) {
					clearTimeout(boundaryExpansionSuppressionTimeout.current);
				}
			},
			[]
		);

		const suppressBoundaryExpansion = () => {
			isBoundaryExpansionSuppressed.current = true;
			if (boundaryExpansionSuppressionTimeout.current) {
				clearTimeout(boundaryExpansionSuppressionTimeout.current);
			}
			boundaryExpansionSuppressionTimeout.current = setTimeout(() => {
				isBoundaryExpansionSuppressed.current = false;
			}, BOUNDARY_EXPANSION_SUPPRESSION_MS);
		};

		const expandJumpWindowOnBoundary = useDebounce(() => {
			if (
				!shouldHandleJumpWindowBoundary({ isJumpWindow, isBoundaryExpansionSuppressed: isBoundaryExpansionSuppressed.current })
			) {
				debugSearchJump('ListContainer.boundaryReached.skipped', {
					isJumpWindow,
					isBoundaryExpansionSuppressed: isBoundaryExpansionSuppressed.current
				});
				return;
			}
			debugSearchJump('ListContainer.boundaryReached.expandJumpWindow');
			expandJumpWindow();
		}, 300);

		const onEndReached = useDebounce(() => {
			if (isJumpWindow) {
				debugSearchJump('ListContainer.onEndReached.jumpWindowBoundary');
				expandJumpWindowOnBoundary();
				return;
			}
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
				suppressBoundaryExpansion();
				await scrollJumpToMessage(messageId);
				debugSearchJump('ListContainer.scrollJumpToMessage.done', { messageId });
			},
			cancelJumpToMessage
		}));

		const renderItem: IListProps['renderItem'] = ({ item, index }) =>
			renderRow(item, messages[index + 1], highlightedMessageId, isJumpWindow);

		return (
			<>
				<EmptyRoom rid={rid} length={messages.length} />
				<List
					listRef={listRef}
					data={messages}
					renderItem={renderItem}
					onEndReached={onEndReached}
					onScrollBoundaryReached={isJumpWindow ? expandJumpWindowOnBoundary : undefined}
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
