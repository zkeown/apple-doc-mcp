/**
 * Zod schemas for Apple Developer Documentation API responses.
 * These validate the core structure while being permissive of additional fields
 * that Apple may add. Use .passthrough() to allow unknown fields.
 */
import {z} from 'zod';

// Platform information
// Note: introducedAt may be undefined for some platforms (e.g., visionOS on older APIs)
export const PlatformInfoSchema = z
	.object({
		name: z.string(),
		introducedAt: z.string().optional(),
		beta: z.boolean().optional(),
		deprecated: z.boolean().optional(),
		unavailable: z.boolean().optional(),
	})
	.passthrough();

// Declaration tokens - Apple has many token kinds
export const DeclarationTokenSchema = z
	.object({
		kind: z.string(), // Many kinds: keyword, identifier, text, typeIdentifier, etc.
		text: z.string(),
		identifier: z.string().optional(),
		preciseIdentifier: z.string().optional(),
	})
	.passthrough();

export const DeclarationSchema = z
	.object({
		languages: z.array(z.string()),
		platforms: z.array(z.string()).optional(),
		tokens: z.array(DeclarationTokenSchema),
	})
	.passthrough();

// InlineContent is recursive and has many types
export const InlineContentSchema: z.ZodType = z.lazy(() =>
	z
		.object({
			type: z.string(), // Text, codeVoice, reference, emphasis, strong, image, newTerm, etc.
			text: z.string().optional(),
			code: z.string().optional(),
			identifier: z.string().optional(),
			inlineContent: z.array(InlineContentSchema).optional(),
		})
		.passthrough());

// ContentBlock is recursive and has many types
export const ContentBlockSchema: z.ZodType = z.lazy(() =>
	z
		.object({
			type: z.string(), // Paragraph, heading, codeListing, unorderedList, orderedList, aside, links, termList, table, row, etc.
			inlineContent: z.array(InlineContentSchema).optional(),
			text: z.string().optional(),
			level: z.number().optional(),
			anchor: z.string().optional(),
			syntax: z.string().optional(),
			code: z.array(z.string()).optional(),
			items: z.array(z.unknown()).optional(), // Can have various structures
			style: z.string().optional(),
			content: z.array(ContentBlockSchema).optional(),
		})
		.passthrough());

export const ParameterContentSchema = z
	.object({
		name: z.string(),
		content: z.array(ContentBlockSchema),
	})
	.passthrough();

// Primary content sections - use passthrough for flexibility
export const DeclarationsSectionSchema = z
	.object({
		kind: z.literal('declarations'),
		declarations: z.array(DeclarationSchema),
	})
	.passthrough();

export const ParametersSectionSchema = z
	.object({
		kind: z.literal('parameters'),
		parameters: z.array(ParameterContentSchema),
	})
	.passthrough();

export const ContentSectionSchema = z
	.object({
		kind: z.literal('content'),
		content: z.array(ContentBlockSchema),
	})
	.passthrough();

export const MentionsSectionSchema = z
	.object({
		kind: z.literal('mentions'),
		mentions: z.array(z.string()),
	})
	.passthrough();

// Generic section for unknown kinds
export const GenericSectionSchema = z
	.object({
		kind: z.string(),
	})
	.passthrough();

// PrimaryContentSection - accept any section with a kind field
export const PrimaryContentSectionSchema = z
	.object({
		kind: z.string(),
	})
	.passthrough();

// Fragment for metadata
export const FragmentSchema = z
	.object({
		kind: z.string(), // Keyword, identifier, text, typeIdentifier, etc.
		text: z.string(),
		preciseIdentifier: z.string().optional(),
	})
	.passthrough();

// Abstract item (common pattern)
export const AbstractItemSchema = z
	.object({
		text: z.string().optional(), // Some items may not have text
		type: z.string(),
	})
	.passthrough();

// Topic section
export const TopicSectionSchema = z
	.object({
		anchor: z.string().optional(),
		identifiers: z.array(z.string()),
		title: z.string(),
	})
	.passthrough();

// Reference data - very flexible as it includes images, symbols, links, etc.
export const ReferenceDataSchema = z
	.object({
		// Minimum: must have some identifying info
		// Images have: type, identifier, variants
		// Symbols have: title, url, kind, abstract
		type: z.string().optional(),
		identifier: z.string().optional(),
		title: z.string().optional(),
		kind: z.string().optional(),
		abstract: z.array(AbstractItemSchema).optional(),
		platforms: z.array(PlatformInfoSchema).optional(),
		url: z.string().optional(),
	})
	.passthrough();

// Technology (from technologies endpoint)
export const TechnologySchema = z
	.object({
		abstract: z.array(AbstractItemSchema).optional(), // Some techs may not have abstract
		identifier: z.string(),
		kind: z.string(),
		role: z.string(),
		title: z.string(),
		url: z.string(),
	})
	.passthrough();

// Framework data - core fields that we depend on
export const FrameworkDataSchema = z
	.object({
		abstract: z.array(AbstractItemSchema).optional(),
		metadata: z
			.object({
				platforms: z.array(PlatformInfoSchema).optional(),
				role: z.string().optional(),
				title: z.string(),
			})
			.passthrough(),
		references: z.record(z.string(), ReferenceDataSchema).optional(),
		topicSections: z.array(TopicSectionSchema).optional(),
	})
	.passthrough();

// Symbol data - core fields that we depend on
export const SymbolDataSchema = z
	.object({
		abstract: z.array(AbstractItemSchema).optional(),
		metadata: z
			.object({
				platforms: z.array(PlatformInfoSchema).optional(),
				symbolKind: z.string().optional(), // Articles don't have symbolKind
				title: z.string(),
				roleHeading: z.string().optional(),
				fragments: z.array(FragmentSchema).optional(),
			})
			.passthrough(),
		primaryContentSections: z.array(PrimaryContentSectionSchema).optional(),
		references: z.record(z.string(), ReferenceDataSchema).optional(),
		topicSections: z.array(TopicSectionSchema).optional(),
	})
	.passthrough();

// Technologies response (wrapper)
export const TechnologiesResponseSchema = z.object({
	references: z.record(z.string(), z.unknown()),
});
