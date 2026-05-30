import React from 'react';
import { Image } from 'expo-image';

import { useAppSelector } from '../../lib/hooks/useAppSelector';
import { type ICustomEmojiProps } from './interfaces';

const CustomEmoji = React.memo(({ emoji, style }: ICustomEmojiProps) => {
	const baseUrl = useAppSelector(state => state.server.server);
	const uri = emoji.thumbUrl || `${baseUrl}/emoji-custom/${encodeURIComponent(emoji.name)}.${emoji.extension}`;
	return (
		<Image
			style={style}
			source={{
				uri
			}}
			contentFit='contain'
		/>
	);
});

export default CustomEmoji;
