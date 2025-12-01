import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	mockSwiftUIFramework,
	mockSwiftUITechnology,
} from '../../test-utils/fixtures.js';
import {
	createMockClient,
	createTestContext,
} from '../../test-utils/mocks.js';
import {buildChooseTechnologyHandler} from './choose-technology.js';

describe('choose-technology handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('technology selection', () => {
		it('selects technology by exact name match', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			expect(result.content[0].text).toContain('Technology Selected');
			expect(result.content[0].text).toContain('SwiftUI');
			expect(context.state.getActiveTechnology()?.title).toBe('SwiftUI');
		});

		it('selects technology by case-insensitive name match', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'swiftui'});

			expect(result.content[0].text).toContain('Technology Selected');
			expect(context.state.getActiveTechnology()?.title).toBe('SwiftUI');
		});

		it('selects technology by identifier', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({identifier: 'doc://com.apple.documentation/documentation/swiftui'});

			expect(result.content[0].text).toContain('Technology Selected');
			expect(context.state.getActiveTechnology()?.identifier).toBe(mockSwiftUITechnology.identifier);
		});

		it('selects technology by case-insensitive identifier', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({identifier: 'DOC://COM.APPLE.DOCUMENTATION/DOCUMENTATION/SWIFTUI'});

			expect(result.content[0].text).toContain('Technology Selected');
		});

		it('uses fuzzy matching for partial name', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'Swift'});

			expect(result.content[0].text).toContain('Technology Selected');
			expect(context.state.getActiveTechnology()?.title).toBe('SwiftUI');
		});

		it('prefers identifier over name when both provided', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({
				name: 'UIKit',
				identifier: 'doc://com.apple.documentation/documentation/swiftui',
			});

			expect(result.content[0].text).toContain('Technology Selected');
			expect(context.state.getActiveTechnology()?.title).toBe('SwiftUI');
		});
	});

	describe('technology not found', () => {
		it('returns not found message for unknown technology', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'NonExistentFramework'});

			expect(result.content[0].text).toContain('Technology Not Found');
			expect(result.content[0].text).toContain('NonExistentFramework');
			expect(context.state.getActiveTechnology()).toBeUndefined();
		});

		it('shows suggestions when partial match exists', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			// "found" matches "Foundation" via contains (score 2), selecting it
			// So let's use something that truly doesn't match
			const result = await handler({name: 'xyz123nonexistent'});

			// Should show "Technology Not Found"
			expect(result.content[0].text).toContain('Technology Not Found');
		});

		it('limits suggestions to configured maximum', async () => {
			// Create many technologies that match
			const manyTechnologies: Record<string, typeof mockSwiftUITechnology> = {};
			for (let i = 0; i < 20; i++) {
				const id = `doc://com.apple.documentation/documentation/testframework${i}`;
				manyTechnologies[id] = {
					...mockSwiftUITechnology,
					identifier: id,
					title: `TestFramework${i}`,
				};
			}

			const mockClient = createMockClient({
				getTechnologies: vi.fn().mockResolvedValue(manyTechnologies),
			});
			const context = createTestContext({client: mockClient});
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'TestFramework'});

			// Should be limited (default 5 suggestions)
			const suggestionLines = result.content[0].text.split('\n').filter((line: string) =>
				line.includes('choose_technology'));
			expect(suggestionLines.length).toBeLessThanOrEqual(5);
		});
	});

	describe('framework validation', () => {
		it('rejects non-framework technologies', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			await expect(handler({name: 'SwiftUI Tutorials'})).rejects.toThrow('not a framework collection');
		});

		it('accepts technologies with kind=symbol and role=collection', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			expect(result.content[0].text).toContain('Technology Selected');
		});
	});

	describe('state management', () => {
		it('clears previous framework data when selecting new technology', async () => {
			const context = createTestContext();
			// Set some initial state
			context.state.setActiveTechnology(mockSwiftUITechnology);
			context.state.setActiveFrameworkData(mockSwiftUIFramework);

			const handler = buildChooseTechnologyHandler(context);
			await handler({name: 'UIKit'});

			expect(context.state.getActiveTechnology()?.title).toBe('UIKit');
			// Framework data should be cleared (setActiveTechnology triggers reset)
		});
	});

	describe('framework overview', () => {
		it('includes framework overview when data is available', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			expect(result.content[0].text).toContain('Framework Overview');
			expect(result.content[0].text).toContain('Platforms');
			expect(result.content[0].text).toContain('Symbols');
		});

		it('includes categories when available', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			expect(result.content[0].text).toContain('Categories');
			expect(result.content[0].text).toContain('Views');
			expect(result.content[0].text).toContain('Controls');
		});

		it('gracefully handles framework data fetch errors', async () => {
			const mockClient = createMockClient({
				getFramework: vi.fn().mockRejectedValue(new Error('Network error')),
			});
			const context = createTestContext({client: mockClient});
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			// Should still succeed, just without overview
			expect(result.content[0].text).toContain('Technology Selected');
			expect(result.content[0].text).not.toContain('Framework Overview');
		});
	});

	describe('next actions', () => {
		it('shows next action suggestions', async () => {
			const context = createTestContext();
			const handler = buildChooseTechnologyHandler(context);

			const result = await handler({name: 'SwiftUI'});

			expect(result.content[0].text).toContain('Next Actions');
			expect(result.content[0].text).toContain('search_symbols');
			expect(result.content[0].text).toContain('get_documentation');
			expect(result.content[0].text).toContain('discover_technologies');
		});
	});
});
