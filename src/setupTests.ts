import '@testing-library/jest-dom/vitest';

class ResizeObserver {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(private readonly callback: ResizeObserverCallback) {}
	observe() {}
	unobserve() {}
	disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
	writable: true,
	configurable: true,
	value: ResizeObserver
});
