import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import MessageActions, { type IMessageActions } from './index';
import { mockedStore } from '../../reducers/mockedStore';
import { initStore } from '../../lib/store/auxStore';
import { setUser } from '../../actions/login';
import { setPermissions } from '../../actions/permissions';
import { setCustomEmojis } from '../../actions/customEmojis';
import { collectMyCustomEmoji } from '../../lib/services/customEmojiService';

const mockShowActionSheet = jest.fn();
const mockHideActionSheet = jest.fn();

jest.mock('../ActionSheet', () => ({
	useActionSheet: () => ({
		showActionSheet: mockShowActionSheet,
		hideActionSheet: mockHideActionSheet
	}),
	ACTION_SHEET_ANIMATION_DURATION: 300
}));

jest.mock('../../lib/services/customEmojiService', () => ({
	collectMyCustomEmoji: jest.fn()
}));

describe('MessageActions', () => {
	beforeEach(() => {
		mockShowActionSheet.mockClear();
		mockHideActionSheet.mockClear();
		(collectMyCustomEmoji as jest.Mock).mockClear();
		mockedStore.dispatch(
			setUser({
				id: 'current-user',
				username: 'rocket.cat',
				roles: ['user']
			})
		);
		mockedStore.dispatch(setPermissions({}));
		mockedStore.dispatch(setCustomEmojis({}));
		initStore(mockedStore);
	});

	test('shows mention user as first action and passes username to composer', async () => {
		const mentionInit = jest.fn();
		const ref = React.createRef<IMessageActions>();

		render(
			<Provider store={mockedStore}>
				<MessageActions
					ref={ref}
					room={{ t: 'c' } as any}
					user={{ id: 'current-user' }}
					editInit={jest.fn()}
					reactionInit={jest.fn()}
					onReactionPress={jest.fn()}
					replyInit={jest.fn()}
					quoteInit={jest.fn()}
					mentionInit={mentionInit}
					isReadOnly={false}
				/>
			</Provider>
		);

		await act(async () => {
			await ref.current?.showMessageActions({
				id: 'message-id',
				msg: 'hello',
				u: { _id: 'other-user', username: 'john' }
			} as any);
		});

		const { options } = mockShowActionSheet.mock.calls[0][0];
		expect(options[0]).toEqual(
			expect.objectContaining({
				title: '@他/她',
				testID: 'message-actions-mention-user'
			})
		);

		options[0].onPress();
		expect(mentionInit).toHaveBeenCalledWith('john');
	});

	test('collects a custom emoji from message actions', async () => {
		(collectMyCustomEmoji as jest.Mock).mockResolvedValue({ id: '1', name: 'u_party', extension: 'png' });
		mockedStore.dispatch(setCustomEmojis({ u_party: { name: 'u_party', extension: 'png' } }));
		const ref = React.createRef<IMessageActions>();

		render(
			<Provider store={mockedStore}>
				<MessageActions
					ref={ref}
					room={{ t: 'c' } as any}
					user={{ id: 'current-user' }}
					editInit={jest.fn()}
					reactionInit={jest.fn()}
					onReactionPress={jest.fn()}
					replyInit={jest.fn()}
					quoteInit={jest.fn()}
					mentionInit={jest.fn()}
					isReadOnly={false}
				/>
			</Provider>
		);

		await act(async () => {
			await ref.current?.showMessageActions({
				id: 'message-id',
				msg: 'hello :u_party:',
				u: { _id: 'other-user', username: 'john' }
			} as any);
		});

		const { options } = mockShowActionSheet.mock.calls[0][0];
		const collectOption = options.find((option: any) => option.testID === 'message-actions-collect-custom-emoji');
		expect(collectOption).toBeTruthy();

		await act(async () => {
			await collectOption.onPress();
		});

		expect(collectMyCustomEmoji).toHaveBeenCalledWith('u_party');
	});

	test('shows a picker when a message has multiple custom emojis to collect', async () => {
		(collectMyCustomEmoji as jest.Mock).mockResolvedValue({ id: '1', name: 'u_second', extension: 'png' });
		mockedStore.dispatch(
			setCustomEmojis({
				u_first: { name: 'u_first', extension: 'png' },
				u_second: { name: 'u_second', extension: 'png' }
			})
		);
		const ref = React.createRef<IMessageActions>();

		render(
			<Provider store={mockedStore}>
				<MessageActions
					ref={ref}
					room={{ t: 'c' } as any}
					user={{ id: 'current-user' }}
					editInit={jest.fn()}
					reactionInit={jest.fn()}
					onReactionPress={jest.fn()}
					replyInit={jest.fn()}
					quoteInit={jest.fn()}
					mentionInit={jest.fn()}
					isReadOnly={false}
				/>
			</Provider>
		);

		await act(async () => {
			await ref.current?.showMessageActions({
				id: 'message-id',
				msg: ':u_first: and :u_second:',
				u: { _id: 'other-user', username: 'john' }
			} as any);
		});

		const firstSheetOptions = mockShowActionSheet.mock.calls[0][0].options;
		const collectOption = firstSheetOptions.find((option: any) => option.testID === 'message-actions-collect-custom-emoji');
		collectOption.onPress();

		const secondSheetOptions = mockShowActionSheet.mock.calls[1][0].options;
		expect(secondSheetOptions.map((option: any) => option.title)).toEqual([':u_first:', ':u_second:']);

		await act(async () => {
			await secondSheetOptions[1].onPress();
		});

		expect(collectMyCustomEmoji).toHaveBeenCalledWith('u_second');
	});
});
