import * as FileSystem from 'expo-file-system';

import { Upload } from './Upload';

jest.mock('expo-file-system', () => ({
	FileSystemUploadType: {
		MULTIPART: 'multipart'
	},
	createUploadTask: jest.fn()
}));

describe('Upload', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('uses expo-file-system multipart upload so iOS keeps the cache file basename as the uploaded filename', async () => {
		const uploadAsync = jest.fn(() =>
			Promise.resolve({
				status: 200,
				body: JSON.stringify({ success: true })
			})
		);
		(FileSystem.createUploadTask as jest.Mock).mockReturnValue({ uploadAsync, cancelAsync: jest.fn() });

		const upload = new Upload();
		upload.setupRequest('https://example.com/api/v1/rooms.media/rid', { 'X-Auth-Token': 'token' });
		upload.appendFile({
			name: 'file',
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			filename: 'bom正查数据2026_04_20.xlsx',
			uri: 'file:///cache/bom正查数据2026_04_20.xlsx'
		});
		upload.appendFile({ name: 'description', data: 'hello' });

		await upload.send();

		expect(FileSystem.createUploadTask).toHaveBeenCalledWith(
			'https://example.com/api/v1/rooms.media/rid',
			'file:///cache/bom正查数据2026_04_20.xlsx',
			expect.objectContaining({
				httpMethod: 'POST',
				uploadType: 'multipart',
				fieldName: 'file',
				mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				parameters: { description: 'hello' }
			}),
			expect.any(Function)
		);
	});
});
