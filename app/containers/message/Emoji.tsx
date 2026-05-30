import React, { useEffect } from 'react';
import { Text } from 'react-native';

import useShortnameToUnicode from '../../lib/hooks/useShortnameToUnicode';
import { refreshCustomEmojisOnUnknown } from '../../lib/methods/refreshCustomEmojisOnUnknown';
import CustomEmoji from '../EmojiPicker/CustomEmoji';
import { type IMessageEmoji } from './interfaces';

const Emoji = React.memo(
	({ content, standardEmojiStyle, customEmojiStyle, getCustomEmoji }: IMessageEmoji) => {
		'use memo';

		const parsedContent = content.replace(/^:|:$/g, '');
		const emoji = getCustomEmoji(parsedContent);
		const { formatShortnameToUnicode } = useShortnameToUnicode();
		const emojiUnicode = formatShortnameToUnicode(content);
		useEffect(() => {
			if (!emoji && emojiUnicode === content) {
				refreshCustomEmojisOnUnknown(parsedContent);
			}
		}, [content, emoji, emojiUnicode, parsedContent]);
		if (emoji) {
			return <CustomEmoji key={content} style={customEmojiStyle} emoji={emoji} />;
		}
		return <Text style={standardEmojiStyle}>{emojiUnicode}</Text>;
	},
	() => true
);

Emoji.displayName = 'MessageEmoji';

export default Emoji;
