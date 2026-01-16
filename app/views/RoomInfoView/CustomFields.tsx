import React from 'react';
import { Alert, Linking } from 'react-native';

import I18n from '../../i18n';
import Item from './Item';

const CustomFields = ({ customFields }: { customFields?: { [key: string]: string } }): React.ReactElement | null => {
	if (customFields) {
		return (
			<>
				{Object.keys(customFields).map((title: string) => {
					if (!customFields[title]) return null;
					const onPress =
						title === 'phone'
							? () =>
								Linking.openURL(`tel:${customFields[title]}`).catch(() => {
									Alert.alert(I18n.t('Error'), I18n.t('Error_opening_phone_dialer')); // Or generic message if translation missing
								})
							: undefined;
					return <Item label={title} content={customFields[title]} onPress={onPress} />;
				})}
			</>
		);
	}

	return null;
};

export default CustomFields;
