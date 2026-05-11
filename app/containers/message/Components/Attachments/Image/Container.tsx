import React, { useContext } from 'react';
import { View } from 'react-native';

import Markdown from '../../../../markdown';
import { useMediaAutoDownload } from '../../../hooks/useMediaAutoDownload';
import { Button } from './Button';
import { MessageImage } from './Image';
import { type IImageContainer } from './definitions';
import MessageContext from '../../../Context';
import { WidthAwareView } from '../../WidthAwareView';

const ImageContainer = ({
	file,
	showAttachment,
	getCustomEmoji,
	author,
	msg,
	imagePreview,
	imageType,
	isOwnMessage,
	attachmentIndex
}: IImageContainer): React.ReactElement | null => {
	'use memo';

	const { user } = useContext(MessageContext);
	const { status, onPress, url, isEncrypted } = useMediaAutoDownload({ file, author, showAttachment, attachmentIndex });

	const image = (
		<Button onPress={onPress}>
			<WidthAwareView>
				<MessageImage uri={url} status={status} encrypted={isEncrypted} imagePreview={imagePreview} imageType={imageType} isOwnMessage={isOwnMessage} />
			</WidthAwareView>
		</Button>
	);

	if (msg) {
		return (
			<View style={{ gap: 4 }}>
				<Markdown msg={msg} username={user.username} getCustomEmoji={getCustomEmoji} />
				{image}
			</View>
		);
	}

	return image;
};

ImageContainer.displayName = 'MessageImageContainer';

export default ImageContainer;
