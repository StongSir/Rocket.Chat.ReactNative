import { Q } from '@nozbe/watermelondb';

import database from '../../database';
import { MESSAGE_TYPE_ANY_LOAD } from '../../constants/messageTypeLoad';
import { type TMessageModel } from '../../../definitions';

const nonLoaderMessageClause = () =>
	Q.or(Q.where('t', Q.eq(null)), Q.where('t', Q.notIn(MESSAGE_TYPE_ANY_LOAD)));

export const getLatestLocalMessage = async (rid: string): Promise<TMessageModel | null> => {
	try {
		const [message] = await database.active
			.get('messages')
			.query(Q.where('rid', rid), nonLoaderMessageClause(), Q.sortBy('ts', Q.desc), Q.take(1))
			.fetch();
		return (message as TMessageModel) || null;
	} catch {
		return null;
	}
};

export const getLatestLocalMessageDate = async (rid: string): Promise<Date | null> => {
	const message = await getLatestLocalMessage(rid);
	return message?.ts ? new Date(message.ts) : null;
};

export const getPreviousLocalMessage = async (rid: string, before: Date | string): Promise<TMessageModel | null> => {
	try {
		const beforeTimestamp = new Date(before).getTime();
		const [message] = await database.active
			.get('messages')
			.query(
				Q.where('rid', rid),
				nonLoaderMessageClause(),
				Q.where('ts', Q.lt(beforeTimestamp)),
				Q.sortBy('ts', Q.desc),
				Q.take(1)
			)
			.fetch();
		return (message as TMessageModel) || null;
	} catch {
		return null;
	}
};
