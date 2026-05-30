import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ICustomEmoji, type ICustomEmojis, type IEmoji } from '../../definitions/IEmoji';
import { CustomIcon } from '../CustomIcon';
import ImagePicker from '../../lib/methods/helpers/ImagePicker/ImagePicker';
import scrollPersistTaps from '../../lib/methods/helpers/scrollPersistTaps';
import { PressableEmoji } from './PressableEmoji';
import styles, { EMOJI_BUTTON_SIZE, USER_CUSTOM_EMOJI_BUTTON_SIZE } from './styles';
import { emojisByCategory } from '../../lib/constants/emojis';
import { useAppSelector } from '../../lib/hooks/useAppSelector';
import { useFrequentlyUsedEmoji } from '../../lib/hooks/useFrequentlyUsedEmoji';
import { useUserCustomEmojis } from '../../lib/hooks/useUserCustomEmojis';
import { type IEmojiCategoryProps, type TEmojiCategory } from './interfaces';
import { isAndroid } from '../../lib/methods/helpers';
import {
	deleteMyCustomEmoji,
	getCustomEmojiServiceErrorMessage,
	uploadMyCustomEmoji
} from '../../lib/services/customEmojiService';
import log from '../../lib/methods/helpers/log';
import Touch from '../Touch';
import { getCustomEmojis } from '../../lib/methods/getCustomEmojis';
import { showToast } from '../../lib/methods/helpers/showToast';
import { useActionSheet } from '../ActionSheet';
import { useTheme } from '../../theme';

const ANDROID_BOTTOM_SHEET_EXTRA_OFFSET = 24;
const ANDROID_BOTTOM_SHEET_CONTENT_PADDING = EMOJI_BUTTON_SIZE + ANDROID_BOTTOM_SHEET_EXTRA_OFFSET;
const UPLOADING_EMOJI_ID_PREFIX = 'uploading-custom-emoji';
const UPLOAD_USER_CUSTOM_EMOJI_ITEM = 'upload-user-custom-emoji';
const USER_CUSTOM_UPLOAD_BORDER_INSET = 1;

const isUploadingEmoji = (emoji: IEmoji): emoji is ICustomEmoji =>
	typeof emoji !== 'string' && !!emoji.id?.startsWith(UPLOADING_EMOJI_ID_PREFIX);

const useEmojis = (category?: TEmojiCategory) => {
	const { frequentlyUsed, loaded } = useFrequentlyUsedEmoji();
	const { emojis: userCustomEmojis, refresh: refreshUserCustomEmojis } = useUserCustomEmojis(category === 'userCustom');
	const server = useAppSelector(state => state.server.server);
	const allCustomEmojis: ICustomEmojis = useAppSelector(
		state => state.customEmojis,
		() => true
	);
	if (!category) {
		return { items: [], refreshUserCustomEmojis };
	}
	const customEmojis = Object.keys(allCustomEmojis)
		.filter(item => item === allCustomEmojis[item].name)
		.map(item => ({
			name: allCustomEmojis[item].name,
			extension: allCustomEmojis[item].extension
		}));

	if (!loaded) {
		return { items: [], refreshUserCustomEmojis };
	}
	if (category === 'frequentlyUsed') {
		return { items: frequentlyUsed, refreshUserCustomEmojis };
	}
	if (category === 'userCustom') {
		const normalizedUserCustomEmojis = userCustomEmojis.map(item => {
			const officialEmoji = allCustomEmojis[item.name];
			if (!officialEmoji?.extension || officialEmoji.extension === item.extension) {
				return item;
			}
			return {
				...item,
				extension: officialEmoji.extension,
				thumbUrl: `${server}/emoji-custom/${encodeURIComponent(item.name)}.${officialEmoji.extension}`
			};
		});
		return { items: normalizedUserCustomEmojis, refreshUserCustomEmojis };
	}
	if (category === 'custom') {
		return { items: customEmojis, refreshUserCustomEmojis };
	}
	return { items: emojisByCategory[category], refreshUserCustomEmojis };
};

const EmojiCategory = ({
	parentWidth,
	category,
	emojis,
	onEmojiSelected,
	bottomSheet = false
}: IEmojiCategoryProps): React.ReactElement | null => {
	const { items, refreshUserCustomEmojis } = useEmojis(category);
	const [uploadingEmojis, setUploadingEmojis] = useState<ICustomEmoji[]>([]);
	const { bottom } = useSafeAreaInsets();
	const { showActionSheet } = useActionSheet();
	const { colors } = useTheme();
	const visibleItems = useMemo<IEmoji[]>(() => {
		if (category !== 'userCustom') {
			return items;
		}
		return [UPLOAD_USER_CUSTOM_EMOJI_ITEM, ...uploadingEmojis, ...items];
	}, [category, items, uploadingEmojis]);

	if (!parentWidth) {
		return null;
	}

	const emojiButtonSize = category === 'userCustom' ? USER_CUSTOM_EMOJI_BUTTON_SIZE : EMOJI_BUTTON_SIZE;
	const numColumns = Math.trunc(parentWidth / emojiButtonSize);
	const marginHorizontal = (parentWidth % emojiButtonSize) / 2;
	const contentPaddingBottom = isAndroid && bottomSheet ? ANDROID_BOTTOM_SHEET_CONTENT_PADDING + bottom : undefined;

	const uploadUserCustomEmoji = async () => {
		let uploadingEmoji: ICustomEmoji | undefined;
		try {
			const image = await ImagePicker.openPicker({ mediaType: 'photo' });
			uploadingEmoji = {
				id: `${UPLOADING_EMOJI_ID_PREFIX}-${Date.now()}`,
				name: image.filename || image.path?.split('/').pop() || 'uploading-custom-emoji',
				extension: image.mime?.split('/')[1] || 'png',
				thumbUrl: image.path
			};
			setUploadingEmojis(current => [uploadingEmoji as ICustomEmoji, ...current]);
			await uploadMyCustomEmoji({
				uri: image.path,
				name: image.filename || image.path?.split('/').pop() || 'emoji.png',
				type: image.mime || 'image/png',
				displayName: image.filename
			});
			await getCustomEmojis();
			await refreshUserCustomEmojis();
		} catch (e) {
			log(e);
			if (uploadingEmoji) {
				showToast(getCustomEmojiServiceErrorMessage(e));
			}
		} finally {
			if (uploadingEmoji) {
				setUploadingEmojis(current => current.filter(item => item.id !== uploadingEmoji?.id));
			}
		}
	};

	const deleteUserCustomEmoji = async (emoji: ICustomEmoji) => {
		if (!emoji.id) {
			return;
		}
		try {
			await deleteMyCustomEmoji(emoji.id);
			await refreshUserCustomEmojis();
			showToast(emoji.source === 'collected' ? '已取消收藏' : '已删除表情');
		} catch (e) {
			log(e);
			showToast(getCustomEmojiServiceErrorMessage(e));
		}
	};

	const confirmDeleteUserCustomEmoji = (emoji: ICustomEmoji) => {
		const isCollected = emoji.source === 'collected';
		Alert.alert(
			isCollected ? '取消收藏' : '删除表情',
			isCollected ? '确定从我的表情中移除这个收藏吗？' : '确定从我的表情中删除这个表情吗？',
			[
				{ text: '取消', style: 'cancel' },
				{
					text: isCollected ? '取消收藏' : '删除',
					style: 'destructive',
					onPress: () => deleteUserCustomEmoji(emoji)
				}
			]
		);
	};

	const handleUserCustomEmojiLongPress = (emoji: IEmoji) => {
		if (category !== 'userCustom' || typeof emoji === 'string') {
			return;
		}
		if (!emoji.id || emoji.id.startsWith(UPLOADING_EMOJI_ID_PREFIX)) {
			return;
		}
		const title = emoji.source === 'collected' ? '取消收藏' : '删除';
		showActionSheet({
			options: [
				{
					title,
					icon: 'delete',
					danger: true,
					onPress: () => confirmDeleteUserCustomEmoji(emoji),
					testID: 'emoji-picker-delete-custom-emoji'
				}
			]
		});
	};

	const renderItem = ({ item }: { item: IEmoji }) => {
		if (category === 'userCustom' && item === UPLOAD_USER_CUSTOM_EMOJI_ITEM) {
			return (
				<Touch
					accessible
					accessibilityLabel='Upload_custom_emoji'
					onPress={uploadUserCustomEmoji}
					rectButtonStyle={styles.uploadEmojiButton}
					style={styles.uploadEmojiButton}
					testID='emoji-picker-upload-custom-emoji'>
					<Svg
						height={USER_CUSTOM_EMOJI_BUTTON_SIZE}
						pointerEvents='none'
						style={styles.uploadEmojiBorder}
						width={USER_CUSTOM_EMOJI_BUTTON_SIZE}>
						<Rect
							fill='none'
							height={USER_CUSTOM_EMOJI_BUTTON_SIZE - USER_CUSTOM_UPLOAD_BORDER_INSET * 2}
							rx={16}
							ry={16}
							stroke={colors.strokeLight}
							strokeDasharray='7 7'
							strokeWidth={1}
							width={USER_CUSTOM_EMOJI_BUTTON_SIZE - USER_CUSTOM_UPLOAD_BORDER_INSET * 2}
							x={USER_CUSTOM_UPLOAD_BORDER_INSET}
							y={USER_CUSTOM_UPLOAD_BORDER_INSET}
						/>
					</Svg>
					<CustomIcon name='add' size={28} />
				</Touch>
			);
		}
		if (isUploadingEmoji(item)) {
			return (
				<View style={[styles.userCustomEmojiButton, styles.uploadingEmojiButton]} testID={`emoji-uploading-${item.name}`}>
					<Image style={styles.userCustomCategoryEmoji} source={{ uri: item.thumbUrl }} contentFit='contain' />
					<View style={styles.uploadingEmojiOverlay}>
						<ActivityIndicator size='small' />
					</View>
				</View>
			);
		}
		return (
			<PressableEmoji
				emoji={item}
				buttonStyle={category === 'userCustom' ? styles.userCustomEmojiButton : undefined}
				customEmojiStyle={category === 'userCustom' ? styles.userCustomCategoryEmoji : undefined}
				onLongPress={handleUserCustomEmojiLongPress}
				onPress={onEmojiSelected}
			/>
		);
	};

	return (
		<FlatList
			key={`emoji-category-${parentWidth}`}
			keyExtractor={item => (typeof item === 'string' ? item : item.name)}
			data={emojis || visibleItems}
			renderItem={renderItem}
			numColumns={numColumns}
			contentContainerStyle={{
				marginHorizontal,
				...(category === 'userCustom' && styles.userCustomContentContainer),
				...(contentPaddingBottom != null && { paddingBottom: contentPaddingBottom })
			}}
			{...scrollPersistTaps}
			keyboardDismissMode='none'
			nestedScrollEnabled
		/>
	);
};

export default memo(EmojiCategory);
