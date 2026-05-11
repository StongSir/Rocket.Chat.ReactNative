import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import MessageActions, { type IMessageActions } from './index';
import { mockedStore } from '../../reducers/mockedStore';
import { initStore } from '../../lib/store/auxStore';
import { setUser } from '../../actions/login';
import { setPermissions } from '../../actions/permissions';

const mockShowActionSheet = jest.fn();
const mockHideActionSheet = jest.fn();

jest.mock('../ActionSheet', () => ({
	useActionSheet: () => ({
		showActionSheet: mockShowActionSheet,
		hideActionSheet: mockHideActionSheet
	}),
	ACTION_SHEET_ANIMATION_DURATION: 300
}));

describe('MessageActions', () => {
	beforeEach(() => {
		mockShowActionSheet.mockClear();
		mockHideActionSheet.mockClear();
		mockedStore.dispatch(
			setUser({
				id: 'current-user',
				username: 'rocket.cat',
				roles: ['user']
			})
		);
		mockedStore.dispatch(setPermissions({}));
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
});
