import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import dayjs from 'dayjs';

import { FormTextInput } from '../../containers/TextInput';
import ActivityIndicator from '../../containers/ActivityIndicator';
import SafeAreaView from '../../containers/SafeAreaView';
import { CustomIcon } from '../../containers/CustomIcon';
import database from '../../lib/database';
import { sanitizeLikeString } from '../../lib/database/utils';
import { useAppSelector } from '../../lib/hooks/useAppSelector';
import { getSubscriptionByRoomId } from '../../lib/database/services/Subscription';
import { getRoomTitle, isIOS } from '../../lib/methods/helpers';
import I18n from '../../i18n';
import { useTheme } from '../../theme';
import { themes } from '../../lib/constants/colors';
import { MESSAGE_TYPE_ANY_LOAD } from '../../lib/constants/messageTypeLoad';
import scrollPersistTaps from '../../lib/methods/helpers/scrollPersistTaps';
import { type SubscriptionType, type TMessageModel } from '../../definitions';
import sdk from '../../lib/services/sdk';
import styles from './styles';
import {
	fetchGlobalSearchResults,
	getGlobalSearchVisualState,
	getSearchMessageId,
	getSearchMessageRid,
	resolveSearchResultRoomInfo,
	type IGlobalSearchResult,
	type TGlobalSearchMessage
} from './search';

const QUERY_SIZE = 50;
const SEARCH_DEBOUNCE = 500;

const GlobalSearchView = () => {
	const [searchText, setSearchText] = useState('');
	const [results, setResults] = useState<IGlobalSearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const searchRequestId = useRef(0);
	const isMasterDetail = useAppSelector(state => state.app.isMasterDetail);
	const useRealName = useAppSelector(state => state.settings.UI_Use_Real_Name) as boolean;
	const userId = useAppSelector(state => state.login.user.id) as string | undefined;
	const { colors, theme } = useTheme();
	const navigation = useNavigation<any>();

	const localSearchMessages = useCallback(async (text: string): Promise<IGlobalSearchResult[]> => {
		const db = database.active;
		const messagesCollection = db.get('messages');
		const likeString = sanitizeLikeString(text);

		const messages = (await messagesCollection
			.query(
				Q.where('msg', Q.like(`%${likeString}%`)),
				Q.or(Q.where('t', Q.eq(null)), Q.where('t', Q.notIn(MESSAGE_TYPE_ANY_LOAD))),
				Q.sortBy('ts', Q.desc),
				Q.take(QUERY_SIZE)
			)
			.fetch()) as TMessageModel[];

		// Get room info for each unique rid
		const ridSet = new Set(messages.map(m => getSearchMessageRid(m as TGlobalSearchMessage)));
		const roomMap = new Map<string, Omit<IGlobalSearchResult, 'message' | 'rid'> & { rid: string }>();

		await Promise.all(
			Array.from(ridSet).map(async rid => {
				try {
					const sub = await getSubscriptionByRoomId(rid);
					if (sub) {
						roomMap.set(rid, {
							roomName: getRoomTitle(sub),
							roomType: sub.t || '',
							subscription: sub,
							rid
						});
					} else {
						roomMap.set(rid, { roomName: rid, roomType: '', rid });
					}
				} catch {
					roomMap.set(rid, { roomName: rid, roomType: '', rid });
				}
			})
		);

		return messages.map(message => {
			const rid = getSearchMessageRid(message as TGlobalSearchMessage);
			const roomInfo = roomMap.get(rid) || { roomName: rid, roomType: '', subscription: undefined, rid };
			return {
				message,
				roomName: roomInfo.roomName,
				roomType: roomInfo.roomType,
				subscription: roomInfo.subscription,
				rid
			};
		});
	}, []);

	const searchMessages = useCallback(
		async (text: string, requestId: number) => {
			if (!text.trim()) {
				if (requestId === searchRequestId.current) {
					setResults([]);
					setLoading(false);
				}
				return;
			}

			try {
				const searchResults = await fetchGlobalSearchResults({
					text,
					userId,
					limit: QUERY_SIZE,
					methodCallWrapper: sdk.methodCallWrapper.bind(sdk),
					localSearch: localSearchMessages
				});
				const resolvedResults = await resolveSearchResultRoomInfo(searchResults, getSubscriptionByRoomId, getRoomTitle);
				if (requestId === searchRequestId.current) {
					setResults(resolvedResults);
				}
			} catch (e) {
				console.log('GlobalSearchView searchMessages error:', e);
				if (requestId === searchRequestId.current) {
					setResults([]);
				}
			} finally {
				if (requestId === searchRequestId.current) {
					setLoading(false);
				}
			}
		},
		[localSearchMessages, userId]
	);

	const handleSearch = useCallback(
		(text: string) => {
			setSearchText(text);
			searchRequestId.current += 1;
			const requestId = searchRequestId.current;
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
			if (!text.trim()) {
				setLoading(false);
				setResults([]);
				return;
			}
			setLoading(true);
			debounceTimer.current = setTimeout(() => {
				searchMessages(text, requestId);
			}, SEARCH_DEBOUNCE);
		},
		[searchMessages]
	);

	useEffect(() => {
		return () => {
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
		};
	}, []);

	const handlePress = useCallback(
		async (item: IGlobalSearchResult) => {
			const { message, subscription, rid } = item;
			const sub = subscription || (await getSubscriptionByRoomId(rid));

			const roomType = sub?.t || item.roomType;
			if (!roomType) {
				return;
			}

			const params = {
				rid: sub?.rid || rid,
				name: sub ? getRoomTitle(sub) : item.roomName,
				t: roomType as SubscriptionType,
				room: sub,
				jumpToMessageId: getSearchMessageId(message),
				jumpTs: Date.now()
			};

			if (isMasterDetail) {
				navigation.navigate('DrawerNavigator', {
					screen: 'ChatsStackNavigator',
					params: {
						screen: 'RoomView',
						params
					}
				});
			} else {
				navigation.navigate('RoomView', params);
			}
		},
		[isMasterDetail, navigation]
	);

	const getRoomIcon = (type: string) => {
		switch (type) {
			case 'c':
				return 'channel-public';
			case 'p':
				return 'channel-private';
			case 'd':
				return 'message';
			case 'l':
				return 'omnichannel';
			case 't':
				return 'team';
			default:
				return 'channel-public';
		}
	};

	const getSenderName = (message: TGlobalSearchMessage) => {
		if (useRealName && message.u?.name) {
			return message.u.name;
		}
		return message.u?.username || '';
	};

	const formatTime = (ts?: Date | string | number) => {
		if (!ts) {
			return '';
		}
		const date = dayjs(ts);
		const now = dayjs();
		if (date.isSame(now, 'day')) {
			return date.format('HH:mm');
		}
		if (date.isSame(now, 'year')) {
			return date.format('MM/DD HH:mm');
		}
		return date.format('YYYY/MM/DD');
	};

	const renderItem = ({ item }: { item: IGlobalSearchResult }) => {
		const { message, roomName, roomType } = item;
		return (
			<TouchableOpacity style={styles.resultItem} onPress={() => handlePress(item)} activeOpacity={0.7}>
				<View style={styles.resultItemHeader}>
					<CustomIcon name={getRoomIcon(roomType)} size={16} color={colors.fontSecondaryInfo} />
					<Text style={[styles.roomName, { color: colors.fontSecondaryInfo }]} numberOfLines={1}>
						{roomName}
					</Text>
					<Text style={[styles.timestamp, { color: colors.fontAnnotation }]}>{formatTime(message.ts)}</Text>
				</View>
				<Text style={[styles.senderName, { color: colors.fontTitlesLabels }]} numberOfLines={1}>
					{getSenderName(message)}
				</Text>
				<Text style={[styles.messageText, { color: colors.fontDefault }]} numberOfLines={2}>
					{message.msg}
				</Text>
			</TouchableOpacity>
		);
	};

	const renderSeparator = () => <View style={[styles.separator, { backgroundColor: colors.strokeLight }]} />;

	const renderEmpty = () => {
		const visualState = getGlobalSearchVisualState({ isSearching: loading, resultCount: results.length, searchText });
		if (!visualState.showEmpty) {
			return null;
		}
		return (
			<View style={[styles.listEmptyContainer, { backgroundColor: colors.surfaceRoom }]}>
				<Text style={[styles.noDataFound, { color: colors.fontTitlesLabels }]}>{I18n.t('No_results_found')}</Text>
			</View>
		);
	};

	const visualState = getGlobalSearchVisualState({ isSearching: loading, resultCount: results.length, searchText });

	return (
		<SafeAreaView style={{ backgroundColor: themes[theme].surfaceRoom }} testID='global-search-view'>
			<View style={styles.searchContainer}>
				<FormTextInput
					autoFocus
					inputStyle={visualState.showInputLoading ? styles.inputWithLoading : undefined}
					label={I18n.t('Search')}
					loading={visualState.showInputLoading}
					onChangeText={handleSearch}
					onClearInput={visualState.showInputLoading ? undefined : () => handleSearch('')}
					placeholder={I18n.t('Search_Messages')}
					testID='global-search-view-input'
					value={searchText}
				/>
				<View style={[styles.divider, { backgroundColor: colors.strokeLight }]} />
			</View>
			<FlatList
				data={results}
				renderItem={renderItem}
				style={[styles.list, { backgroundColor: colors.surfaceRoom }]}
				keyExtractor={item => getSearchMessageId(item.message)}
				ItemSeparatorComponent={renderSeparator}
				ListEmptyComponent={renderEmpty}
				ListFooterComponent={visualState.showFullLoading || visualState.showInlineLoading ? <ActivityIndicator style={styles.footerLoading} /> : null}
				removeClippedSubviews={isIOS}
				{...scrollPersistTaps}
			/>
		</SafeAreaView>
	);
};

GlobalSearchView.navigationOptions = (): NativeStackNavigationOptions => ({
	title: I18n.t('Search_Messages')
});

export default GlobalSearchView;
