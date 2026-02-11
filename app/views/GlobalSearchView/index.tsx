import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import dayjs from 'dayjs';

import { FormTextInput } from '../../containers/TextInput';
import ActivityIndicator from '../../containers/ActivityIndicator';
import SafeAreaView from '../../containers/SafeAreaView';
import * as HeaderButton from '../../containers/Header/components/HeaderButton';
import { CustomIcon } from '../../containers/CustomIcon';
import database from '../../lib/database';
import { sanitizeLikeString } from '../../lib/database/utils';
import { useAppSelector } from '../../lib/hooks/useAppSelector';
import { getSubscriptionByRoomId } from '../../lib/database/services/Subscription';
import { getRoomTitle } from '../../lib/methods/helpers';
import I18n from '../../i18n';
import { useTheme } from '../../theme';
import { themes } from '../../lib/constants/colors';
import { MESSAGE_TYPE_ANY_LOAD } from '../../lib/constants/messageTypeLoad';
import scrollPersistTaps from '../../lib/methods/helpers/scrollPersistTaps';
import { isIOS } from '../../lib/methods/helpers';
import { type TMessageModel, type TSubscriptionModel } from '../../definitions';
import { type ChatsStackParamList } from '../../stacks/types';
import { type MasterDetailInsideStackParamList } from '../../stacks/MasterDetailStack/types';
import styles from './styles';

const QUERY_SIZE = 50;
const SEARCH_DEBOUNCE = 500;

interface ISearchResult {
    message: TMessageModel;
    roomName: string;
    roomType: string;
    subscription?: TSubscriptionModel;
    rid: string;
}

const GlobalSearchView = () => {
    const [searchText, setSearchText] = useState('');
    const [results, setResults] = useState<ISearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMasterDetail = useAppSelector(state => state.app.isMasterDetail);
    const useRealName = useAppSelector(state => state.settings.UI_Use_Real_Name) as boolean;
    const { colors, theme } = useTheme();
    const navigation = useNavigation<any>();

    const searchMessages = useCallback(async (text: string) => {
        if (!text.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const db = database.active;
            const messagesCollection = db.get('messages');
            const likeString = sanitizeLikeString(text);

            const messages = await messagesCollection
                .query(
                    Q.where('msg', Q.like(`%${likeString}%`)),
                    Q.or(
                        Q.where('t', Q.eq(null)),
                        Q.where('t', Q.notIn(MESSAGE_TYPE_ANY_LOAD))
                    ),
                    Q.sortBy('ts', Q.desc),
                    Q.take(QUERY_SIZE)
                )
                .fetch() as TMessageModel[];

            // Get room info for each unique rid
            const ridSet = new Set(messages.map(m => (m as any)._raw.rid));
            const roomMap = new Map<string, { name: string; type: string; subscription?: TSubscriptionModel }>();

            await Promise.all(
                Array.from(ridSet).map(async (rid) => {
                    try {
                        const sub = await getSubscriptionByRoomId(rid);
                        if (sub) {
                            roomMap.set(rid, {
                                name: getRoomTitle(sub),
                                type: sub.t || '',
                                subscription: sub as TSubscriptionModel
                            });
                        } else {
                            roomMap.set(rid, { name: rid, type: '' });
                        }
                    } catch {
                        roomMap.set(rid, { name: rid, type: '' });
                    }
                })
            );

            const searchResults: ISearchResult[] = messages.map(message => {
                const rid = (message as any)._raw.rid;
                const roomInfo = roomMap.get(rid) || { name: rid, type: '', subscription: undefined };
                return {
                    message,
                    roomName: roomInfo.name,
                    roomType: roomInfo.type,
                    subscription: roomInfo.subscription,
                    rid
                };
            });

            setResults(searchResults);
        } catch (e) {
            console.log('GlobalSearchView searchMessages error:', e);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = useCallback((text: string) => {
        setSearchText(text);
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            searchMessages(text);
        }, SEARCH_DEBOUNCE);
    }, [searchMessages]);

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    const handlePress = useCallback(async (item: ISearchResult) => {
        const { message, subscription, rid } = item;
        const sub = subscription || await getSubscriptionByRoomId(rid);

        if (!sub) {
            return;
        }

        const params = {
            rid: sub.rid,
            name: getRoomTitle(sub),
            t: sub.t,
            room: sub,
            jumpToMessageId: message.id,
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
    }, [isMasterDetail, navigation]);

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

    const getSenderName = (message: TMessageModel) => {
        if (useRealName && message.u?.name) {
            return message.u.name;
        }
        return message.u?.username || '';
    };

    const formatTime = (ts: Date | string | number) => {
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

    const renderItem = ({ item }: { item: ISearchResult }) => {
        const { message, roomName, roomType } = item;
        return (
            <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.resultItemHeader}>
                    <CustomIcon
                        name={getRoomIcon(roomType)}
                        size={16}
                        color={colors.fontSecondaryInfo}
                    />
                    <Text
                        style={[styles.roomName, { color: colors.fontSecondaryInfo }]}
                        numberOfLines={1}
                    >
                        {roomName}
                    </Text>
                    <Text style={[styles.timestamp, { color: colors.fontAnnotation }]}>
                        {formatTime(message.ts)}
                    </Text>
                </View>
                <Text
                    style={[styles.senderName, { color: colors.fontTitlesLabels }]}
                    numberOfLines={1}
                >
                    {getSenderName(message)}
                </Text>
                <Text
                    style={[styles.messageText, { color: colors.fontDefault }]}
                    numberOfLines={2}
                >
                    {message.msg}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderSeparator = () => (
        <View style={[styles.separator, { backgroundColor: colors.strokeLight }]} />
    );

    const renderEmpty = () => {
        if (loading || !searchText.trim()) {
            return null;
        }
        return (
            <View style={[styles.listEmptyContainer, { backgroundColor: colors.surfaceRoom }]}>
                <Text style={[styles.noDataFound, { color: colors.fontTitlesLabels }]}>
                    {I18n.t('No_results_found')}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ backgroundColor: themes[theme].surfaceRoom }} testID='global-search-view'>
            <View style={styles.searchContainer}>
                <FormTextInput
                    autoFocus
                    label={I18n.t('Search')}
                    onChangeText={handleSearch}
                    placeholder={I18n.t('Search_Messages')}
                    testID='global-search-view-input'
                />
                <View style={[styles.divider, { backgroundColor: colors.strokeLight }]} />
            </View>
            {loading && results.length === 0 ? (
                <ActivityIndicator />
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderItem}
                    style={[styles.list, { backgroundColor: colors.surfaceRoom }]}
                    keyExtractor={item => item.message.id}
                    ItemSeparatorComponent={renderSeparator}
                    ListEmptyComponent={renderEmpty}
                    removeClippedSubviews={isIOS}
                    {...scrollPersistTaps}
                />
            )}
        </SafeAreaView>
    );
};

GlobalSearchView.navigationOptions = ({ navigation }: any): NativeStackNavigationOptions => ({
    title: I18n.t('Search_Messages')
});

export default GlobalSearchView;
