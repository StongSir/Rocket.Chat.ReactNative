import React from 'react';
import { Text, Linking } from 'react-native';
import { type Plain as PlainProps } from '@rocket.chat/message-parser';

import { useTheme } from '../../../theme';
import styles from '../styles';
import { themes } from '../../../lib/constants/colors';

interface IPlainProps {
	value: PlainProps['value'];
}

const Plain = ({ value }: IPlainProps): React.ReactElement => {
	const { colors } = useTheme();

	if (typeof value === 'string') {
		const words = value.split(/(\+?(?:[0-9][ -]?){6,}[0-9])/g);
		return (
			<Text accessibilityLabel={value} style={[styles.plainText, { color: colors.fontDefault }]}>
				{words.map((word, index) => {
					const cleanNumber = word.replace(/[^\d+]/g, '');
					if (cleanNumber.length >= 7 && cleanNumber.length <= 20 && /[\d]/.test(word)) {
						return (
							<Text
								key={index}
								style={{ color: colors.fontInfo, textDecorationLine: 'underline' }}
								onPress={() => Linking.openURL(`tel:${cleanNumber}`)}>
								{word}
							</Text>
						);
					}
					return word;
				})}
			</Text>
		);
	}

	return (
		<Text accessibilityLabel={value} style={[styles.plainText, { color: colors.fontDefault }]}>
			{value}
		</Text>
	);
};

export default Plain;
