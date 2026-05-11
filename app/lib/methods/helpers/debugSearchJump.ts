export const debugSearchJump = (step: string, payload?: unknown) => {
	if (__DEV__) {
		console.log('[SearchJump]', step, payload ?? '');
	}
};
