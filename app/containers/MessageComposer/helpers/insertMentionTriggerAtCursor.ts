import { type IInputSelection } from '../interfaces';

export const insertMentionTriggerAtCursor = (
	text: string,
	selection: IInputSelection
): { text: string; selection: IInputSelection } => {
	const { start, end } = selection;
	const prefix = text.slice(0, start);
	const selectedText = text.slice(start, end);
	const suffix = text.slice(end);
	const separatorBefore = prefix && !/\s$/.test(prefix) ? ' ' : '';
	const insertedText = `${separatorBefore}@${selectedText}`;
	const cursor = start + insertedText.length;

	return {
		text: `${prefix}${insertedText}${suffix}`,
		selection: {
			start: cursor,
			end: start === end ? cursor : end + insertedText.length
		}
	};
};
