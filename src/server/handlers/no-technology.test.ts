import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	mockSwiftUITechnology,
} from '../../test-utils/fixtures.js';
import {
	createMockClient,
	createTestContext,
} from '../../test-utils/mocks.js';
import {buildNoTechnologyMessage} from './no-technology.js';

describe('no-technology message handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('basic message', () => {
		it('returns message prompting user to select technology', async () => {
			const context = createTestContext();
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('No Technology Selected');
			expect(result.content[0].text).toContain('Required Steps');
		});

		it('shows available technologies', async () => {
			const context = createTestContext();
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('Available Technologies');
			expect(result.content[0].text).toContain('SwiftUI');
		});

		it('shows quick start examples', async () => {
			const context = createTestContext();
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('Quick Start');
			expect(result.content[0].text).toContain('SwiftUI development');
			expect(result.content[0].text).toContain('UIKit development');
		});
	});

	describe('technologies loading failure', () => {
		it('shows fallback message when getting technologies fails', async () => {
			const mockClient = createMockClient({
				getTechnologies: vi.fn().mockRejectedValue(new Error('Network error')),
			});
			const context = createTestContext({client: mockClient});
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			// Should still return a valid response
			expect(result.content[0].text).toContain('No Technology Selected');
			// Should show fallback text
			expect(result.content[0].text).toContain('discover_technologies');
		});
	});

	describe('many technologies', () => {
		it('shows "and many more" when exactly 8 technologies are shown', async () => {
			// Create exactly 8+ technologies that will be shown
			const manyTechnologies: Record<string, typeof mockSwiftUITechnology> = {};
			for (let i = 0; i < 15; i++) {
				const id = `doc://com.apple.documentation/documentation/framework${i}`;
				manyTechnologies[id] = {
					...mockSwiftUITechnology,
					identifier: id,
					title: `Framework${i}`,
				};
			}

			const mockClient = createMockClient({
				getTechnologies: vi.fn().mockResolvedValue(manyTechnologies),
			});
			const context = createTestContext({client: mockClient});
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('and many more');
		});

		it('does not show "and many more" when fewer than 8 technologies', async () => {
			const context = createTestContext();
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			// MockTechnologies has 4 technologies (3 frameworks + 1 article which is filtered)
			expect(result.content[0].text).not.toContain('and many more');
		});
	});

	describe('empty technologies', () => {
		it('shows fallback message when no technologies available', async () => {
			const mockClient = createMockClient({
				getTechnologies: vi.fn().mockResolvedValue({}),
			});
			const context = createTestContext({client: mockClient});
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('Use `discover_technologies` to see all available');
		});
	});

	describe('last discovery', () => {
		it('shows recently discovered technologies when available', async () => {
			const context = createTestContext();
			// Set up last discovery
			context.state.setLastDiscovery({
				query: 'swift',
				results: [
					mockSwiftUITechnology,
					{...mockSwiftUITechnology, title: 'Swift', identifier: 'doc://swift'},
				],
			});
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).toContain('Recently Discovered');
			expect(result.content[0].text).toContain('SwiftUI');
		});

		it('does not show recently discovered when no previous discovery', async () => {
			const context = createTestContext();
			const noTechnology = buildNoTechnologyMessage(context);

			const result = await noTechnology();

			expect(result.content[0].text).not.toContain('Recently Discovered');
		});
	});
});
