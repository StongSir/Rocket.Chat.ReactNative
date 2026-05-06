import { dequal } from 'dequal';
import React, { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { type IAttachment, type TGetCustomEmoji } from '../../../../definitions';
import { themes } from '../../../../lib/constants/colors';
import { fileDownloadAndPreview } from '../../../../lib/methods/helpers';
import { formatAttachmentUrl } from '../../../../lib/methods/helpers/formatAttachmentUrl';
import openLink from '../../../../lib/methods/helpers/openLink';
import { type TSupportedThemes, useTheme } from '../../../../theme';
import sharedStyles from '../../../../views/Styles';
import RCActivityIndicator from '../../../ActivityIndicator';
import Markdown, { MarkdownPreview } from '../../../markdown';
import { Attachments } from './components';
import MessageContext from '../../Context';
import Touchable from '../../Touchable';
import messageStyles from '../../styles';
import dayjs from '../../../../lib/dayjs';
import { CustomIcon } from '../../../CustomIcon';

// Decode URL-encoded filenames (fixes Chinese filename display issue)
const decodeFilename = (filename: string | undefined): string | undefined => {
	if (!filename) return filename;
	try {
		// Only decode if it looks like URL-encoded (contains %)
		if (filename.includes('%')) {
			return decodeURIComponent(filename);
		}
		return filename;
	} catch {
		return filename;
	}
};

const styles = StyleSheet.create({
	// Base button style
	button: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start'
	},
	// Style for quoted messages - dashed border
	quoteButton: {
		borderWidth: 1,
		borderStyle: 'dashed',
		borderRadius: 8,
		padding: 8
	},
	// Style for file attachments - simple row with icon
	fileButton: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		gap: 8
	},
	fileIcon: {
		marginRight: 4
	},
	fileName: {
		flex: 1,
		fontSize: 14,
		...sharedStyles.textMedium
	},
	attachmentContainer: {
		flex: 1,
		borderRadius: 4,
		flexDirection: 'row',
		paddingVertical: 4,
		paddingLeft: 8
	},
	backdrop: {
		...StyleSheet.absoluteFillObject
	},
	authorContainer: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4
	},
	titleAndDescriptionContainer: {
		flexDirection: 'column',
		flex: 1,
		width: 200,
		gap: 4
	},
	author: {
		fontSize: 16,
		...sharedStyles.textMedium,
		flexShrink: 1
	},
	fieldsContainer: {
		flex: 1,
		flexWrap: 'wrap',
		flexDirection: 'row',
		rowGap: 12
	},
	fieldContainer: {
		flexDirection: 'column'
	},
	fieldTitle: {
		fontSize: 14,
		...sharedStyles.textSemibold
	},
	fieldValue: {
		fontSize: 14,
		...sharedStyles.textRegular
	},
	marginTop: {
		marginTop: 4
	},
	marginBottom: {
		marginBottom: 4
	},
	image: {
		height: 80,
		width: 80,
		borderTopLeftRadius: 4,
		borderTopRightRadius: 4,
		marginBottom: 1,
		marginLeft: 20
	},
	title: {
		flex: 1,
		fontSize: 16,
		...sharedStyles.textMedium
	}
});

interface IMessageReply {
	attachment: IAttachment;
	timeFormat?: string;
	getCustomEmoji: TGetCustomEmoji;
	msg?: string;
	showAttachment?: (file: IAttachment) => void;
	isOwnMessage?: boolean;
}

const Title = React.memo(
	({ attachment, timeFormat, theme }: { attachment: IAttachment; timeFormat?: string; theme: TSupportedThemes }) => {
		'use memo';

		// Format time: show only time for today, show full date+time for older messages
		let time: string | null = null;
		if (attachment.message_link && attachment.ts) {
			const messageDate = dayjs(attachment.ts);
			const isToday = messageDate.isSame(dayjs(), 'day');
			time = isToday ? messageDate.format(timeFormat) : messageDate.format('YYYY-MM-DD HH:mm');
		}
		return (
			<View style={styles.authorContainer}>
				{attachment.author_name ? (
					<Text numberOfLines={1} style={[styles.author, { color: themes[theme].fontHint }]}>
						{attachment.author_name}
					</Text>
				) : null}
				{time ? <Text style={[messageStyles.time, { color: themes[theme].fontSecondaryInfo }]}>{time}</Text> : null}
				{attachment.title ? <Text style={[styles.title, { color: themes[theme].fontDefault }]}>{decodeFilename(attachment.title)}</Text> : null}
			</View>
		);
	}
);

const Description = React.memo(
	({ attachment, getCustomEmoji }: { attachment: IAttachment; getCustomEmoji: TGetCustomEmoji }) => {
		'use memo';

		const { user } = useContext(MessageContext);
		const text = attachment.text || decodeFilename(attachment.title);

		if (!text) {
			return null;
		}

		// For file attachments without explicit text, the title is just a filename (e.g., "test.py").
		// We use MarkdownPreview to avoid markdown parsing treating filenames as URLs or markdown syntax.
		// For other attachments (message quotes, embeds), the text may contain actual markdown formatting,
		// so we use the full Markdown component to preserve styling.
		const isFileName = attachment.type === 'file' && !attachment.text;

		if (isFileName) {
			return <MarkdownPreview msg={text} numberOfLines={0} />;
		}

		return <Markdown msg={text} username={user.username} getCustomEmoji={getCustomEmoji} />;
	},
	(prevProps, nextProps) => {
		if (prevProps.attachment.text !== nextProps.attachment.text) {
			return false;
		}
		if (prevProps.attachment.title !== nextProps.attachment.title) {
			return false;
		}
		if (prevProps.attachment.type !== nextProps.attachment.type) {
			return false;
		}
		return true;
	}
);

const UrlImage = React.memo(
	({ image }: { image?: string }) => {
		'use memo';

		const { baseUrl, user } = useContext(MessageContext);

		if (!image) {
			return null;
		}

		image = image.includes('http') ? image : `${baseUrl}/${image}?rc_uid=${user.id}&rc_token=${user.token}`;
		return <Image source={{ uri: image }} style={styles.image} contentFit='cover' />;
	},
	(prevProps, nextProps) => prevProps.image === nextProps.image
);

const Fields = React.memo(
	({
		attachment,
		theme,
		getCustomEmoji
	}: {
		attachment: IAttachment;
		theme: TSupportedThemes;
		getCustomEmoji: TGetCustomEmoji;
	}) => {
		'use memo';

		const { user } = useContext(MessageContext);

		if (!attachment.fields) {
			return null;
		}

		return (
			<View style={styles.fieldsContainer}>
				{attachment.fields.map(field => (
					<View key={field.title} style={[styles.fieldContainer, { width: field.short ? '50%' : '100%' }]}>
						<Text style={[styles.fieldTitle, { color: themes[theme].fontDefault }]}>{field.title}</Text>
						<Markdown msg={field?.value || ''} username={user.username} getCustomEmoji={getCustomEmoji} />
					</View>
				))}
			</View>
		);
	},
	(prevProps, nextProps) =>
		dequal(prevProps.attachment.fields, nextProps.attachment.fields) && prevProps.theme === nextProps.theme
);

const Reply = React.memo(
	({ attachment, timeFormat, getCustomEmoji, msg, showAttachment, isOwnMessage }: IMessageReply) => {
		'use memo';

		const [loading, setLoading] = useState(false);
		const { theme } = useTheme();
		const { baseUrl, user, id, e2e, isEncrypted } = useContext(MessageContext);

		if (!attachment || (isEncrypted && !e2e)) {
			return null;
		}

		const isFileAttachment = attachment.type === 'file';

		const onPress = async () => {
			let url = attachment.title_link || attachment.author_link;
			if (!url) {
				return;
			}
			if (isFileAttachment && attachment.title_link) {
				setLoading(true);
				url = formatAttachmentUrl(attachment.title_link, user.id, user.token, baseUrl);
				await fileDownloadAndPreview(url, attachment, id);
				setLoading(false);
				return;
			}
			openLink(url, theme);
		};

		let { strokeLight } = themes[theme];
		if (attachment.color) {
			strokeLight = attachment.color;
		}

		// File attachment: simple icon + filename display
		if (isFileAttachment) {
			return (
				<View style={{ gap: 4, marginBottom: 8 }}>
					<Touchable
						testID={`file-${attachment?.title}`}
						onPress={onPress}
						style={[
							styles.button,
							styles.fileButton,
							{
								backgroundColor: themes[theme].surfaceNeutral,
								alignSelf: isOwnMessage ? 'flex-end' : 'flex-start'
							}
						]}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
							<CustomIcon name='file-document' size={20} color={themes[theme].fontSecondaryInfo} />
							<Text
								style={[styles.fileName, { color: themes[theme].fontDefault }]}
								numberOfLines={1}
								ellipsizeMode='middle'>
								{decodeFilename(attachment.title)}
							</Text>
							{loading ? <RCActivityIndicator size={16} /> : null}
						</View>
					</Touchable>
					{msg ? <Markdown msg={msg} username={user.username} getCustomEmoji={getCustomEmoji} /> : null}
				</View>
			);
		}

		// Quoted message: dashed border with full content
		return (
			<View style={{ gap: 4, marginBottom: 8 }}>
				<Touchable
					testID={`reply-${attachment?.author_name}-${attachment?.text}`}
					onPress={onPress}
					style={[
						styles.button,
						styles.quoteButton,
						{
							borderColor: strokeLight,
							alignSelf: isOwnMessage ? 'flex-end' : 'flex-start'
						}
					]}
					disabled={!!(loading || attachment.message_link)}>
					<View style={styles.attachmentContainer}>
						<View style={styles.titleAndDescriptionContainer}>
							<Title attachment={attachment} timeFormat={timeFormat} theme={theme} />
							<Description attachment={attachment} getCustomEmoji={getCustomEmoji} />
							<Attachments
								attachments={attachment.attachments}
								getCustomEmoji={getCustomEmoji}
								timeFormat={timeFormat}
								showAttachment={showAttachment}
							/>
							<Fields attachment={attachment} getCustomEmoji={getCustomEmoji} theme={theme} />
							{loading ? (
								<View style={styles.backdrop}>
									<View
										style={[
											styles.backdrop,
											{ backgroundColor: themes[theme].surfaceNeutral, opacity: themes[theme].attachmentLoadingOpacity }
										]}></View>
									<RCActivityIndicator />
								</View>
							) : null}
						</View>
						<UrlImage image={attachment.thumb_url} />
					</View>
				</Touchable>
				{msg ? <Markdown msg={msg} username={user.username} getCustomEmoji={getCustomEmoji} /> : null}
			</View>
		);
	},
	(prevProps, nextProps) => dequal(prevProps.attachment, nextProps.attachment)
);

Reply.displayName = 'MessageReply';
Title.displayName = 'MessageReplyTitle';
Description.displayName = 'MessageReplyDescription';
Fields.displayName = 'MessageReplyFields';

export default Reply;
