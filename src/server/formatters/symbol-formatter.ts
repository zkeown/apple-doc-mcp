import type {
	SymbolData,
	ReferenceData,
	PrimaryContentSection,
	DeclarationsSection,
	ParametersSection,
	ContentSection,
	PlatformInfo,
	InlineContent,
	ContentBlock,
} from '../../apple-client.js';
import type {ServerContext} from '../context.js';
import {
	bold,
	header,
	trimWithEllipsis,
	codeBlock,
	availabilityBadge,
} from '../markdown.js';

/**
 * Extract text from inline content items recursively.
 */
export const extractFromInline = (items: InlineContent[]): string => {
	const texts: string[] = [];
	for (const item of items) {
		if (item.text) {
			texts.push(item.text);
		}

		if (item.code) {
			texts.push(`\`${item.code}\``);
		}

		if (item.inlineContent) {
			texts.push(extractFromInline(item.inlineContent));
		}
	}

	return texts.join('');
};

/**
 * Extract text from content blocks recursively.
 */
export const extractInlineText = (blocks: ContentBlock[]): string => {
	const texts: string[] = [];
	for (const block of blocks) {
		if (block.inlineContent) {
			texts.push(extractFromInline(block.inlineContent));
		}

		if (block.text) {
			texts.push(block.text);
		}
	}

	return texts.join(' ').trim();
};

/**
 * Format a declarations section into markdown.
 */
export const formatDeclaration = (section: DeclarationsSection): string[] => {
	const content: string[] = [];
	const decl = section.declarations[0];
	if (!decl) {
		return content;
	}

	const declText = decl.tokens.map(t => t.text).join('');
	const language = decl.languages[0] ?? 'swift';
	content.push('', header(2, 'Declaration'), '', codeBlock(declText, language));
	return content;
};

/**
 * Format a parameters section into markdown.
 */
export const formatParameters = (section: ParametersSection): string[] => {
	const content: string[] = [];
	if (section.parameters.length === 0) {
		return content;
	}

	content.push('', header(2, 'Parameters'), '');
	for (const parameter of section.parameters) {
		const desc = extractInlineText(parameter.content);
		content.push(`• **${parameter.name}**: ${desc}`);
	}

	return content;
};

/**
 * Format a return value from a content section.
 */
export const formatReturnValue = (section: ContentSection): string[] => {
	const content: string[] = [];
	for (const block of section.content) {
		if (block.type === 'heading' && block.anchor === 'return-value') {
			content.push('', header(2, 'Return Value'), '');
			const idx = section.content.indexOf(block);
			const nextBlock = section.content[idx + 1];
			if (nextBlock?.inlineContent) {
				content.push(extractFromInline(nextBlock.inlineContent));
			}

			break;
		}
	}

	return content;
};

/**
 * Format deprecation warnings for platforms.
 */
export const formatDeprecationWarnings = (platforms: PlatformInfo[]): string[] => {
	const deprecated = platforms.filter(p => p.deprecated);
	if (deprecated.length === 0) {
		return [];
	}

	const content: string[] = [''];
	for (const p of deprecated) {
		content.push(`> ⚠️ **Deprecated** on ${p.name}`);
	}

	content.push('');
	return content;
};

/**
 * Format platform availability with detailed badges.
 */
export const formatDetailedPlatforms = (platforms: PlatformInfo[]): string => platforms
	.filter(p => !p.unavailable)
	.map(p => availabilityBadge(p.name, p.introducedAt, {
		deprecated: p.deprecated,
		beta: p.beta,
	}))
	.join(' | ');

/**
 * Format related symbols / See Also section.
 */
export const formatRelatedSymbols = (
	references: Record<string, ReferenceData>,
	currentTitle: string,
): string[] => {
	const content: string[] = [];
	const related = Object.values(references)
		.filter(ref => ref.title !== currentTitle && ref.kind === 'symbol')
		.slice(0, 8);

	if (related.length === 0) {
		return content;
	}

	content.push('', header(2, 'See Also'), '');
	for (const ref of related) {
		const kind = ref.kind ? ` (${ref.kind})` : '';
		content.push(`• **${ref.title}**${kind}`);
	}

	return content;
};

/**
 * Format identifier references with descriptions.
 */
export const formatIdentifiers = (
	identifiers: string[],
	references: Record<string, ReferenceData> | undefined,
	client: ServerContext['client'],
): string[] => {
	const content: string[] = [];

	for (const id of identifiers.slice(0, 5)) {
		const ref = references?.[id];
		if (ref) {
			const refDesc = client.extractText(ref.abstract ?? []);
			content.push(`• **${ref.title}** - ${trimWithEllipsis(refDesc, 100)}`);
		}
	}

	if (identifiers.length > 5) {
		content.push(`*... and ${identifiers.length - 5} more items*`);
	}

	return content;
};

/**
 * Format topic sections (API Reference).
 */
export const formatTopicSections = (data: SymbolData, client: ServerContext['client']): string[] => {
	const content: string[] = [];

	if (data.topicSections?.length) {
		content.push('', header(2, 'API Reference'), '');
		for (const section of data.topicSections) {
			content.push(`### ${section.title}`);
			if (section.identifiers?.length) {
				content.push(...formatIdentifiers(section.identifiers, data.references, client));
			}

			content.push('');
		}
	}

	return content;
};

/**
 * Process all primary content sections into markdown.
 */
export const formatPrimaryContent = (sections: PrimaryContentSection[]): string[] => {
	const content: string[] = [];

	for (const section of sections) {
		switch (section.kind) {
			case 'declarations': {
				content.push(...formatDeclaration(section));
				break;
			}

			case 'parameters': {
				content.push(...formatParameters(section));
				break;
			}

			case 'content': {
				content.push(...formatReturnValue(section));
				break;
			}

			case 'mentions': {
				// Skip mentions for now - could use for related links
				break;
			}
		}
	}

	return content;
};
