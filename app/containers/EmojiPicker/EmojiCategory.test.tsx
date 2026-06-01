import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EmojiCategory from './EmojiCategory';
import { deleteMyCustomEmoji, uploadMyCustomEmoji } from '../../lib/services/customEmojiService';

const mockShowActionSheet = jest.fn();
const mockRefreshUserCustomEmojis = jest.fn();

jest.mock('../ActionSheet', () => ({
	useActionSheet: () => ({
		showActionSheet: mockShowActionSheet
	})
}));

jest.mock('../../lib/hooks/useFrequentlyUsedEmoji', () => ({
	useFrequentlyUsedEmoji: () => ({ frequentlyUsed: [], loaded: true })
}));

jest.mock('../../lib/hooks/useUserCustomEmojis', () => ({
	useUserCustomEmojis: () => ({
		emojis: [{ id: 'relation-id', name: 'u_saved', extension: 'png', source: 'collected' }],
		refresh: mockRefreshUserCustomEmojis
	})
}));

jest.mock('../../lib/hooks/useAppSelector', () => ({
	useAppSelector: () => ({})
}));

jest.mock('../../lib/services/customEmojiService', () => ({
	deleteMyCustomEmoji: jest.fn(),
	uploadMyCustomEmoji: jest.fn()
}));

jest.mock('../../lib/methods/getCustomEmojis', () => ({
	getCustomEmojis: jest.fn()
}));

jest.mock('../../lib/methods/helpers/ImagePicker/ImagePicker', () => ({
	openPicker: jest.fn()
}));

const ImagePicker = require('../../lib/methods/helpers/ImagePicker/ImagePicker');

describe('EmojiCategory user custom management', () => {
	beforeEach(() => {
		mockShowActionSheet.mockClear();
		mockRefreshUserCustomEmojis.mockClear();
		(deleteMyCustomEmoji as jest.Mock).mockResolvedValue(undefined);
		(uploadMyCustomEmoji as jest.Mock).mockResolvedValue({ id: 'new-id', name: 'u_new', extension: 'gif' });
		jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
			buttons?.find(button => button.style === 'destructive')?.onPress?.();
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('shows cancel collection action and deletes the user emoji relation after confirmation', async () => {
		const { getByTestId } = render(
			<EmojiCategory parentWidth={320} category='userCustom' onEmojiSelected={jest.fn()} bottomSheet={false} />
		);

		fireEvent(getByTestId('emoji-u_saved'), 'longPress');
		const action = mockShowActionSheet.mock.calls[0][0].options[0];
		expect(action.title).toBe('取消收藏');

		await action.onPress();

		expect(deleteMyCustomEmoji).toHaveBeenCalledWith('relation-id');
		expect(mockRefreshUserCustomEmojis).toHaveBeenCalled();
	});

	it('uses a larger touch target for user custom emoji items', () => {
		const { getByTestId } = render(
			<EmojiCategory parentWidth={320} category='userCustom' onEmojiSelected={jest.fn()} bottomSheet={false} />
		);

		expect(getByTestId('emoji-u_saved')).toHaveStyle({
			height: 76,
			width: 76
		});
	});

	it('uses the upload button as the first user custom grid item', () => {
		const { getByTestId } = render(
			<EmojiCategory parentWidth={320} category='userCustom' onEmojiSelected={jest.fn()} bottomSheet={false} />
		);

		expect(getByTestId('emoji-picker-upload-custom-emoji')).toHaveStyle({
			height: 76,
			width: 76
		});
		expect(getByTestId('emoji-picker-upload-custom-emoji')).toHaveStyle({
			borderRadius: 16
		});
	});

	it('uses the gif extension from mime type when picker returns a temporary jpg path', async () => {
		ImagePicker.openPicker.mockResolvedValue({
			path: '/tmp/react-native-image-crop-picker/temp-image.jpg',
			mime: 'image/gif'
		});
		const { getByTestId } = render(
			<EmojiCategory parentWidth={320} category='userCustom' onEmojiSelected={jest.fn()} bottomSheet={false} />
		);

		fireEvent.press(getByTestId('emoji-picker-upload-custom-emoji'));

		await waitFor(() =>
			expect(uploadMyCustomEmoji).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'temp-image.gif',
					type: 'image/gif'
				})
			)
		);
	});
});
