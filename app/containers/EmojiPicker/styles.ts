import { StyleSheet } from 'react-native';

import sharedStyles from '../../views/Styles';

export const EMOJI_BUTTON_SIZE = 44;
export const EMOJI_SIZE = EMOJI_BUTTON_SIZE - 16;
export const USER_CUSTOM_EMOJI_BUTTON_SIZE = 76;
export const USER_CUSTOM_EMOJI_SIZE = 60;
export const USER_CUSTOM_EMOJI_UPLOAD_RADIUS = 16;

export default StyleSheet.create({
	container: {
		flex: 1
	},
	tabsContainer: {
		flexDirection: 'row',
		width: '100%'
	},
	tab: {
		flexDirection: 'column',
		flex: 1,
		alignItems: 'center'
	},
	tabEmoji: {
		paddingVertical: 4
	},
	tabLine: {
		width: '100%',
		height: 2
	},
	categoryContainer: {
		flex: 1,
		alignItems: 'flex-start'
	},
	categoryInner: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		flex: 1
	},
	categoryEmoji: {
		...sharedStyles.textAlignCenter,
		textAlignVertical: 'center',
		fontSize: EMOJI_SIZE,
		backgroundColor: 'transparent',
		color: '#ffffff'
	},
	customCategoryEmoji: {
		height: EMOJI_SIZE,
		width: EMOJI_SIZE
	},
	userCustomCategoryEmoji: {
		height: USER_CUSTOM_EMOJI_SIZE,
		width: USER_CUSTOM_EMOJI_SIZE
	},
	emojiButton: {
		alignItems: 'center',
		justifyContent: 'center',
		height: EMOJI_BUTTON_SIZE,
		width: EMOJI_BUTTON_SIZE
	},
	userCustomEmojiButton: {
		alignItems: 'center',
		justifyContent: 'center',
		height: USER_CUSTOM_EMOJI_BUTTON_SIZE,
		width: USER_CUSTOM_EMOJI_BUTTON_SIZE
	},
	uploadingEmojiButton: {
		opacity: 0.7
	},
	uploadingEmojiOverlay: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.18)',
		borderRadius: 4
	},
	uploadEmojiButton: {
		alignItems: 'center',
		justifyContent: 'center',
		height: USER_CUSTOM_EMOJI_BUTTON_SIZE,
		width: USER_CUSTOM_EMOJI_BUTTON_SIZE,
		borderRadius: USER_CUSTOM_EMOJI_UPLOAD_RADIUS
	},
	uploadEmojiBorder: {
		...StyleSheet.absoluteFillObject
	},
	userCustomContentContainer: {
		paddingTop: 12
	},
	footerContainer: {
		height: EMOJI_BUTTON_SIZE,
		paddingHorizontal: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderTopWidth: 1
	},
	footerButtonsContainer: {
		height: EMOJI_BUTTON_SIZE,
		width: EMOJI_BUTTON_SIZE,
		justifyContent: 'center',
		alignItems: 'center'
	},
	emojiPickerContainer: { flex: 1 },
	input: {
		height: 32,
		borderWidth: 0,
		paddingVertical: 0,
		borderRadius: 4
	},
	textInputContainer: {
		marginBottom: 0
	}
});
