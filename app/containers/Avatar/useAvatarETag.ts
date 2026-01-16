import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { type Observable, type Subscription } from 'rxjs';

import { type TLoggedUserModel, type TSubscriptionModel, type TUserModel } from '../../definitions';
import database from '../../lib/database';

export const useAvatarETag = ({
	username,
	text,
	type = '',
	rid,
	id
}: {
	type?: string;
	username: string;
	text: string;
	rid?: string;
	id: string;
}) => {
	const [avatarETag, setAvatarETag] = useState<string | undefined>(undefined);
	const [avatarLoaded, setAvatarLoaded] = useState(false);

	const isDirect = () => type === 'd';

	useEffect(() => {
		let subscription: Subscription;
		setAvatarLoaded(false);

		const observeAvatarETag = async () => {
			const db = database.active;
			const usersCollection = db.get('users');
			const subsCollection = db.get('subscriptions');

			let record;
			try {
				if (username === text) {
					const serversDB = database.servers;
					const userCollections = serversDB.get('users');
					const user = await userCollections.find(id);
					record = user;
				} else if (isDirect()) {
					const [user] = await usersCollection.query(Q.where('username', text)).fetch();
					record = user;
				} else if (rid) {
					record = await subsCollection.find(rid);
					if (record?.t === 'd' && record?.name) {
						try {
							const [user] = await usersCollection.query(Q.where('username', record.name)).fetch();
							if (user) {
								record = user;
							}
						} catch {
							// User not found
						}
					}
				}
			} catch {
				// Record not found
			}

			if (record) {
				const observable = record.observe() as Observable<TSubscriptionModel | TUserModel | TLoggedUserModel>;
				subscription = observable.subscribe(r => {
					setAvatarETag(r.avatarETag);
					setAvatarLoaded(true);
				});
			} else {
				// No record found, mark as loaded with no ETag
				setAvatarLoaded(true);
			}
		};
		observeAvatarETag();
		return () => {
			if (subscription?.unsubscribe) {
				subscription.unsubscribe();
			}
		};
	}, [text, rid, type, username, id]);

	return { avatarETag, avatarLoaded };
};

