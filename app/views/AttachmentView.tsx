import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useHeaderHeight } from '@react-navigation/elements';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, PermissionsAndroid, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shallowEqual } from 'react-redux';
import * as FileSystem from 'expo-file-system';
import { Q } from '@nozbe/watermelondb';

import { isImageBase64 } from '../lib/methods/isImageBase64';
import RCActivityIndicator from '../containers/ActivityIndicator';
import * as HeaderButton from '../containers/Header/components/HeaderButton';
import { ImageViewer } from '../containers/ImageViewer';
import { LISTENER } from '../containers/Toast';
import { type IAttachment } from '../definitions';
import I18n from '../i18n';
import { useAppSelector } from '../lib/hooks/useAppSelector';
import { useAppNavigation, useAppRoute } from '../lib/hooks/navigation';
import { formatAttachmentUrl, isAndroid, fileDownload, showErrorAlert } from '../lib/methods/helpers';
import EventEmitter from '../lib/methods/helpers/events';
import { getUserSelector } from '../selectors/login';
import { type TNavigation } from '../stacks/stackType';
import { useTheme } from '../theme';
import { LOCAL_DOCUMENT_DIRECTORY, getFilename } from '../lib/methods/handleMediaDownload';
import database from '../lib/database';

// --- Gallery Item Model ---
interface IGalleryItem {
	attachment: IAttachment;
	messageId: string;
	attachmentIndex: number;
	ts: Date;
}

// --- Hook: query locally cached images from DB ---
const useRoomImages = (
	rid?: string,
	tmid?: string,
	currentAttachment?: IAttachment,
	currentMessageId?: string,
	currentAttachmentIndex?: number
) => {
	const [images, setImages] = useState<IGalleryItem[]>([]);
	const [initialIndex, setInitialIndex] = useState(0);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!rid || !currentAttachment?.image_url) {
			setReady(true);
			return;
		}

		const fetchImages = async () => {
			try {
				const db = database.active;
				const tableName = tmid ? 'thread_messages' : 'messages';
				const filterField = tmid || rid;

				const allMessages = await db
					.get(tableName)
					.query(Q.where('rid', filterField), Q.sortBy('ts', Q.asc))
					.fetch();

				const galleryItems: IGalleryItem[] = [];
				allMessages.forEach(msg => {
					const attachments = (msg as any).attachments;
					if (attachments && Array.isArray(attachments)) {
						attachments.forEach((att: IAttachment, attIdx: number) => {
							if (att.image_url) {
								galleryItems.push({
									attachment: att,
									messageId: msg.id,
									attachmentIndex: attIdx,
									ts: msg.ts instanceof Date ? msg.ts : new Date(msg.ts as any)
								});
							}
						});
					}
				});

				// Primary match: messageId + attachmentIndex
				let idx = -1;
				if (currentMessageId != null && currentAttachmentIndex != null) {
					idx = galleryItems.findIndex(
						item => item.messageId === currentMessageId && item.attachmentIndex === currentAttachmentIndex
					);
				}
				// Fallback: match by image_url
				if (idx < 0) {
					idx = galleryItems.findIndex(item => item.attachment.image_url === currentAttachment.image_url);
				}

				setImages(galleryItems);
				setInitialIndex(idx >= 0 ? idx : 0);
			} catch (e) {
				console.log('useRoomImages error:', e);
			} finally {
				setReady(true);
			}
		};

		fetchImages();
	}, [rid, tmid]);

	return { images, initialIndex, ready };
};

// --- Helper: get title from attachment ---
const getTitleFromAttachment = (att: IAttachment): string => {
	const { image_url, video_url, title_link, title } = att;

	if (title) {
		try {
			return decodeURI(title);
		} catch {
			return title;
		}
	}

	const url = image_url ?? video_url ?? title_link;
	if (!url) return '';

	const parts = url.split('/');
	return parts.at(-1) || '';
};

// --- Component: render a single image in gallery with zoom support ---
const RenderImageContent = ({
	attachment,
	onLoadEnd,
	onZoomStateChange
}: {
	attachment: IAttachment;
	onLoadEnd?: () => void;
	onZoomStateChange?: (isZoomed: boolean) => void;
}) => {
	const insets = useSafeAreaInsets();
	const { width, height } = useWindowDimensions();
	const headerHeight = useHeaderHeight();
	const { baseUrl, user } = useAppSelector(
		state => ({
			baseUrl: state.server.server,
			user: { id: getUserSelector(state).id, token: getUserSelector(state).token }
		}),
		shallowEqual
	);

	const url = formatAttachmentUrl(attachment.title_link || attachment.image_url, user.id, user.token, baseUrl);
	const uri = encodeURI(url);

	return (
		<ImageViewer
			uri={uri}
			onLoadEnd={onLoadEnd}
			width={width}
			height={height - insets.top - insets.bottom - (headerHeight || 0)}
			onZoomStateChange={onZoomStateChange}
		/>
	);
};

// --- Component: render video (unchanged from original) ---
const RenderVideoContent = ({
	setLoading,
	attachment
}: {
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
	attachment: IAttachment;
}) => {
	const videoRef = React.useRef<Video>(null);
	const navigation = useAppNavigation<TNavigation, 'AttachmentView'>();
	const { baseUrl, user } = useAppSelector(
		state => ({
			baseUrl: state.server.server,
			user: { id: getUserSelector(state).id, token: getUserSelector(state).token }
		}),
		shallowEqual
	);

	useLayoutEffect(() => {
		const blurSub = navigation.addListener('blur', () => {
			if (videoRef.current && videoRef.current.stopAsync) {
				videoRef.current.stopAsync();
			}
		});
		return () => {
			blurSub();
		};
	}, [navigation]);

	const url = formatAttachmentUrl(attachment.title_link || attachment.video_url, user.id, user.token, baseUrl);
	const uri = encodeURI(url);

	return (
		<Video
			source={{ uri }}
			rate={1.0}
			volume={1.0}
			isMuted={false}
			resizeMode={ResizeMode.CONTAIN}
			shouldPlay
			isLooping={false}
			style={{ flex: 1 }}
			useNativeControls
			onLoad={() => setLoading(false)}
			onError={() => {
				navigation.pop();
				showErrorAlert(I18n.t('Error_play_video'));
			}}
			ref={videoRef}
		/>
	);
};

// --- Main Component ---
const AttachmentView = (): React.ReactElement => {
	const navigation = useAppNavigation<TNavigation, 'AttachmentView'>();
	const {
		params: { attachment, rid, messageId, attachmentIndex, tmid }
	} = useAppRoute<TNavigation, 'AttachmentView'>();
	const [loading, setLoading] = useState(true);
	const [isZoomed, setIsZoomed] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
	const flatListRef = useRef<FlatList>(null);
	const { colors } = useTheme();
	const { width: screenWidth } = useWindowDimensions();

	const { baseUrl, user, Allow_Save_Media_to_Gallery } = useAppSelector(
		state => ({
			baseUrl: state.server.server,
			user: { id: getUserSelector(state).id, token: getUserSelector(state).token },
			Allow_Save_Media_to_Gallery: (state.settings.Allow_Save_Media_to_Gallery as boolean) ?? true
		}),
		shallowEqual
	);

	// Gallery data
	const { images, initialIndex, ready } = useRoomImages(rid, tmid, attachment, messageId, attachmentIndex);
	const isGalleryMode = !!attachment.image_url && images.length > 1;

	console.log('[AttachmentView] gallery debug:', {
		rid,
		tmid,
		messageId,
		attachmentIndex,
		hasImageUrl: !!attachment.image_url,
		imagesCount: images.length,
		initialIndex,
		ready,
		isGalleryMode
	});

	// The attachment currently being displayed — all header/download logic is based on this
	const currentAttachment = isGalleryMode ? images[currentIndex]?.attachment ?? attachment : attachment;

	// --- Save handler bound to current attachment ---
	const handleSave = useCallback(
		async (att: IAttachment) => {
			const { title_link, image_url, image_type, video_url, video_type } = att;
			const url = video_url || title_link || image_url;

			if (!url) {
				return;
			}

			if (isAndroid) {
				const rationale = {
					title: I18n.t('Write_External_Permission'),
					message: I18n.t('Write_External_Permission_Message'),
					buttonPositive: 'Ok'
				};
				const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, rationale);
				if (!(result || result === PermissionsAndroid.RESULTS.GRANTED)) {
					return;
				}
			}

			setLoading(true);
			try {
				if (LOCAL_DOCUMENT_DIRECTORY && url.startsWith(LOCAL_DOCUMENT_DIRECTORY)) {
					await CameraRoll.save(url, { album: 'Rocket.Chat' });
				} else {
					const mediaAttachment = formatAttachmentUrl(url, user.id, user.token, baseUrl);
					let filename = '';
					if (image_url) {
						filename = getFilename({ title: att.title, type: 'image', mimeType: image_type, url });
					} else {
						filename = getFilename({ title: att.title, type: 'video', mimeType: video_type, url });
					}
					const file = await fileDownload(mediaAttachment, {}, filename);
					await CameraRoll.save(file, { album: 'Rocket.Chat' });
					FileSystem.deleteAsync(file, { idempotent: true });
				}
				EventEmitter.emit(LISTENER, { message: I18n.t('saved_to_gallery') });
			} catch (e) {
				EventEmitter.emit(LISTENER, { message: I18n.t(image_url ? 'error-save-image' : 'error-save-video') });
			}
			setLoading(false);
		},
		[baseUrl, user]
	);

	// --- Update header whenever currentAttachment changes ---
	useLayoutEffect(() => {
		const title = getTitleFromAttachment(currentAttachment);
		const options = {
			title: title || '',
			headerLeft: () => (
				<HeaderButton.CloseModal
					testID='close-attachment-view'
					navigation={navigation}
					color={colors.fontDefault}
					style={{ marginRight: -12 }}
				/>
			),
			headerRight:
				Allow_Save_Media_to_Gallery && !isImageBase64(currentAttachment.image_url)
					? () => (
							<HeaderButton.Download
								testID='save-image'
								onPress={() => handleSave(currentAttachment)}
								color={colors.fontDefault}
							/>
						)
					: undefined
		};
		navigation.setOptions(options);
	}, [currentAttachment, navigation, colors, Allow_Save_Media_to_Gallery, handleSave]);

	// --- Gallery page change callback ---
	const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
		if (viewableItems.length > 0 && viewableItems[0].index != null) {
			setCurrentIndex(viewableItems[0].index);
			setIsZoomed(false);
		}
	}, []);

	const handleImageLoaded = useCallback((key: string) => {
		setLoadedKeys(prev => {
			if (prev.has(key)) return prev;
			const next = new Set(prev);
			next.add(key);
			return next;
		});
	}, []);

	const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
	const viewabilityConfigCallbackPairs = useRef([
		{ viewabilityConfig: viewabilityConfig.current, onViewableItemsChanged }
	]);

	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: screenWidth,
			offset: screenWidth * index,
			index
		}),
		[screenWidth]
	);

	// --- Set initial index once gallery data is ready ---
	useEffect(() => {
		if (ready && isGalleryMode && initialIndex > 0) {
			setCurrentIndex(initialIndex);
		}
	}, [ready, initialIndex, isGalleryMode]);

	// --- Gallery mode: horizontal FlatList with paging ---
	if (isGalleryMode && ready) {
		const currentItem = images[currentIndex];
		const currentImageKey = currentItem ? `${currentItem.messageId}-${currentItem.attachmentIndex}` : '';
		const isCurrentImageLoaded = loadedKeys.has(currentImageKey);

		return (
			<View style={{ backgroundColor: colors.surfaceRoom, flex: 1 }}>
				<FlatList
					ref={flatListRef}
					data={images}
					horizontal
					pagingEnabled
					scrollEnabled={!isZoomed}
					initialScrollIndex={initialIndex}
					showsHorizontalScrollIndicator={false}
					keyExtractor={(item, index) => `${item.messageId}-${item.attachmentIndex}-${index}`}
					renderItem={({ item }) => {
						const imageKey = `${item.messageId}-${item.attachmentIndex}`;
						return (
							<View style={{ width: screenWidth, flex: 1 }}>
								<RenderImageContent
									attachment={item.attachment}
									onLoadEnd={() => handleImageLoaded(imageKey)}
									onZoomStateChange={setIsZoomed}
								/>
							</View>
						);
					}}
					viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
					getItemLayout={getItemLayout}
				/>
				{!isCurrentImageLoaded ? <RCActivityIndicator absolute size='large' /> : null}
			</View>
		);
	}

	// --- Single image / video mode (original behavior) ---
	return (
		<View style={{ backgroundColor: colors.surfaceRoom, flex: 1 }}>
			{attachment.image_url ? (
				<RenderImageContent attachment={attachment} onLoadEnd={() => setLoading(false)} />
			) : attachment.video_url ? (
				<RenderVideoContent attachment={attachment} setLoading={setLoading} />
			) : null}
			{loading ? <RCActivityIndicator absolute size='large' /> : null}
		</View>
	);
};

export default AttachmentView;
