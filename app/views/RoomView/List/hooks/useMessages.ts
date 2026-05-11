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
import { getJumpToMessageFetchCount, shouldUseJumpWindow } from '../utils';
import { QUERY_SIZE } from '../constants';

const JUMP_WINDOW_SIDE_SIZE = 25;

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
	const thread = useRef<TAnyMessageModel | null>(null);
	const count = useRef(0);
	const subscription = useRef<Subscription | null>(null);
	const messagesIds = useRef<string[]>([]);
	const renderResolvers = useRef<(() => void)[]>([]);

	const fetchMessages = useCallback(async (forceCount?: number) => {
		unsubscribe();
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
			const db = database.active;
			let newerMessages: TAnyMessageModel[];
			let olderMessages: TAnyMessageModel[];

			if (tmid) {
				newerMessages = (await db
					.get('thread_messages')
					.query(Q.where('rid', tmid), Q.where('ts', Q.gt(messageDate)), Q.sortBy('ts', Q.asc), Q.take(JUMP_WINDOW_SIDE_SIZE))
					.fetch()) as TAnyMessageModel[];
				olderMessages = (await db
					.get('thread_messages')
					.query(Q.where('rid', tmid), Q.where('ts', Q.lte(messageDate)), Q.sortBy('ts', Q.desc), Q.take(JUMP_WINDOW_SIDE_SIZE))
					.fetch()) as TAnyMessageModel[];
			} else {
				newerMessages = (await db
					.get('messages')
					.query(...getMainRoomWhereClause(Q.gt(messageDate)), Q.sortBy('ts', Q.asc), Q.take(JUMP_WINDOW_SIDE_SIZE))
					.fetch()) as TAnyMessageModel[];
				olderMessages = (await db
					.get('messages')
					.query(...getMainRoomWhereClause(Q.lte(messageDate)), Q.sortBy('ts', Q.desc), Q.take(JUMP_WINDOW_SIDE_SIZE))
					.fetch()) as TAnyMessageModel[];
			}

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
			debugSearchJump('useMessages.loadMessageWindow', {
				messageId: message.id,
				count: newMessages.length,
				hasTarget: newMessages.some(item => item.id === message.id),
				newerCount: newerMessages.length,
				olderCount: olderMessages.length
			});
			updateMessagesState(newMessages);
		},
		[tmid, getMainRoomWhereClause, updateMessagesState]
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

	return [messages, messagesIds, fetchMessages, loadMessage] as const;
};
