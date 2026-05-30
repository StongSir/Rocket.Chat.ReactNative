import { store as reduxStore } from '../store/auxStore';
import { headers as defaultHeaders } from '../methods/helpers/fetch';
import { type ICustomEmoji } from '../../definitions';

export interface IUserCustomEmoji extends ICustomEmoji {
	id: string;
	rocketEmojiName: string;
	source?: 'upload' | 'collected' | 'admin_seeded';
	displayMode?: 'inline' | 'sticker';
	thumbUrl?: string;
	displayName?: string;
	createdAt?: string;
}

export interface ICustomEmojiMetadata {
	rocketEmojiName: string;
	extension?: string;
	displayMode: 'inline' | 'sticker';
	thumbUrl?: string;
}

interface IListResponse {
	items: IUserCustomEmoji[];
	nextCursor: string | null;
}

const errorMessageByCode: Record<string, string> = {
	file_too_large: '文件过大，请选择更小的图片',
	unsupported_file_type: '暂不支持该图片格式',
	unauthorized: '登录状态已失效，请重新登录后再试',
	rocket_chat_auth_failed: '登录状态已失效，请重新登录后再试',
	already_collected: '已在我的表情中',
	emoji_not_found: '该表情不存在或已被删除',
	rocket_chat_unavailable: '表情服务暂不可用，请稍后重试',
	delete_failed: '删除失败，请稍后重试',
	collect_failed: '添加失败，请稍后重试',
	upload_failed: '表情上传失败，请重试'
};

export class CustomEmojiServiceError extends Error {
	code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.name = 'CustomEmojiServiceError';
		this.code = code;
	}
}

const parseErrorBody = (errorText: string): { code?: string; message?: string } => {
	try {
		const parsed = JSON.parse(errorText);
		return { code: parsed?.error, message: parsed?.message };
	} catch {
		return {};
	}
};

export const getCustomEmojiServiceErrorMessage = (error: unknown): string => {
	let code: string | undefined;
	if (error instanceof CustomEmojiServiceError) {
		code = error.code;
	} else if (error instanceof Error) {
		code = parseErrorBody(error.message).code;
	}
	if (code && errorMessageByCode[code]) {
		return errorMessageByCode[code];
	}
	return '表情服务异常，请稍后重试';
};

const emojiApiBaseUrl = () => {
	const {
		server: { server }
	} = reduxStore.getState();
	return `${server}/emoji-api/v1`;
};

const authHeaders = () => {
	const {
		login: { user }
	} = reduxStore.getState();
	return {
		...defaultHeaders,
		'X-User-Id': user.id || '',
		'X-Auth-Token': user.token || ''
	};
};

const request = async <T>(path: string, options: any = {}): Promise<T> => {
	const response = await fetch(`${emojiApiBaseUrl()}${path}`, {
		...options,
		headers: {
			...authHeaders(),
			...(options.headers as Record<string, string> | undefined)
		}
	});
	if (!response.ok) {
		const errorText = await response.text();
		const parsedError = parseErrorBody(errorText);
		throw new CustomEmojiServiceError(
			parsedError.message || errorText || `Custom emoji service error: ${response.status}`,
			parsedError.code
		);
	}
	return response.json();
};

const toCustomEmoji = (item: IUserCustomEmoji): ICustomEmoji => ({
	id: item.id,
	name: item.rocketEmojiName || item.name,
	extension: item.extension || 'png',
	displayMode: item.displayMode,
	source: item.source,
	thumbUrl: item.thumbUrl,
	displayName: item.displayName,
	createdAt: item.createdAt
});

export const listMyCustomEmojis = async (keyword = ''): Promise<ICustomEmoji[]> => {
	const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
	const response = await request<IListResponse>(`/me/emojis${query}`);
	return (response.items || []).map(toCustomEmoji);
};

export const uploadMyCustomEmoji = async ({
	uri,
	name,
	type,
	displayName
}: {
	uri: string;
	name: string;
	type: string;
	displayName?: string;
}): Promise<ICustomEmoji> => {
	const formData = new FormData();
	formData.append('file', {
		uri,
		name,
		type
	} as any);
	if (displayName) {
		formData.append('displayName', displayName);
	}
	const response = await request<IUserCustomEmoji>('/me/emojis/upload', {
		method: 'POST',
		body: formData
	});
	return toCustomEmoji(response);
};

export const collectMyCustomEmoji = async (rocketEmojiName: string, displayName?: string): Promise<ICustomEmoji> => {
	const response = await request<IUserCustomEmoji>('/me/emojis/collect', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ rocketEmojiName, displayName })
	});
	return toCustomEmoji(response);
};

export const deleteMyCustomEmoji = async (id: string): Promise<void> => {
	await request<{ success: boolean }>(`/me/emojis/${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
};

export const getCustomEmojiMetadata = async (rocketEmojiNames: string[]): Promise<ICustomEmojiMetadata[]> => {
	const response = await request<{ items: ICustomEmojiMetadata[] }>('/emojis/metadata', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ rocketEmojiNames })
	});
	return response.items || [];
};
