import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import type {AppleDevDocsClient, SymbolData} from '../../apple-client.js';
import {resolveSymbol, extractFrameworkName} from './symbol-resolver.js';

const mockSymbolData: SymbolData = {
	abstract: [{text: 'Test symbol', type: 'text'}],
	metadata: {
		title: 'TestSymbol',
		symbolKind: 'struct',
		platforms: [{name: 'iOS', introducedAt: '13.0'}],
	},
	primaryContentSections: [],
	references: {},
	topicSections: [],
};

const createMockClient = (responses: Record<string, SymbolData | Error> = {}): Pick<AppleDevDocsClient, 'getSymbol'> => ({
	getSymbol: vi.fn().mockImplementation(async (path: string) => {
		const response = responses[path];
		if (response instanceof Error) {
			throw response;
		}

		if (response) {
			return response;
		}

		throw new Error(`Not found: ${path}`);
	}),
});

describe('symbol-resolver', () => {
	describe('resolveSymbol', () => {
		it('returns direct result for paths starting with documentation/', async () => {
			const client = createMockClient({
				'documentation/SwiftUI/View': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'documentation/SwiftUI/View', 'SwiftUI');
			expect(result).toBe(mockSymbolData);
			expect(client.getSymbol).toHaveBeenCalledWith('documentation/SwiftUI/View');
		});

		it('tries path as-is first', async () => {
			const client = createMockClient({
				View: mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'View', 'SwiftUI');
			expect(result).toBe(mockSymbolData);
		});

		it('tries framework prefix when direct path fails', async () => {
			const client = createMockClient({
				'documentation/SwiftUI/View': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'View', 'SwiftUI');
			expect(result).toBe(mockSymbolData);
		});

		it('uses prefix mappings for UI-prefixed symbols', async () => {
			const client = createMockClient({
				'documentation/UIKit/UIView': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'UIView', 'SomeFramework');
			expect(result).toBe(mockSymbolData);
		});

		it('uses prefix mappings for NS-prefixed symbols', async () => {
			const client = createMockClient({
				'documentation/Foundation/NSObject': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'NSObject', 'SomeFramework');
			expect(result).toBe(mockSymbolData);
		});

		it('uses prefix mappings for CG-prefixed symbols', async () => {
			const client = createMockClient({
				'documentation/CoreGraphics/CGPoint': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'CGPoint', 'SomeFramework');
			expect(result).toBe(mockSymbolData);
		});

		it('uses prefix mappings for AV-prefixed symbols', async () => {
			const client = createMockClient({
				'documentation/AVFoundation/AVPlayer': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'AVPlayer', 'SomeFramework');
			expect(result).toBe(mockSymbolData);
		});

		it('uses prefix mappings for MTL-prefixed symbols', async () => {
			const client = createMockClient({
				'documentation/Metal/MTLDevice': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'MTLDevice', 'SomeFramework');
			expect(result).toBe(mockSymbolData);
		});

		it('tries additional frameworks from options', async () => {
			const client = createMockClient({
				'documentation/CustomFramework/MySymbol': mockSymbolData,
			});

			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'MySymbol', 'SwiftUI', {
				additionalFrameworks: ['CustomFramework'],
			});
			expect(result).toBe(mockSymbolData);
		});

		it('throws McpError when symbol not found in any framework', async () => {
			const client = createMockClient({});

			await expect(resolveSymbol(client as unknown as AppleDevDocsClient, 'NonExistent', 'SwiftUI'))
				.rejects.toThrow('Failed to load documentation');
		});

		it('throws McpError with list of tried frameworks', async () => {
			const client = createMockClient({});

			await expect(resolveSymbol(client as unknown as AppleDevDocsClient, 'UIView', 'SwiftUI'))
				.rejects.toThrow(/UIKit.*SwiftUI/);
		});

		it('tries multiple framework prefixes in parallel', async () => {
			const client = createMockClient({
				'documentation/AppKit/NSView': mockSymbolData,
			});

			// NS prefix maps to both Foundation and AppKit
			const result = await resolveSymbol(client as unknown as AppleDevDocsClient, 'NSView', 'SwiftUI');
			expect(result).toBe(mockSymbolData);
		});
	});

	describe('extractFrameworkName', () => {
		it('extracts framework name from full identifier', () => {
			expect(extractFrameworkName('doc://com.apple.documentation/documentation/swiftui'))
				.toBe('swiftui');
		});

		it('extracts last path component', () => {
			expect(extractFrameworkName('foo/bar/baz')).toBe('baz');
		});

		it('returns single component for simple string', () => {
			expect(extractFrameworkName('swiftui')).toBe('swiftui');
		});

		it('handles empty string', () => {
			expect(extractFrameworkName('')).toBe('');
		});

		it('handles trailing slash', () => {
			expect(extractFrameworkName('foo/bar/')).toBe('');
		});
	});
});
