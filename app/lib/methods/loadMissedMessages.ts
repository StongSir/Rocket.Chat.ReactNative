import { type ILastMessage, type IMessage } from '../../definitions';
import { compareServerVersion } from './helpers';
import updateMessages from './updateMessages';
import sdk from '../services/sdk';
import { store } from '../store/auxStore';
import { getSubscriptionByRoomId } from '../database/services/Subscription';
import database from '../database';
import { Q } from '@nozbe/watermelondb';
import { MESSAGE_TYPE_ANY_LOAD, MessageTypeLoad } from '../constants/messageTypeLoad';
import { roomTypeToApiType, type RoomTypes } from './roomTypeToApiType';
import { generateLoadMoreId } from './helpers/generateLoadMoreId';
import dayjs from '../dayjs';
import log from './helpers/log';
import { getLatestLocalMessageDate } from './helpers/messageHistory';

const count = 50;
const MISSED_MESSAGES_LOOKBACK = 6 * 60 * 60 * 1000;

const syncMessages = async ({ roomId, next, type }: { roomId: string; next: number; type: 'UPDATED' | 'DELETED' }) => {
	// @ts-ignore // this method dont have type
	const { result } = await sdk.get('chat.syncMessages', { roomId, next, count, type });
	return result;
};

const getSyncMessagesFromCursor = async (
	roomId: string,
	lastOpen?: number,
	updatedNext?: number | null,
	deletedNext?: number | null
) => {
	let updatedMessages;
	let deletedMessages;

	if (!updatedNext && !deletedNext) {
		if (!lastOpen) {
			return {
				deleted: [],
				deletedNext: null,
				updated: [],
				updatedNext: null
			};
		}
		[updatedMessages, deletedMessages] = await Promise.all([
			syncMessages({ roomId, next: lastOpen, type: 'UPDATED' }),
			syncMessages({ roomId, next: lastOpen, type: 'DELETED' })
		]);
	} else {
		[updatedMessages, deletedMessages] = await Promise.all([
			updatedNext ? syncMessages({ roomId, next: updatedNext, type: 'UPDATED' }) : Promise.resolve(null),
			deletedNext ? syncMessages({ roomId, next: deletedNext, type: 'DELETED' }) : Promise.resolve(null)
		]);
	}

	return {
		deleted: deletedMessages?.deleted ?? [],
		deletedNext: deletedMessages?.cursor?.next ?? null,
		updated: updatedMessages?.updated ?? [],
		updatedNext: updatedMessages?.cursor?.next ?? null
	};
};

const getLastUpdate = async (rid: string) => {
	const sub = await getSubscriptionByRoomId(rid);
	if (!sub) {
		return null;
	}
	return sub.lastOpen;
};

const getSyncStart = async (rid: string, lastOpen?: Date): Promise<number | undefined> => {
	const candidates: number[] = [];

	if (lastOpen) {
		candidates.push(new Date(lastOpen).getTime());
	} else {
		const lastUpdate = await getLastUpdate(rid);
		if (lastUpdate) {
			candidates.push(lastUpdate.getTime());
		}
	}

	const latestLocalMessageDate = await getLatestLocalMessageDate(rid);
	if (latestLocalMessageDate) {
		candidates.push(latestLocalMessageDate.getTime());
	}

	if (!candidates.length) {
		return undefined;
	}

	const earliest = Math.min(...candidates);
	// Dynamic lookback: use 2x the actual gap or max 6 hours, whichever is smaller.
	// This avoids excessive lookback in active rooms where the gap is short,
	// while still providing adequate coverage for longer offline periods.
	const gap = Date.now() - earliest;
	const lookback = Math.min(gap * 2, MISSED_MESSAGES_LOOKBACK);
	return Math.max(0, earliest - lookback);
};

/**
 * After incremental sync, check if the local DB has a loadMore marker for this room.
 * If not, check whether older messages exist on the server, and insert a loadMore marker
 * so users can scroll up to load more history.
 */
async function ensureLoadMoreMarker(rid: string): Promise<void> {
	try {
		const db = database.active;
		const msgCollection = db.get('messages');

		// Check if there are already loadMore markers in this room
		const existingLoaders = await msgCollection
			.query(Q.where('rid', rid), Q.where('t', Q.oneOf(MESSAGE_TYPE_ANY_LOAD)))
			.fetchCount();

		if (existingLoaders > 0) {
			return; // Already has load markers, no need to add
		}

		// Get the oldest message in this room
		const oldestMessages = await msgCollection
			.query(Q.where('rid', rid), Q.sortBy('ts', Q.asc), Q.take(1))
			.fetch();

		if (!oldestMessages.length) {
			return; // No messages, nothing to do
		}

		const oldestMessage = oldestMessages[0];

		// Get room type from subscription to determine the correct API endpoint
		const sub = await getSubscriptionByRoomId(rid);
		if (!sub?.t) {
			return;
		}

		const apiType = roomTypeToApiType(sub.t as RoomTypes);
		if (!apiType) {
			return;
		}

		// Ask server if there are messages older than the oldest local message
		const params = { roomId: rid, count: 1, latest: new Date(oldestMessage.ts).toISOString() };
		let data;
		switch (apiType) {
			case 'channels':
				data = await sdk.get('channels.history', params);
				break;
			case 'groups':
				data = await sdk.get('groups.history', params);
				break;
			case 'im':
				data = await sdk.get('im.history', params);
				break;
			default:
				return;
		}

		if (data?.success && data?.messages?.length) {
			// There are older messages on the server, insert a loadMore marker
			const loadMoreMessage = {
				_id: generateLoadMoreId(oldestMessage.id),
				rid,
				ts: dayjs(oldestMessage.ts).subtract(1, 'millisecond').toString(),
				t: MessageTypeLoad.MORE,
				msg: ''
			} as IMessage;

			await updateMessages({ rid, update: [loadMoreMessage] });
		}
	} catch (e) {
		log(e);
	}
}

async function load({
	rid: roomId,
	lastOpen,
	updatedNext,
	deletedNext
}: {
	rid: string;
	lastOpen?: Date;
	updatedNext?: number | null;
	deletedNext?: number | null;
}) {
	const { version: serverVersion } = store.getState().server;
	if (compareServerVersion(serverVersion, 'greaterThanOrEqualTo', '7.1.0')) {
		const lastOpenTimestamp = await getSyncStart(roomId, lastOpen);
		const result = await getSyncMessagesFromCursor(roomId, lastOpenTimestamp, updatedNext, deletedNext);
		return result;
	}

	let lastOpenISOString;

	// Use the last message timestamp if available
	try {
		const db = database.active;
		const [lastMessage] = await db
			.get('messages')
			.query(Q.where('rid', roomId), Q.sortBy('ts', Q.desc), Q.take(1))
			.fetch();
		if (lastMessage?.ts) {
			lastOpenISOString = new Date(lastMessage.ts).toISOString();
		}
	} catch (e) {
		// Do nothing
	}

	if (!lastOpenISOString) {
		if (lastOpen) {
			lastOpenISOString = new Date(lastOpen).toISOString();
		} else {
			const lastUpdate = await getLastUpdate(roomId);
			lastOpenISOString = lastUpdate?.toISOString();
		}
	}

	// RC 0.60.0
	// @ts-ignore // this method dont have type
	const { result } = await sdk.get('chat.syncMessages', { roomId, lastUpdate: lastOpenISOString });
	return result;
}

export async function loadMissedMessages(args: {
	rid: string;
	lastOpen?: Date;
	updatedNext?: number | null;
	deletedNext?: number | null;
}): Promise<void> {
	const data = await load({
		rid: args.rid,
		lastOpen: args.lastOpen,
		updatedNext: args.updatedNext,
		deletedNext: args.deletedNext
	});
	if (data) {
		const {
			updated,
			updatedNext,
			deleted,
			deletedNext
		}: { updated: ILastMessage[]; deleted: ILastMessage[]; updatedNext: number | null; deletedNext: number | null } = data;
		// @ts-ignore // TODO: remove loaderItem obligatoriness
		await updateMessages({ rid: args.rid, update: updated, remove: deleted });

		if (deletedNext || updatedNext) {
			await loadMissedMessages({
				rid: args.rid,
				lastOpen: args.lastOpen,
				updatedNext,
				deletedNext
			});
		} else {
			// Incremental sync complete — ensure a loadMore marker exists
			// so users can scroll up to load older history
			await ensureLoadMoreMarker(args.rid);
		}
	}
}
