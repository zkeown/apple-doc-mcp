import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { bold, header, trimWithEllipsis, codeBlock, availabilityBadge, } from '../markdown.js';
import { loadActiveFrameworkData } from '../services/framework-loader.js';
import { buildNoTechnologyMessage } from './no-technology.js';
// Extract declaration string from tokens
const formatDeclaration = (section) => {
    const content = [];
    const decl = section.declarations[0];
    if (!decl) {
        return content;
    }
    const declText = decl.tokens.map(t => t.text).join('');
    const language = decl.languages[0] ?? 'swift';
    content.push('', header(2, 'Declaration'), '', codeBlock(declText, language));
    return content;
};
// Format parameters section
const formatParameters = (section) => {
    const content = [];
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
// Extract text from inline content recursively
const extractInlineText = (blocks) => {
    const texts = [];
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
const extractFromInline = (items) => {
    const texts = [];
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
// Format return value from content section
const formatReturnValue = (section) => {
    const content = [];
    // Look for return value heading
    for (const block of section.content) {
        if (block.type === 'heading' && block.anchor === 'return-value') {
            content.push('', header(2, 'Return Value'), '');
            // Get next paragraph
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
// Format deprecation warnings
const formatDeprecationWarnings = (platforms) => {
    const deprecated = platforms.filter(p => p.deprecated);
    if (deprecated.length === 0) {
        return [];
    }
    const content = [''];
    for (const p of deprecated) {
        content.push(`> ⚠️ **Deprecated** on ${p.name}`);
    }
    content.push('');
    return content;
};
// Format platform availability with more detail
const formatDetailedPlatforms = (platforms) => platforms
    .filter(p => !p.unavailable)
    .map(p => availabilityBadge(p.name, p.introducedAt, {
    deprecated: p.deprecated,
    beta: p.beta,
}))
    .join(' | ');
// Format related symbols / See Also
const formatRelatedSymbols = (references, currentTitle) => {
    const content = [];
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
const formatIdentifiers = (identifiers, references, client) => {
    const content = [];
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
const formatTopicSections = (data, client) => {
    const content = [];
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
// Process all primary content sections
const formatPrimaryContent = (sections) => {
    const content = [];
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
// Try to fetch a symbol, returning undefined on failure
const tryGetSymbol = async (client, path) => {
    try {
        return await client.getSymbol(path);
    }
    catch {
        return undefined;
    }
};
// Resolve symbol path, trying multiple framework prefixes for known patterns
const resolveSymbol = async (client, path, frameworkName) => {
    // If path already has full documentation prefix, try it directly
    if (path.startsWith('documentation/')) {
        return client.getSymbol(path);
    }
    // Try path as-is first
    const directResult = await tryGetSymbol(client, path);
    if (directResult) {
        return directResult;
    }
    // Build list of framework prefixes to try
    const frameworksToTry = [];
    // If symbol starts with MPS, prioritize Metal Performance Shaders frameworks
    if (path.startsWith('MPS')) {
        frameworksToTry.push('MetalPerformanceShaders', 'MetalPerformanceShadersGraph');
    }
    // Always include the currently selected framework
    frameworksToTry.push(frameworkName);
    // Try each framework prefix in parallel
    const results = await Promise.all(frameworksToTry.map(async (fw) => tryGetSymbol(client, `documentation/${fw}/${path}`)));
    const found = results.find(r => r !== undefined);
    if (found) {
        return found;
    }
    throw new McpError(ErrorCode.InvalidRequest, `Failed to load documentation for "${path}" in frameworks: ${frameworksToTry.join(', ')}`);
};
export const buildGetDocumentationHandler = (context) => {
    const { client, state } = context;
    const noTechnology = buildNoTechnologyMessage(context);
    return async ({ path }) => {
        const activeTechnology = state.getActiveTechnology();
        if (!activeTechnology) {
            return noTechnology();
        }
        const framework = await loadActiveFrameworkData(context);
        const identifierParts = activeTechnology.identifier.split('/');
        const frameworkName = identifierParts.at(-1);
        if (!frameworkName) {
            throw new McpError(ErrorCode.InvalidRequest, `Invalid technology identifier: ${activeTechnology.identifier}`);
        }
        // Try path as-is first, fallback to framework-prefixed path
        const data = await resolveSymbol(client, path, frameworkName);
        const title = data.metadata?.title || 'Symbol';
        const kind = data.metadata?.symbolKind || 'Unknown';
        const roleHeading = data.metadata?.roleHeading;
        const symbolPlatforms = data.metadata?.platforms ?? framework.metadata.platforms;
        const platforms = formatDetailedPlatforms(symbolPlatforms);
        const description = client.extractText(data.abstract);
        const content = [
            header(1, title),
            '',
            bold('Technology', activeTechnology.title),
            bold('Type', roleHeading ?? kind),
            bold('Platforms', platforms),
            // Deprecation warnings
            ...formatDeprecationWarnings(symbolPlatforms),
            // Declaration section
            ...(data.primaryContentSections?.length > 0
                ? formatPrimaryContent(data.primaryContentSections)
                : []),
            // Overview
            '',
            header(2, 'Overview'),
            description,
            // API Reference (topic sections)
            ...formatTopicSections(data, client),
            // Related symbols / See Also
            ...(data.references ? formatRelatedSymbols(data.references, title) : []),
        ];
        return {
            content: [{ text: content.join('\n'), type: 'text' }],
        };
    };
};
//# sourceMappingURL=get-documentation.js.map