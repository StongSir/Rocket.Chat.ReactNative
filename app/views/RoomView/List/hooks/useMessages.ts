import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { type Subscription } from 'rxjs';

import { type TAnyMessageModel } from '../../../../definitions';
import database from '../../../../lib/database';
import { getMessageById } from '../../../../lib/database/services/Message';
import { getThreadById } from '../../../../lib/database/services/Thread';
import { compareServerVersion, useDebounce } from '../../../../lib/methods/helpers';
import { readThreads } from '../../../../lib/services/restApi';
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
	const thread = useRef<TAnyMessageModel | null>(null);
	const count = useRef(0);
	const subscription = useRef<Subscription | null>(null);
	const messagesIds = useRef<string[]>([]);

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
		fetchMessages();

		return () => {
			unsubscribe();
		};
	}, [rid, tmid, showMessageInMainThread, serverVersion, hideSystemMessages, fetchMessages]);

	const unsubscribe = () => {
		subscription.current?.unsubscribe();
	};

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
			return;
		}

		let countNewer = 0;
		const messageDate = message.ts instanceof Date ? message.ts.getTime() : new Date(message.ts).getTime();
		if (tmid) {
			countNewer = await db.get('thread_messages').query(Q.where('rid', tmid), Q.where('ts', Q.gt(messageDate))).fetchCount();
		} else {
			const whereClause = [Q.where('rid', rid), Q.where('ts', Q.gt(messageDate))] as (
				| Q.WhereDescription
				| Q.Or
			)[];
			if (!showMessageInMainThread) {
				whereClause.push(Q.or(Q.where('tmid', null), Q.where('tshow', Q.eq(true))));
			}
			countNewer = await db.get('messages').query(...whereClause).fetchCount();
		}

		if (countNewer >= count.current) {
			fetchMessages(countNewer + 50);
			await new Promise<void>(resolve => {
				const interval = setInterval(() => {
					if (messagesIds.current.includes(messageId)) {
						clearInterval(interval);
						resolve();
					}
				}, 100);
				setTimeout(() => {
					clearInterval(interval);
					resolve();
				}, 3000); // 3 seconds timeout
			});
		}
	}, [rid, tmid, showMessageInMainThread, fetchMessages]);

	return [messages, messagesIds, fetchMessages, loadMessage] as const;
};
