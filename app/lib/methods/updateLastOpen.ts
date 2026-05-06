import database from '../database';
import { getSubscriptionByRoomId } from '../database/services/Subscription';
import log from './helpers/log';
import { type TSubscriptionModel } from '../../definitions';
import { getLatestLocalMessageDate } from './helpers/messageHistory';

export async function updateLastOpen(rid: string, lastOpen?: Date): Promise<void> {
	try {
		const db = database.active;
		const subscription = await getSubscriptionByRoomId(rid);
		if (!subscription) {
			return;
		}
		const nextLastOpen = lastOpen || (await getLatestLocalMessageDate(rid));
		if (!nextLastOpen) {
			return;
		}
		await db.write(async () => {
			await subscription.update((s: TSubscriptionModel) => {
				s.lastOpen = nextLastOpen;
			});
		});
	} catch (e) {
		log(e);
	}
}
