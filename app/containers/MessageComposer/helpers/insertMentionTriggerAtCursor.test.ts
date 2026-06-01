import { insertMentionTriggerAtCursor } from './insertMentionTriggerAtCursor';

describe('insertMentionTriggerAtCursor', () => {
	test('keeps separator when inserting mention trigger after existing text', () => {
		expect(insertMentionTriggerAtCursor('hello ', { start: 6, end: 6 })).toEqual({
			text: 'hello @',
			selection: { start: 7, end: 7 }
		});
	});

	test('adds separator when inserting mention trigger after existing mention', () => {
		expect(insertMentionTriggerAtCursor('@john', { start: 5, end: 5 })).toEqual({
			text: '@john @',
			selection: { start: 7, end: 7 }
		});
	});

	test('inserts mention trigger at the beginning without separator', () => {
		expect(insertMentionTriggerAtCursor('', { start: 0, end: 0 })).toEqual({
			text: '@',
			selection: { start: 1, end: 1 }
		});
	});
});
