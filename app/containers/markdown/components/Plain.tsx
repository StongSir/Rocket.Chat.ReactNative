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
		// Chinese phone number patterns:
		// Mobile: 11 digits starting with 1 (13x, 14x, 15x, 16x, 17x, 18x, 19x)
		// Landline: area code (3-4 digits starting with 0) + hyphen/space (optional) + 7-8 digits
		const chinesePhoneRegex = /(1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g;
		const words = value.split(chinesePhoneRegex);
		return (
			<Text accessibilityLabel={value} style={[styles.plainText, { color: colors.fontDefault }]}>
				{words.map((word, index) => {
					// Check if this word matches Chinese phone pattern
					if (chinesePhoneRegex.test(word)) {
						chinesePhoneRegex.lastIndex = 0; // Reset regex state
						const cleanNumber = word.replace(/[-\s]/g, '');
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
