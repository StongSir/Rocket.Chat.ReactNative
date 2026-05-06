import dayjs from '../dayjs';
import { MessageTypeLoad } from '../constants/messageTypeLoad';
import { type IMessage, type TMessageModel } from '../../definitions';
import log from './helpers/log';
import { type RoomTypes, roomTypeToApiType } from './roomTypeToApiType';
import sdk from '../services/sdk';
import updateMessages from './updateMessages';
import { generateLoadMoreId } from './helpers/generateLoadMoreId';
import { getPreviousLocalMessage } from './helpers/messageHistory';

const COUNT = 50;
const MAX_BRIDGE_ROUNDS = 10;

async function getHistory(apiType: string, params: Record<string, any>) {
	switch (apiType) {
		case 'channels':
			return sdk.get('channels.history', params);
		case 'groups':
			return sdk.get('groups.history', params);
		case 'im':
			return sdk.get('im.history', params);
		default:
			return null;
	}
}

async function hasOlderMessages({
	apiType,
	roomId,
	before
}: {
	apiType: string;
	roomId: string;
	before: Date | string;
}): Promise<boolean> {
	const data = await getHistory(apiType, {
		roomId,
		count: 1,
		latest: new Date(before).toISOString()
	});
	return !!(data?.success && data.messages?.length);
}

async function load({ rid: roomId, latest, t }: { rid: string; latest?: Date; t: RoomTypes }): Promise<IMessage[]> {
	const apiType = roomTypeToApiType(t);
	if (!apiType) {
		return [];
	}

	const allMessages: IMessage[] = [];
	let mainMessagesCount = 0;
	let bridgeTargetId: string | undefined;
	let bridgeRounds = 0;

	async function fetchBatch(lastTs?: string): Promise<void> {
		if (allMessages.length >= COUNT) {
			return;
		}

		const params = { roomId, showThreadMessages: false, count: COUNT, ...(lastTs && { latest: lastTs }) };

		const data = await getHistory(apiType, params);

		if (!data?.success || !data.messages?.length) {
			return;
		}

		const batch = data.messages as IMessage[];
		allMessages.push(...batch);

		const mainMessagesInBatch = batch.filter(message => !message.tmid);
		mainMessagesCount += mainMessagesInBatch.length;

		const needsMoreMainMessages = mainMessagesCount < COUNT;
		const lastMessage = batch[batch.length - 1];
		if (!latest && !bridgeTargetId && lastMessage?.ts) {
			const previousLocalMessage = await getPreviousLocalMessage(roomId, lastMessage.ts);
			if (previousLocalMessage?.id) {
				bridgeTargetId = previousLocalMessage.id;
			}
		}

		const reachedBridgeTarget = !!bridgeTargetId && batch.some(message => message._id === bridgeTargetId);
		const needsBridgeMessages = !!bridgeTargetId && !reachedBridgeTarget && bridgeRounds < MAX_BRIDGE_ROUNDS;

		if (needsMoreMainMessages || needsBridgeMessages) {
			bridgeRounds++;
			await fetchBatch(lastMessage.ts as string);
		}
	}

	const startTimestamp = latest ? new Date(latest).toISOString() : undefined;
	await fetchBatch(startTimestamp);
	return allMessages;
}

export function loadMessagesForRoom(args: {
	rid: string;
	t: RoomTypes;
	latest?: Date;
	loaderItem?: TMessageModel;
}): Promise<void> {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await load(args);
			if (data?.length) {
				const lastMessage = data[data.length - 1];
				const apiType = roomTypeToApiType(args.t);
				const shouldAddLoadMore =
					!!apiType &&
					!!lastMessage?.ts &&
					(await hasOlderMessages({ apiType, roomId: args.rid, before: lastMessage.ts as Date }));
				if (shouldAddLoadMore) {
					const loadMoreMessage = {
						_id: generateLoadMoreId(lastMessage._id as string),
						rid: lastMessage.rid,
						ts: dayjs(lastMessage.ts).subtract(1, 'millisecond').toString(),
						t: MessageTypeLoad.MORE,
						msg: lastMessage.msg
					} as IMessage;
					data.push(loadMoreMessage);
				}
				await updateMessages({ rid: args.rid, update: data, loaderItem: args.loaderItem });
				return resolve();
			}
			return resolve();
		} catch (e) {
			log(e);
			reject(e);
		}
	});
}
