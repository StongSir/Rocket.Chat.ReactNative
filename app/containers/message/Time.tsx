import React from 'react';
import { Text } from 'react-native';

import dayjs from '../../lib/dayjs';
import { useTheme } from '../../theme';
import messageStyles from './styles';

interface IMessageTime {
	ts?: Date;
	timeFormat?: string;
}

const MessageTime = ({ timeFormat, ts }: IMessageTime) => {
	'use memo';

	const { colors } = useTheme();

	// Check if the message is from today
	const isToday = dayjs(ts).isSame(dayjs(), 'day');
	// Today: show time only; Earlier: show full date and time
	const time = isToday ? dayjs(ts).format(timeFormat) : dayjs(ts).format('YYYY-MM-DD HH:mm');

	return <Text style={[messageStyles.time, { color: colors.fontSecondaryInfo }]}>{time}</Text>;
};

export default MessageTime;
