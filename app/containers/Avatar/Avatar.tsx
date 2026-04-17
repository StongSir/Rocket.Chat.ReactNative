import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { settings as RocketChatSettings } from '@rocket.chat/sdk';

import Emoji from '../markdown/components/emoji/Emoji';
import { getAvatarURL } from '../../lib/methods/helpers/getAvatarUrl';
import { SubscriptionType } from '../../definitions';
import { type IAvatar } from './interfaces';
import MarkdownContext from '../markdown/contexts/MarkdownContext';
import I18n from '../../i18n';
import Touch from '../Touch';

const Avatar = React.memo(
	({
		server,
		style,
		avatar,
		children,
		userId,
		token,
		onPress,
		emoji,
		getCustomEmoji,
		avatarETag,
		avatarLoaded,
		isStatic,
		rid,
		blockUnauthenticatedAccess,
		serverVersion,
		text,
		size = 25,
		borderRadius = 4,
		type = SubscriptionType.DIRECT,
		avatarExternalProviderUrl,
		roomAvatarExternalProviderUrl,
		cdnPrefix,
		accessibilityLabel,
		accessible = true
	}: IAvatar) => {
		if ((!text && !avatar && !emoji && !rid) || !server) {
			return null;
		}

		const avatarAccessibilityLabel = accessibilityLabel ?? I18n.t('Avatar_Photo', { username: text });
		const avatarStyle = {
			width: size,
			height: size,
			borderRadius
		};

		// Check if text contains Chinese characters
		const isChinese = /[\u4e00-\u9fa5]/.test(text || '');

		// Local fallback for Chinese names without custom avatar
		const renderLocalAvatar = () => {
			const getColor = (str: string) => {
				let hash = 0;
				for (let i = 0; i < str.length; i++) {
					hash = str.charCodeAt(i) + ((hash << 5) - hash);
				}
				const c = (hash & 0x00ffffff).toString(16).toUpperCase();
				return '#' + '00000'.substring(0, 6 - c.length) + c;
			};

			return (
				<View style={[avatarStyle, { backgroundColor: getColor(text || ''), alignItems: 'center', justifyContent: 'center' }]}>
					<Text style={{ color: '#fff', fontSize: size / 2, fontWeight: 'bold' }}>{(text || '').slice(0, 1)}</Text>
				</View>
			);
		};

		let image;
		if (emoji) {
			image = (
				<MarkdownContext.Provider
					value={{
						getCustomEmoji
					}}>
					<Emoji
						block={{ type: 'EMOJI', value: { type: 'PLAIN_TEXT', value: emoji }, shortCode: emoji }}
						style={avatarStyle}
						isAvatar={true}
					/>
				</MarkdownContext.Provider>
			);
		} else if (avatarLoaded === false) {
			// Still loading avatarETag, show empty placeholder
			image = (
				<View style={[avatarStyle, { backgroundColor: '#E1E5E8', alignItems: 'center', justifyContent: 'center' }]} />
			);
		} else if (isChinese && !avatarETag && !avatar) {
			// Chinese name without custom avatar - use local fallback
			image = renderLocalAvatar();
		} else {
			let uri = avatar;
			if (!isStatic) {
				uri = getAvatarURL({
					type,
					text,
					size,
					userId,
					token,
					avatar,
					server,
					avatarETag,
					serverVersion,
					rid,
					blockUnauthenticatedAccess,
					avatarExternalProviderUrl,
					roomAvatarExternalProviderUrl,
					cdnPrefix
				});
			}

			image = (
				<Image
					style={avatarStyle}
					source={{
						uri,
						headers: RocketChatSettings.customHeaders
					}}
					priority='high'
				/>
			);
		}

		if (onPress) {
			image = (
				<Touch accessible={accessible} accessibilityLabel={avatarAccessibilityLabel} onPress={onPress}>
					{image}
				</Touch>
			);
		}

		return (
			<View
				accessible={accessible}
				accessibilityLabel={!onPress ? avatarAccessibilityLabel : undefined}
				style={[avatarStyle, style]}
				testID='avatar'>
				{image}
				{children}
			</View>
		);
	}
);

export default Avatar;
