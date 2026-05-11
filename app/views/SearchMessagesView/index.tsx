import React from 'react';
import { type NativeStackNavigationOptions, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type CompositeNavigationProp, type RouteProp } from '@react-navigation/core';
import { FlatList, Text, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { connect } from 'react-redux';
import { dequal } from 'dequal';

import { FormTextInput } from '../../containers/TextInput';
import ActivityIndicator from '../../containers/ActivityIndicator';
import Markdown from '../../containers/markdown';
import Message from '../../containers/message';
import scrollPersistTaps from '../../lib/methods/helpers/scrollPersistTaps';
import I18n from '../../i18n';
import log from '../../lib/methods/helpers/log';
import { themes } from '../../lib/constants/colors';
import { textInputDebounceTime } from '../../lib/constants/debounceConfig';
import { type TSupportedThemes, withTheme } from '../../theme';
import { getUserSelector } from '../../selectors/login';
import SafeAreaView from '../../containers/SafeAreaView';
import * as HeaderButton from '../../containers/Header/components/HeaderButton';
import database from '../../lib/database';
import { sanitizeLikeString } from '../../lib/database/utils';
import getThreadName from '../../lib/methods/getThreadName';
import getRoomInfo, { type IRoomInfoResult } from '../../lib/methods/getRoomInfo';
import styles from './styles';
import { type InsideStackParamList, type ChatsStackParamList } from '../../stacks/types';
import { compareServerVersion, debounce, isIOS } from '../../lib/methods/helpers';
import {
	type IMessageFromServer,
	type IUser,
	type TMessageModel,
	type IUrl,
	type IAttachment,
	type ISubscription,
	SubscriptionType,
	type TSubscriptionModel,
	type TGetCustomEmoji,
	type ICustomEmoji
} from '../../definitions';
import { searchMessages } from '../../lib/services/restApi';
import { type TNavigation } from '../../stacks/stackType';
import Navigation from '../../lib/navigation/appNavigation';
import { debugSearchJump } from '../../lib/methods/helpers/debugSearchJump';
import { appendUniqueMessages, getMessageId, normalizeSearchText } from './utils';

const QUERY_SIZE = 50;

interface ISearchMessagesViewState {
	loading: boolean;
	messages: (IMessageFromServer | TMessageModel)[];
	searchText: string;
}

export interface IRoomInfoParam {
	room?: ISubscription;
	member?: any;
	rid: string;
	t: SubscriptionType;
	joined?: boolean;
	itsMe?: boolean;
}

interface INavigationOption {
	navigation: CompositeNavigationProp<
		NativeStackNavigationProp<ChatsStackParamList, 'SearchMessagesView'>,
		NativeStackNavigationProp<InsideStackParamList & TNavigation>
	>;
	route: RouteProp<ChatsStackParamList, 'SearchMessagesView'>;
}

interface ISearchMessagesViewProps extends INavigationOption {
	user: IUser;
	baseUrl: string;
	serverVersion: string;
	customEmojis: {
		[key: string]: ICustomEmoji;
	};
	theme: TSupportedThemes;
	useRealName: boolean;
	isMasterDetail: boolean;
}
class SearchMessagesView extends React.Component<ISearchMessagesViewProps, ISearchMessagesViewState> {
	private offset: number;

	private rid: string;

	private t: SubscriptionType;

	private encrypted: boolean | undefined;

	private room?: IRoomInfoResult;

	private searchRequestId: number;

	static navigationOptions = ({ navigation, route }: INavigationOption) => {
		const options: NativeStackNavigationOptions = {
			title: I18n.t('Search')
		};
		const showCloseModal = route.params?.showCloseModal;
		if (showCloseModal) {
			options.headerLeft = () => <HeaderButton.CloseModal navigation={navigation} />;
		}
		return options;
	};

	constructor(props: ISearchMessagesViewProps) {
		super(props);
		this.state = {
			loading: false,
			messages: [],
			searchText: ''
		};
		this.offset = 0;
		this.rid = props.route.params.rid;
		this.t = props.route.params?.t;
		this.encrypted = props.route.params?.encrypted;
		this.searchRequestId = 0;
	}

	async componentDidMount() {
		this.room = (await getRoomInfo(this.rid)) ?? undefined;
	}

	shouldComponentUpdate(nextProps: ISearchMessagesViewProps, nextState: ISearchMessagesViewState) {
		const { loading, searchText, messages } = this.state;
		const { theme } = this.props;
		if (nextProps.theme !== theme) {
			return true;
		}
		if (nextState.loading !== loading) {
			return true;
		}
		if (nextState.searchText !== searchText) {
			return true;
		}
		if (!dequal(nextState.messages, messages)) {
			return true;
		}
		return false;
	}

	componentWillUnmount() {
		this.searchDebounced?.stop?.();
	}

	// Handle encrypted rooms search messages
	searchMessages = async (searchText: string, offset = this.offset): Promise<(IMessageFromServer | TMessageModel)[]> => {
		const normalizedSearchText = normalizeSearchText(searchText);
		if (!normalizedSearchText) {
			return [];
		}
		// If it's a encrypted, room we'll search only on the local stored messages
		if (this.encrypted) {
			const db = database.active;
			const messagesCollection = db.get('messages');
			const likeString = sanitizeLikeString(normalizedSearchText);
			const messages = await messagesCollection
				.query(
					// Messages of this room
					Q.where('rid', this.rid),
					// Message content is like the search text
					Q.where('msg', Q.like(`%${likeString}%`)),
					Q.sortBy('ts', Q.desc),
					Q.skip(offset),
					Q.take(QUERY_SIZE)
				)
				.fetch();
			return messages;
		}
		// If it's not a encrypted room, search messages on the server
		const result = await searchMessages(this.rid, normalizedSearchText, QUERY_SIZE, offset);
		if (result.success) {
			const urlRenderMessages = result.messages?.map(message => {
				if (message.urls && message.urls.length > 0) {
					message.urls = message.urls?.map((url, index) => {
						if (url.meta) {
							return {
								_id: index,
								title: url.meta.pageTitle,
								description: url.meta.ogDescription,
								image: url.meta.ogImage,
								url: url.url
							} as IUrl;
						}
						return {} as IUrl;
					});
				}
				return message;
			}) ?? [];
			return urlRenderMessages;
		}
		return [];
	};

	isCurrentSearch = (requestId: number, searchText: string) =>
		requestId === this.searchRequestId && normalizeSearchText(this.state.searchText) === normalizeSearchText(searchText);

	getMessages = async (searchText: string, debounced?: boolean, requestId = this.searchRequestId) => {
		const normalizedSearchText = normalizeSearchText(searchText);
		if (!normalizedSearchText) {
			if (requestId === this.searchRequestId) {
				this.setState({ loading: false, messages: [] });
			}
			return;
		}
		try {
			const offset = this.offset;
			const messages = await this.searchMessages(normalizedSearchText, offset);
			if (!this.isCurrentSearch(requestId, normalizedSearchText)) {
				return;
			}
			this.offset = offset + QUERY_SIZE;
			this.setState(prevState => ({
				messages: debounced ? messages : appendUniqueMessages(prevState.messages, messages),
				loading: false
			}));
		} catch (e) {
			if (this.isCurrentSearch(requestId, normalizedSearchText)) {
				this.setState({ loading: false });
			}
			log(e);
		}
	};

	search = (searchText: string) => {
		const normalizedSearchText = normalizeSearchText(searchText);
		this.searchRequestId += 1;
		this.offset = 0;
		this.searchDebounced?.stop?.();
		if (!normalizedSearchText) {
			this.setState({ searchText: normalizedSearchText, loading: false, messages: [] });
			return;
		}
		this.setState({ searchText: normalizedSearchText, loading: true, messages: [] });
		this.searchDebounced(normalizedSearchText, this.searchRequestId);
	};

	searchDebounced = debounce(async (searchText: string, requestId: number) => {
		await this.getMessages(searchText, true, requestId);
	}, textInputDebounceTime);

	getCustomEmoji: TGetCustomEmoji = name => {
		const { customEmojis } = this.props;
		const emoji = customEmojis[name];
		if (emoji) {
			return emoji;
		}
		return null;
	};

	showAttachment = (attachment: IAttachment) => {
		const { navigation } = this.props;
		navigation.navigate('AttachmentView', { attachment });
	};

	navToRoomInfo = (navParam: IRoomInfoParam) => {
		const { navigation, user } = this.props;
		if (navParam.rid === user.id) {
			return;
		}
		navigation.navigate('RoomInfoView', navParam);
	};

	jumpToMessage = async ({ item }: { item: IMessageFromServer | TMessageModel }) => {
		const { isMasterDetail, navigation } = this.props;
		let params: {
			rid: string;
			jumpToMessageId: string;
			jumpTs: number;
			t: SubscriptionType;
			room: TSubscriptionModel | undefined;
			tmid?: string;
			name?: string;
		} = {
			rid: this.rid,
			jumpToMessageId: getMessageId(item),
			jumpTs: Date.now(),
			t: this.t,
			room: this.room as TSubscriptionModel
		};
		debugSearchJump('SearchMessagesView.jumpToMessage', {
			messageId: params.jumpToMessageId,
			rid: params.rid,
			t: params.t,
			isThread: 'tmid' in item && !!item.tmid,
			jumpTs: params.jumpTs
		});
		if ('tmid' in item && item.tmid) {
			Navigation.popToRoom(isMasterDetail);
			params = {
				...params,
				tmid: item.tmid,
				name: await getThreadName(this.rid, item.tmid as string, getMessageId(item)),
				t: SubscriptionType.THREAD
			};
			Navigation.push('RoomView', params);
		} else {
			navigation.navigate('RoomView', params);
		}
	};

	onEndReached = async () => {
		const { serverVersion } = this.props;
		const { searchText, messages, loading } = this.state;
		if (
			messages.length < this.offset ||
			loading ||
			(!this.encrypted && compareServerVersion(serverVersion, 'lowerThan', '3.17.0'))
		) {
			return;
		}
		this.setState({ loading: true });
		await this.getMessages(searchText, false, this.searchRequestId);
	};

	renderEmpty = () => {
		const { theme } = this.props;
		return (
			<View style={[styles.listEmptyContainer, { backgroundColor: themes[theme].surfaceRoom }]}>
				<Text style={[styles.noDataFound, { color: themes[theme].fontTitlesLabels }]}>{I18n.t('No_results_found')}</Text>
			</View>
		);
	};

	renderItem = ({ item }: { item: IMessageFromServer | TMessageModel }) => {
		const message = item as TMessageModel;
		const { user, baseUrl, theme, useRealName } = this.props;
		return (
			<Message
				item={message}
				baseUrl={baseUrl}
				user={user}
				timeFormat='MMM Do YYYY, h:mm:ss a'
				isThreadRoom
				showAttachment={this.showAttachment}
				getCustomEmoji={this.getCustomEmoji}
				navToRoomInfo={this.navToRoomInfo}
				useRealName={useRealName}
				theme={theme}
				onPress={() => this.jumpToMessage({ item })}
				jumpToMessage={() => this.jumpToMessage({ item })}
				rid={message.rid}
			/>
		);
	};

	renderList = () => {
		const { messages, loading, searchText } = this.state;
		const { theme } = this.props;

		if (!loading && messages.length === 0 && searchText.length) {
			return this.renderEmpty();
		}

		return (
			<FlatList
				data={messages}
				renderItem={this.renderItem}
				style={[styles.list, { backgroundColor: themes[theme].surfaceRoom }]}
				keyExtractor={getMessageId}
				onEndReached={this.onEndReached}
				ListFooterComponent={loading ? <ActivityIndicator /> : null}
				onEndReachedThreshold={0.5}
				removeClippedSubviews={isIOS}
				{...scrollPersistTaps}
			/>
		);
	};

	render() {
		const { theme } = this.props;
		return (
			<SafeAreaView style={{ backgroundColor: themes[theme].surfaceRoom }} testID='search-messages-view'>
				<View style={styles.searchContainer}>
					<FormTextInput
						autoFocus
						label={I18n.t('Search')}
						onChangeText={this.search}
						placeholder={I18n.t('Search_Messages')}
						testID='search-message-view-input'
					/>
					<Markdown msg={I18n.t('You_can_search_using_RegExp_eg')} />
					<View style={[styles.divider, { backgroundColor: themes[theme].strokeLight }]} />
				</View>
				{this.renderList()}
			</SafeAreaView>
		);
	}
}

const mapStateToProps = (state: any) => ({
	serverVersion: state.server.version,
	isMasterDetail: state.app.isMasterDetail,
	baseUrl: state.server.server,
	user: getUserSelector(state),
	useRealName: state.settings.UI_Use_Real_Name,
	customEmojis: state.customEmojis
});

export default connect(mapStateToProps)(withTheme(SearchMessagesView));
