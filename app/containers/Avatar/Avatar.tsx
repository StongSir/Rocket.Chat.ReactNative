import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import Touchable from 'react-native-platform-touchable';
import { settings as RocketChatSettings } from '@rocket.chat/sdk';

import Emoji from '../markdown/components/emoji/Emoji';
import { getAvatarURL } from '../../lib/methods/helpers/getAvatarUrl';
import { SubscriptionType } from '../../definitions';
import { type IAvatar } from './interfaces';
import MarkdownContext from '../markdown/contexts/MarkdownContext';
import I18n from '../../i18n';

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
			borderRadius,
			overflow: 'hidden' as const
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
		} else {
			const isChinese = /[\u4e00-\u9fa5]/.test(text || '');
			if (isChinese && !avatar) {
				const color = (str: string) => {
					let hash = 0;
					for (let i = 0; i < str.length; i++) {
						hash = str.charCodeAt(i) + ((hash << 5) - hash);
					}
					const c = (hash & 0x00ffffff).toString(16).toUpperCase();
					return '#' + '00000'.substring(0, 6 - c.length) + c;
				};

				image = (
					<View style={[avatarStyle, { backgroundColor: color(text || ''), alignItems: 'center', justifyContent: 'center' }]}>
						<Text style={{ color: '#fff', fontSize: size / 2, fontWeight: 'bold' }}>{(text || '').slice(0, 1)}</Text>
					</View>
				);
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
		}

		if (onPress) {
			image = (
				<Touchable accessible={accessible} accessibilityLabel={avatarAccessibilityLabel} onPress={onPress}>
					{image}
				</Touchable>
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
