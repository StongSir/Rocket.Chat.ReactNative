import i18n from '../../../i18n';

const list = [
	'frequentlyUsed',
	'userCustom',
	'people',
	'nature',
	'food',
	'activity',
	'travel',
	'objects',
	'symbols',
	'flags',
	'custom'
];
const tabs = [
	{
		tabLabel: 'clock',
		category: list[0],
		accessibilityLabel: i18n.t('Recently_used')
	},
	{
		tabLabel: 'star',
		category: list[1],
		accessibilityLabel: i18n.t('Custom')
	},
	{
		tabLabel: 'emoji',
		category: list[2],
		accessibilityLabel: i18n.t('Smileys_and_people')
	},
	{
		tabLabel: 'leaf',
		category: list[3],
		accessibilityLabel: i18n.t('Animals_and_nature')
	},
	{
		tabLabel: 'burger',
		category: list[4],
		accessibilityLabel: i18n.t('Food_and_drink')
	},
	{
		tabLabel: 'basketball',
		category: list[5],
		accessibilityLabel: i18n.t('Activity')
	},
	{
		tabLabel: 'airplane',
		category: list[6],
		accessibilityLabel: i18n.t('Travel_and_places')
	},
	{
		tabLabel: 'lamp-bulb',
		category: list[7],
		accessibilityLabel: i18n.t('Objects')
	},
	{
		tabLabel: 'percentage',
		category: list[8],
		accessibilityLabel: i18n.t('Symbols')
	},
	{
		tabLabel: 'flag',
		category: list[9],
		accessibilityLabel: i18n.t('Flags')
	},
	{
		tabLabel: 'rocket',
		category: list[10],
		accessibilityLabel: i18n.t('Custom')
	}
] as const;
export const categories = { list, tabs };
