import React from 'react';
import { type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';

import styles from './styles';
import { type IEmoji } from '../../definitions/IEmoji';
import { Emoji } from './Emoji';
import Touch from '../Touch';

export const PressableEmoji = ({
	emoji,
	onPress,
	onLongPress,
	buttonStyle,
	customEmojiStyle
}: {
	emoji: IEmoji;
	onPress: (emoji: IEmoji) => void;
	onLongPress?: (emoji: IEmoji) => void;
	buttonStyle?: StyleProp<ViewStyle>;
	customEmojiStyle?: StyleProp<ImageStyle>;
}): React.ReactElement => {
	const accessibilityLabel = typeof emoji === 'string' ? emoji : emoji.name;
	return (
		<Touch
			accessible
			accessibilityLabel={accessibilityLabel}
			key={typeof emoji === 'string' ? emoji : emoji.name}
			onLongPress={onLongPress ? () => onLongPress(emoji) : undefined}
			onPress={() => onPress(emoji)}
			rectButtonStyle={[styles.emojiButton, buttonStyle]}
			style={[styles.emojiButton, buttonStyle]}
			testID={`emoji-${typeof emoji === 'string' ? emoji : emoji.name}`}>
			<Emoji emoji={emoji} customEmojiStyle={customEmojiStyle} />
		</Touch>
	);
};
