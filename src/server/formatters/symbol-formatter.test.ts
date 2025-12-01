import {
	describe,
	expect,
	it,
} from 'vitest';
import type {
	ContentBlock,
	ContentSection,
	DeclarationsSection,
	InlineContent,
	ParametersSection,
	PlatformInfo,
	PrimaryContentSection,
	ReferenceData,
	SymbolData,
} from '../../apple-client.js';
import {createMockClient} from '../../test-utils/mocks.js';
import {
	extractFromInline,
	extractInlineText,
	formatDeclaration,
	formatDeprecationWarnings,
	formatDetailedPlatforms,
	formatIdentifiers,
	formatParameters,
	formatPrimaryContent,
	formatRelatedSymbols,
	formatReturnValue,
	formatTopicSections,
} from './symbol-formatter.js';

describe('symbol-formatter', () => {
	describe('extractFromInline', () => {
		it('extracts text from simple text item', () => {
			const items: InlineContent[] = [{type: 'text', text: 'Hello'}];
			expect(extractFromInline(items)).toBe('Hello');
		});

		it('extracts code from code item', () => {
			const items: InlineContent[] = [{type: 'codeVoice', code: 'View'}];
			expect(extractFromInline(items)).toBe('`View`');
		});

		it('extracts nested inline content', () => {
			const items: InlineContent[] = [{
				type: 'reference',
				inlineContent: [{type: 'text', text: 'Nested'}],
			}];
			expect(extractFromInline(items)).toBe('Nested');
		});

		it('combines multiple items', () => {
			const items: InlineContent[] = [
				{type: 'text', text: 'Use '},
				{type: 'codeVoice', code: 'View'},
				{type: 'text', text: ' here'},
			];
			expect(extractFromInline(items)).toBe('Use `View` here');
		});

		it('handles empty array', () => {
			expect(extractFromInline([])).toBe('');
		});
	});

	describe('extractInlineText', () => {
		it('extracts text from content blocks with inlineContent', () => {
			const blocks: ContentBlock[] = [{
				type: 'paragraph',
				inlineContent: [{type: 'text', text: 'Block text'}],
			}];
			expect(extractInlineText(blocks)).toBe('Block text');
		});

		it('extracts text from blocks with text property', () => {
			const blocks: ContentBlock[] = [{
				type: 'codeListing',
				text: 'Code text',
			}];
			expect(extractInlineText(blocks)).toBe('Code text');
		});

		it('handles empty blocks', () => {
			expect(extractInlineText([])).toBe('');
		});
	});

	describe('formatDeclaration', () => {
		it('formats declaration with tokens', () => {
			const section: DeclarationsSection = {
				kind: 'declarations',
				declarations: [{
					languages: ['swift'],
					tokens: [
						{kind: 'keyword', text: 'protocol'},
						{kind: 'text', text: ' '},
						{kind: 'identifier', text: 'View'},
					],
				}],
			};
			const result = formatDeclaration(section);
			expect(result).toContain('## Declaration');
			expect(result.join('\n')).toContain('protocol View');
		});

		it('returns empty when no declarations', () => {
			const section: DeclarationsSection = {
				kind: 'declarations',
				declarations: [],
			};
			expect(formatDeclaration(section)).toEqual([]);
		});

		it('uses default language when none specified', () => {
			const section: DeclarationsSection = {
				kind: 'declarations',
				declarations: [{
					languages: [],
					tokens: [{kind: 'text', text: 'code'}],
				}],
			};
			const result = formatDeclaration(section);
			expect(result.join('\n')).toContain('```swift');
		});
	});

	describe('formatParameters', () => {
		it('formats parameters list', () => {
			const section: ParametersSection = {
				kind: 'parameters',
				parameters: [{
					name: 'action',
					content: [{
						type: 'paragraph',
						inlineContent: [{type: 'text', text: 'The action to perform'}],
					}],
				}],
			};
			const result = formatParameters(section);
			expect(result).toContain('## Parameters');
			expect(result.join('\n')).toContain('**action**');
		});

		it('returns empty when no parameters', () => {
			const section: ParametersSection = {
				kind: 'parameters',
				parameters: [],
			};
			expect(formatParameters(section)).toEqual([]);
		});
	});

	describe('formatReturnValue', () => {
		it('formats return value section', () => {
			const section: ContentSection = {
				kind: 'content',
				content: [
					{
						type: 'heading',
						anchor: 'return-value',
						level: 2,
						text: 'Return Value',
					},
					{
						type: 'paragraph',
						inlineContent: [{type: 'text', text: 'The formatted string'}],
					},
				],
			};
			const result = formatReturnValue(section);
			expect(result).toContain('## Return Value');
			expect(result.join('\n')).toContain('The formatted string');
		});

		it('returns empty when no return value heading', () => {
			const section: ContentSection = {
				kind: 'content',
				content: [{
					type: 'paragraph',
					inlineContent: [{type: 'text', text: 'Just text'}],
				}],
			};
			expect(formatReturnValue(section)).toEqual([]);
		});

		it('handles return value without next block', () => {
			const section: ContentSection = {
				kind: 'content',
				content: [{
					type: 'heading',
					anchor: 'return-value',
					level: 2,
					text: 'Return Value',
				}],
			};
			const result = formatReturnValue(section);
			expect(result).toContain('## Return Value');
		});
	});

	describe('formatDeprecationWarnings', () => {
		it('formats deprecated platforms', () => {
			const platforms: PlatformInfo[] = [
				{name: 'iOS', introducedAt: '13.0', deprecated: true},
			];
			const result = formatDeprecationWarnings(platforms);
			expect(result.join('\n')).toContain('Deprecated');
			expect(result.join('\n')).toContain('iOS');
		});

		it('returns empty when no deprecated platforms', () => {
			const platforms: PlatformInfo[] = [
				{name: 'iOS', introducedAt: '13.0'},
			];
			expect(formatDeprecationWarnings(platforms)).toEqual([]);
		});
	});

	describe('formatDetailedPlatforms', () => {
		it('formats basic platforms', () => {
			const platforms: PlatformInfo[] = [
				{name: 'iOS', introducedAt: '15.0'},
				{name: 'macOS', introducedAt: '12.0'},
			];
			expect(formatDetailedPlatforms(platforms)).toBe('iOS 15.0+ | macOS 12.0+');
		});

		it('filters out unavailable platforms', () => {
			const platforms: PlatformInfo[] = [
				{name: 'iOS', introducedAt: '15.0'},
				{name: 'watchOS', introducedAt: '1.0', unavailable: true},
			];
			expect(formatDetailedPlatforms(platforms)).toBe('iOS 15.0+');
		});

		it('includes deprecated badge', () => {
			const platforms: PlatformInfo[] = [
				{name: 'iOS', introducedAt: '15.0', deprecated: true},
			];
			expect(formatDetailedPlatforms(platforms)).toContain('⚠️');
		});

		it('includes beta badge', () => {
			const platforms: PlatformInfo[] = [
				{name: 'visionOS', introducedAt: '1.0', beta: true},
			];
			expect(formatDetailedPlatforms(platforms)).toContain('β');
		});
	});

	describe('formatRelatedSymbols', () => {
		it('formats related symbols', () => {
			const references: Record<string, ReferenceData> = {
				ref1: {title: 'Button', kind: 'symbol', url: '/button'},
				ref2: {title: 'Text', kind: 'symbol', url: '/text'},
			};
			const result = formatRelatedSymbols(references, 'View');
			expect(result).toContain('## See Also');
			expect(result.join('\n')).toContain('Button');
		});

		it('excludes current symbol from related', () => {
			const references: Record<string, ReferenceData> = {
				ref1: {title: 'View', kind: 'symbol', url: '/view'},
				ref2: {title: 'Button', kind: 'symbol', url: '/button'},
			};
			const result = formatRelatedSymbols(references, 'View');
			expect(result.join('\n')).not.toContain('• **View**');
			expect(result.join('\n')).toContain('• **Button**');
		});

		it('returns empty when no related symbols', () => {
			const references: Record<string, ReferenceData> = {
				ref1: {title: 'View', kind: 'symbol', url: '/view'},
			};
			expect(formatRelatedSymbols(references, 'View')).toEqual([]);
		});

		it('limits to 8 related symbols', () => {
			const references: Record<string, ReferenceData> = {};
			for (let i = 0; i < 15; i++) {
				references[`ref${i}`] = {title: `Symbol${i}`, kind: 'symbol', url: `/symbol${i}`};
			}

			const result = formatRelatedSymbols(references, 'Other');
			const symbolCount = result.filter(line => line.startsWith('•')).length;
			expect(symbolCount).toBeLessThanOrEqual(8);
		});
	});

	describe('formatIdentifiers', () => {
		it('formats identifiers with references', () => {
			const mockClient = createMockClient();
			const references: Record<string, ReferenceData> = {
				id1: {title: 'Button', url: '/button', abstract: [{type: 'text', text: 'A button control'}]},
			};
			const result = formatIdentifiers(['id1'], references, mockClient);
			expect(result.join('\n')).toContain('**Button**');
		});

		it('handles missing references', () => {
			const mockClient = createMockClient();
			const result = formatIdentifiers(['unknown'], undefined, mockClient);
			expect(result).toEqual([]);
		});

		it('limits to 5 identifiers', () => {
			const mockClient = createMockClient();
			const references: Record<string, ReferenceData> = {};
			const ids: string[] = [];
			for (let i = 0; i < 10; i++) {
				ids.push(`id${i}`);
				references[`id${i}`] = {title: `Symbol${i}`, url: `/sym${i}`, abstract: [{type: 'text', text: 'Desc'}]};
			}

			const result = formatIdentifiers(ids, references, mockClient);
			expect(result.join('\n')).toContain('and 5 more items');
		});
	});

	describe('formatTopicSections', () => {
		it('formats topic sections', () => {
			const mockClient = createMockClient();
			const data: Partial<SymbolData> = {
				topicSections: [{
					title: 'Views',
					identifiers: ['id1'],
				}],
				references: {
					id1: {title: 'View', url: '/view', abstract: [{type: 'text', text: 'A view'}]},
				},
			};
			const result = formatTopicSections(data as SymbolData, mockClient);
			expect(result).toContain('## API Reference');
			expect(result.join('\n')).toContain('### Views');
		});

		it('returns empty when no topic sections', () => {
			const mockClient = createMockClient();
			const data: Partial<SymbolData> = {topicSections: []};
			expect(formatTopicSections(data as SymbolData, mockClient)).toEqual([]);
		});
	});

	describe('formatPrimaryContent', () => {
		it('formats declarations section', () => {
			const sections: PrimaryContentSection[] = [{
				kind: 'declarations',
				declarations: [{
					languages: ['swift'],
					tokens: [{kind: 'text', text: 'struct View'}],
				}],
			}];
			const result = formatPrimaryContent(sections);
			expect(result.join('\n')).toContain('Declaration');
		});

		it('formats parameters section', () => {
			const sections: PrimaryContentSection[] = [{
				kind: 'parameters',
				parameters: [{
					name: 'param',
					content: [{
						type: 'paragraph',
						inlineContent: [{type: 'text', text: 'desc'}],
					}],
				}],
			}];
			const result = formatPrimaryContent(sections);
			expect(result.join('\n')).toContain('Parameters');
		});

		it('formats content section with return value', () => {
			const sections: PrimaryContentSection[] = [{
				kind: 'content',
				content: [
					{
						type: 'heading',
						anchor: 'return-value',
						level: 2,
						text: 'Return Value',
					},
					{
						type: 'paragraph',
						inlineContent: [{type: 'text', text: 'Returns something'}],
					},
				],
			}];
			const result = formatPrimaryContent(sections);
			expect(result.join('\n')).toContain('Return Value');
		});

		it('skips mentions section', () => {
			const sections: PrimaryContentSection[] = [{
				kind: 'mentions',
				mentions: ['some mention'],
			}];
			const result = formatPrimaryContent(sections);
			expect(result).toEqual([]);
		});
	});
});
