import React, { useContext } from 'react';
import { Text, View } from 'react-native';
import { dequal } from 'dequal';

import I18n from '../../i18n';
import styles from './styles';
import Markdown, { MarkdownPreview } from '../markdown';
import User from './User';
import { messageHaveAuthorName, getInfoMessage } from './utils';
import MessageContext from './Context';
import { type IMessageContent } from './interfaces';
import { useTheme, ThemeContext } from '../../theme';
import { themes } from '../../lib/constants/colors';
import { type MessageTypesValues } from '../../definitions';

const Content = React.memo(
	(props: IMessageContent) => {
		'use memo';

		const { theme } = useTheme();
		const { user, onLinkPress } = useContext(MessageContext);

		if (props.isInfo) {
			// @ts-ignore
			const infoMessage = getInfoMessage({ ...props });

			const renderMessageContent = (
				<Text style={[styles.textInfo, { color: themes[theme].fontSecondaryInfo }]} accessibilityLabel={infoMessage}>
					{infoMessage}
				</Text>
			);
			if (messageHaveAuthorName(props.type as MessageTypesValues)) {
				return (
					<Text>
						<User {...props} /> {renderMessageContent}
					</Text>
				);
			}

			return renderMessageContent;
		}

		const isPreview = props.tmid && !props.isThreadRoom;
		let content = null;

		if (props.isEncrypted) {
			content = (
				<Text
					style={[styles.textInfo, { color: themes[theme].fontSecondaryInfo }]}
					accessibilityLabel={I18n.t('Encrypted_message')}
					testID='message-encrypted'>
					{I18n.t('Encrypted_message')}
				</Text>
			);
		} else if (isPreview) {
			content = <MarkdownPreview testID={`message-preview-${props.msg}`} msg={props.msg} />;
		} else if (props.msg && props.msg.trim()) {
			content = (
				<Markdown
					msg={props.msg}
					md={props.type !== 'e2e' ? props.md : undefined}
					getCustomEmoji={props.getCustomEmoji}
					username={user.username}
					channels={props.channels}
					mentions={props.mentions}
					navToRoomInfo={props.navToRoomInfo}
					useRealName={props.useRealName}
					onLinkPress={onLinkPress}
					isTranslated={props.isTranslated}
				/>
			);
		}

		if (props.isIgnored) {
			content = (
				<Text style={[styles.textInfo, { color: themes[theme].fontSecondaryInfo }]} testID={`message-ignored-${props.msg}`}>
					{I18n.t('Message_Ignored')}
				</Text>
			);
		}

		// Determine bubble style based on message ownership and theme
		// Only apply bubble for actual text messages
		const shouldShowBubble = content && props.msg && props.msg.trim() && !props.isInfo && !props.isIgnored;

		// Theme-aware bubble colors
		const isDarkTheme = theme === 'dark' || theme === 'black';
		const bubbleColors = {
			own: '#127fec',                              // Same blue for both themes
			other: isDarkTheme ? '#3D3D3D' : '#E8E8E8'   // Dark gray for dark, Light gray for light
		};

		const bubbleStyle = shouldShowBubble
			? [
				props.isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
				{ backgroundColor: props.isOwnMessage ? bubbleColors.own : bubbleColors.other }
			]
			: undefined;

		// Override theme to 'dark' for own messages in light mode to force white text
		const themeOverride = props.isOwnMessage && theme === 'light' ? 'dark' : theme;

		return content ? (
			<View
				style={[bubbleStyle, props.isTemp && styles.temp]}
				testID={`message-content-${props.msg || ''}`}
			>
				<ThemeContext.Provider value={{ theme: themeOverride, colors: themes[themeOverride] }}>
					{content}
				</ThemeContext.Provider>
			</View>
		) : null;
	},
	(prevProps, nextProps) => {
		if (prevProps.isTemp !== nextProps.isTemp) {
			return false;
		}
		if (prevProps.msg !== nextProps.msg) {
			return false;
		}
		if (prevProps.type !== nextProps.type) {
			return false;
		}
		if (prevProps.isEncrypted !== nextProps.isEncrypted) {
			return false;
		}
		if (prevProps.isIgnored !== nextProps.isIgnored) {
			return false;
		}
		if (!dequal(prevProps.md, nextProps.md)) {
			return false;
		}
		if (!dequal(prevProps.mentions, nextProps.mentions)) {
			return false;
		}
		if (!dequal(prevProps.channels, nextProps.channels)) {
			return false;
		}
		return true;
	}
);

Content.displayName = 'MessageContent';

export default Content;
