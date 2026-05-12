import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { type Subscription } from 'rxjs';

import { type TAnyMessageModel } from '../../../../definitions';
import database from '../../../../lib/database';
import { getMessageById } from '../../../../lib/database/services/Message';
import { getThreadById } from '../../../../lib/database/services/Thread';
import { compareServerVersion, useDebounce } from '../../../../lib/methods/helpers';
import { debugSearchJump } from '../../../../lib/methods/helpers/debugSearchJump';
import { readThreads } from '../../../../lib/services/restApi';
import {
	getExpandedJumpWindowSideSize,
	getJumpToMessageFetchCount,
	getJumpWindowMessages,
	JUMP_WINDOW_SIDE_SIZE,
	shouldUseJumpWindow
} from '../utils';
import { QUERY_SIZE } from '../constants';

export const useMessages = ({
	rid,
	tmid,
	showMessageInMainThread,
	serverVersion,
	hideSystemMessages
}: {
	rid: string;
	tmid?: string;
	showMessageInMainThread: boolean;
	serverVersion: string | null;
	hideSystemMessages: string[];
}) => {
	const [messages, setMessages] = useState<TAnyMessageModel[]>([]);
	const [isJumpWindow, setIsJumpWindow] = useState(false);
	const thread = useRef<TAnyMessageModel | null>(null);
	const count = useRef(0);
	const subscription = useRef<Subscription | null>(null);
	const messagesIds = useRef<string[]>([]);
	const renderResolvers = useRef<(() => void)[]>([]);
	const jumpWindowSourceMessages = useRef<TAnyMessageModel[]>([]);
	const jumpWindowTargetMessageId = useRef<string | null>(null);
	const jumpWindowSideSize = useRef(JUMP_WINDOW_SIDE_SIZE);

	const fetchMessages = useCallback(async (forceCount?: number) => {
		unsubscribe();
		setIsJumpWindow(false);
		jumpWindowSourceMessages.current = [];
		jumpWindowTargetMessageId.current = null;
		jumpWindowSideSize.current = JUMP_WINDOW_SIDE_SIZE;
		count.current = forceCount || (count.current + QUERY_SIZE);

		if (!rid) {
			return;
		}

		const db = database.active;
		let observable;
		if (tmid) {
			// If the thread doesn't exist yet, we fetch it from messages, but trying to get it from threads when possible.
			// As soon as we have it from threads table, we use it from cache only and never query again.
			if (!thread.current || thread.current.collection.table !== 'threads') {
				thread.current = await getThreadById(tmid);
				if (!thread.current) {
					thread.current = await getMessageById(tmid);
				}
			}
			observable = db
				.get('thread_messages')
				.query(Q.where('rid', tmid), Q.sortBy('ts', Q.desc), Q.skip(0), Q.take(count.current))
				.observe();
		} else {
			const whereClause = [Q.where('rid', rid), Q.sortBy('ts', Q.desc), Q.skip(0), Q.take(count.current)] as (
				| Q.WhereDescription
				| Q.Or
			)[];
			if (!showMessageInMainThread) {
				whereClause.push(Q.or(Q.where('tmid', null), Q.where('tshow', Q.eq(true))));
			}
			observable = db
				.get('messages')
				.query(...whereClause)
				.observe();
		}

		subscription.current = observable.subscribe(result => {
			let newMessages: TAnyMessageModel[] = result;
			if (tmid && thread.current) {
				newMessages.push(thread.current);
			}

			/**
			 * Since 3.16.0 server version, the backend don't response with messages if
			 * hide system message is enabled
			 */
			if (compareServerVersion(serverVersion, 'lowerThan', '3.16.0') || hideSystemMessages.length) {
				newMessages = newMessages.filter(m => !m.t || !hideSystemMessages?.includes(m.t));
			}

			readThread();
			setMessages(newMessages);
			messagesIds.current = newMessages.map(m => m.id);
		});
	}, [rid, tmid, showMessageInMainThread, serverVersion, hideSystemMessages]);

	const readThread = useDebounce(async () => {
		if (tmid) {
			try {
				await readThreads(tmid);
			} catch {
				// Do nothing
			}
		}
	}, 1000);

	useLayoutEffect(() => {
		const resolvers = renderResolvers.current;
		renderResolvers.current = [];
		resolvers.forEach(resolve => resolve());
	}, [messages]);

	useLayoutEffect(() => {
		fetchMessages();

		return () => {
			unsubscribe();
		};
	}, [rid, tmid, showMessageInMainThread, serverVersion, hideSystemMessages, fetchMessages]);

	const unsubscribe = () => {
		subscription.current?.unsubscribe();
	};

	const updateMessagesState = useCallback((newMessages: TAnyMessageModel[]) => {
		setMessages(newMessages);
		messagesIds.current = newMessages.map(m => m.id);
	}, []);

	const filterMessages = useCallback(
		(newMessages: TAnyMessageModel[]) => {
			if (compareServerVersion(serverVersion, 'lowerThan', '3.16.0') || hideSystemMessages.length) {
				return newMessages.filter(m => !m.t || !hideSystemMessages?.includes(m.t));
			}
			return newMessages;
		},
		[serverVersion, hideSystemMessages]
	);

	const subscribeJumpWindow = useCallback(
		async (targetMessageId: string) => {
			unsubscribe();
			setIsJumpWindow(true);
			jumpWindowTargetMessageId.current = targetMessageId;
			jumpWindowSideSize.current = JUMP_WINDOW_SIDE_SIZE;
			const db = database.active;
			const whereClause = [Q.where('rid', rid), Q.sortBy('ts', Q.desc)] as (Q.WhereDescription | Q.Or)[];
			if (!showMessageInMainThread) {
				whereClause.push(Q.or(Q.where('tmid', null), Q.where('tshow', Q.eq(true))));
			}
			const observable = db.get('messages').query(...whereClause).observe();
			subscription.current = observable.subscribe(result => {
				const filteredMessages = filterMessages(result as TAnyMessageModel[]);
				jumpWindowSourceMessages.current = filteredMessages;
				const jumpMessages = getJumpWindowMessages(filteredMessages, targetMessageId, jumpWindowSideSize.current);
				const targetIndex = jumpMessages.findIndex(message => message.id === targetMessageId);
				count.current = jumpMessages.length;
				debugSearchJump('useMessages.subscribeJumpWindow.update', {
					messageId: targetMessageId,
					count: jumpMessages.length,
					targetIndex,
					hasTarget: jumpMessages.some(item => item.id === targetMessageId),
					first: jumpMessages[0]?.id,
					last: jumpMessages[jumpMessages.length - 1]?.id
				});
				updateMessagesState(jumpMessages);
			});
		},
		[rid, showMessageInMainThread, filterMessages, updateMessagesState]
	);

	const expandJumpWindow = useCallback(() => {
		const targetMessageId = jumpWindowTargetMessageId.current;
		if (!targetMessageId || !jumpWindowSourceMessages.current.length) {
			debugSearchJump('useMessages.expandJumpWindow.skipped', { targetMessageId });
			return;
		}
		jumpWindowSideSize.current = getExpandedJumpWindowSideSize(jumpWindowSideSize.current);
		const jumpMessages = getJumpWindowMessages(
			jumpWindowSourceMessages.current,
			targetMessageId,
			jumpWindowSideSize.current
		);
		const targetIndex = jumpMessages.findIndex(message => message.id === targetMessageId);
		count.current = jumpMessages.length;
		debugSearchJump('useMessages.expandJumpWindow.done', {
			messageId: targetMessageId,
			sideSize: jumpWindowSideSize.current,
			count: jumpMessages.length,
			targetIndex,
			first: jumpMessages[0]?.id,
			last: jumpMessages[jumpMessages.length - 1]?.id
		});
		updateMessagesState(jumpMessages);
	}, [updateMessagesState]);

	const waitForMessagesRender = useCallback(
		() =>
			new Promise<void>(resolve => {
				const timeout = setTimeout(resolve, 1000);
				renderResolvers.current.push(() => {
					clearTimeout(timeout);
					resolve();
				});
			}),
		[]
	);

	const getMainRoomWhereClause = useCallback(
		(operator: Q.Comparison) => {
			const whereClause = [Q.where('rid', rid), Q.where('ts', operator)] as (Q.WhereDescription | Q.Or)[];
			if (!showMessageInMainThread) {
				whereClause.push(Q.or(Q.where('tmid', null), Q.where('tshow', Q.eq(true))));
			}
			return whereClause;
		},
		[rid, showMessageInMainThread]
	);

	const loadMessageWindow = useCallback(
		async (message: TAnyMessageModel, messageDate: number) => {
			unsubscribe();
			if (!tmid) {
				await subscribeJumpWindow(message.id);
				return;
			}

			const db = database.active;
			const newerMessages = (await db
				.get('thread_messages')
				.query(Q.where('rid', tmid), Q.where('ts', Q.gt(messageDate)), Q.sortBy('ts', Q.asc), Q.take(JUMP_WINDOW_SIDE_SIZE))
				.fetch()) as TAnyMessageModel[];
			const olderMessages = (await db
				.get('thread_messages')
				.query(Q.where('rid', tmid), Q.where('ts', Q.lte(messageDate)), Q.sortBy('ts', Q.desc), Q.take(JUMP_WINDOW_SIDE_SIZE))
				.fetch()) as TAnyMessageModel[];

			const messageMap = new Map<string, TAnyMessageModel>();
			[...newerMessages, message, ...olderMessages].forEach(item => {
				messageMap.set(item.id, item);
			});
			const newMessages = Array.from(messageMap.values()).sort((a, b) => {
				const aTime = a.ts instanceof Date ? a.ts.getTime() : new Date(a.ts).getTime();
				const bTime = b.ts instanceof Date ? b.ts.getTime() : new Date(b.ts).getTime();
				return bTime - aTime;
			});
			count.current = newMessages.length;
			setIsJumpWindow(true);
			debugSearchJump('useMessages.loadMessageWindow', {
				messageId: message.id,
				count: newMessages.length,
				hasTarget: newMessages.some(item => item.id === message.id),
				newerCount: newerMessages.length,
				olderCount: olderMessages.length
			});
			updateMessagesState(newMessages);
		},
		[tmid, subscribeJumpWindow, updateMessagesState]
	);

	const waitUntilMessageIsLoaded = useCallback(
		(messageId: string) =>
			new Promise<void>(resolve => {
				if (messagesIds.current.includes(messageId)) {
					resolve();
					return;
				}
				const interval = setInterval(() => {
					if (messagesIds.current.includes(messageId)) {
						clearInterval(interval);
						resolve();
					}
				}, 100);
				setTimeout(() => {
					clearInterval(interval);
					resolve();
				}, 5000);
			}),
		[]
	);

	const loadMessage = useCallback(async (messageId: string) => {
		const db = database.active;
		let message: TAnyMessageModel | null = null;

		if (tmid) {
			// @ts-ignore
			message = await db.get('thread_messages').find(messageId).catch(() => null);
		} else {
			message = await getMessageById(messageId);
		}

		if (!message) {
			debugSearchJump('useMessages.loadMessage.noLocalMessage', { messageId, tmid });
			return;
		}

		let countNewer = 0;
		const messageDate = message.ts instanceof Date ? message.ts.getTime() : new Date(message.ts).getTime();
		if (tmid) {
			countNewer = await db.get('thread_messages').query(Q.where('rid', tmid), Q.where('ts', Q.gt(messageDate))).fetchCount();
		} else {
			countNewer = await db.get('messages').query(...getMainRoomWhereClause(Q.gt(messageDate))).fetchCount();
		}

		const forceCount = getJumpToMessageFetchCount({ countNewer, currentCount: count.current });
		debugSearchJump('useMessages.loadMessage.localFound', {
			messageId,
			tmid,
			countNewer,
			currentCount: count.current,
			forceCount,
			loaded: messagesIds.current.includes(messageId),
			useJumpWindow: shouldUseJumpWindow({ forceCount })
		});
		if (shouldUseJumpWindow({ forceCount })) {
			await loadMessageWindow(message, messageDate);
		} else if (forceCount > count.current || !messagesIds.current.includes(messageId)) {
			await fetchMessages(forceCount);
		}
		await waitUntilMessageIsLoaded(messageId);
		await waitForMessagesRender();
		debugSearchJump('useMessages.loadMessage.done', {
			messageId,
			loaded: messagesIds.current.includes(messageId),
			count: messagesIds.current.length
		});
	}, [tmid, fetchMessages, waitUntilMessageIsLoaded, waitForMessagesRender, getMainRoomWhereClause, loadMessageWindow]);

	return [messages, messagesIds, fetchMessages, loadMessage, isJumpWindow, expandJumpWindow] as const;
};
