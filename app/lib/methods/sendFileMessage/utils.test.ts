import * as FileSystem from 'expo-file-system';

import { copyFileToCacheDirectoryIfNeeded, normalizeUploadFileName } from './utils';

jest.mock('expo-file-system', () => ({
	cacheDirectory: 'file:///cache/',
	copyAsync: jest.fn(),
	deleteAsync: jest.fn()
}));

describe('sendFileMessage utils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('normalizeUploadFileName', () => {
		it('decodes URL-encoded unicode file names', () => {
			expect(normalizeUploadFileName('%E9%BE%99%E5%A9%B7.pdf')).toBe('龙婷.pdf');
		});

		it('decodes repeatedly encoded file names', () => {
			expect(normalizeUploadFileName('%25E9%25BE%2599%25E5%25A9%25B7.pdf')).toBe('龙婷.pdf');
		});

		it('keeps malformed encoded file names unchanged', () => {
			expect(normalizeUploadFileName('%E9%ZZ.pdf')).toBe('%E9%ZZ.pdf');
		});
	});

	describe('copyFileToCacheDirectoryIfNeeded', () => {
		it('copies a file uri with an encoded basename to a cache uri with the decoded file name', async () => {
			const result = await copyFileToCacheDirectoryIfNeeded('file:///tmp/%E9%BE%99%E5%A9%B7.pdf', '%E9%BE%99%E5%A9%B7.pdf');

			expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/龙婷.pdf', { idempotent: true });
			expect(FileSystem.copyAsync).toHaveBeenCalledWith({
				from: 'file:///tmp/%E9%BE%99%E5%A9%B7.pdf',
				to: 'file:///cache/龙婷.pdf'
			});
			expect(result).toBe('file:///cache/龙婷.pdf');
		});
	});
});
