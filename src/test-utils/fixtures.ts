import type {
	Technology,
	FrameworkData,
	SymbolData,
	ReferenceData,
	PlatformInfo,
} from '../apple-client/types/index.js';

// Platform fixtures
export const iosPlatform: PlatformInfo = {
	name: 'iOS',
	introducedAt: '13.0',
};

export const macOSPlatform: PlatformInfo = {
	name: 'macOS',
	introducedAt: '10.15',
};

export const deprecatedPlatform: PlatformInfo = {
	name: 'iOS',
	introducedAt: '13.0',
	deprecated: true,
};

export const betaPlatform: PlatformInfo = {
	name: 'visionOS',
	introducedAt: '1.0',
	beta: true,
};

// Technology fixtures
export const mockSwiftUITechnology: Technology = {
	identifier: 'doc://com.apple.documentation/documentation/swiftui',
	title: 'SwiftUI',
	url: '/documentation/swiftui',
	kind: 'symbol',
	role: 'collection',
	abstract: [{text: 'Declare the user interface and behavior for your app.', type: 'text'}],
};

export const mockUIKitTechnology: Technology = {
	identifier: 'doc://com.apple.documentation/documentation/uikit',
	title: 'UIKit',
	url: '/documentation/uikit',
	kind: 'symbol',
	role: 'collection',
	abstract: [{text: 'Construct and manage a graphical, event-driven user interface.', type: 'text'}],
};

export const mockFoundationTechnology: Technology = {
	identifier: 'doc://com.apple.documentation/documentation/foundation',
	title: 'Foundation',
	url: '/documentation/foundation',
	kind: 'symbol',
	role: 'collection',
	abstract: [{text: 'Access essential data types, collections, and operating-system services.', type: 'text'}],
};

// Non-framework technology (should be filtered out in discover)
export const mockArticleTechnology: Technology = {
	identifier: 'doc://com.apple.documentation/tutorials/swiftui',
	title: 'SwiftUI Tutorials',
	url: '/tutorials/swiftui',
	kind: 'project',
	role: 'overview',
	abstract: [{text: 'Learn SwiftUI by building apps.', type: 'text'}],
};

// All technologies as a record (matching API response shape)
export const mockTechnologies: Record<string, Technology> = {
	[mockSwiftUITechnology.identifier]: mockSwiftUITechnology,
	[mockUIKitTechnology.identifier]: mockUIKitTechnology,
	[mockFoundationTechnology.identifier]: mockFoundationTechnology,
	[mockArticleTechnology.identifier]: mockArticleTechnology,
};

// Reference fixtures
export const mockViewReference: ReferenceData = {
	title: 'View',
	kind: 'protocol',
	url: '/documentation/swiftui/view',
	abstract: [{text: 'A type that represents part of your app\'s user interface.', type: 'text'}],
	platforms: [iosPlatform, macOSPlatform],
};

export const mockButtonReference: ReferenceData = {
	title: 'Button',
	kind: 'struct',
	url: '/documentation/swiftui/button',
	abstract: [{text: 'A control that initiates an action.', type: 'text'}],
	platforms: [iosPlatform, macOSPlatform],
};

export const mockTextReference: ReferenceData = {
	title: 'Text',
	kind: 'struct',
	url: '/documentation/swiftui/text',
	abstract: [{text: 'A view that displays one or more lines of read-only text.', type: 'text'}],
	platforms: [iosPlatform, macOSPlatform],
};

export const mockGridItemReference: ReferenceData = {
	title: 'GridItem',
	kind: 'struct',
	url: '/documentation/swiftui/griditem',
	abstract: [{text: 'A description of a row or a column in a lazy grid.', type: 'text'}],
	platforms: [iosPlatform, macOSPlatform],
};

export const mockListReference: ReferenceData = {
	title: 'List',
	kind: 'struct',
	url: '/documentation/swiftui/list',
	abstract: [{text: 'A container that presents rows of data arranged in a single column.', type: 'text'}],
	platforms: [iosPlatform],
};

// Framework data fixtures
export const mockSwiftUIFramework: FrameworkData = {
	abstract: [{text: 'Declare the user interface and behavior for your app.', type: 'text'}],
	metadata: {
		title: 'SwiftUI',
		role: 'collection',
		platforms: [iosPlatform, macOSPlatform],
	},
	references: {
		'doc://com.apple.documentation/documentation/swiftui/view': mockViewReference,
		'doc://com.apple.documentation/documentation/swiftui/button': mockButtonReference,
		'doc://com.apple.documentation/documentation/swiftui/text': mockTextReference,
		'doc://com.apple.documentation/documentation/swiftui/griditem': mockGridItemReference,
		'doc://com.apple.documentation/documentation/swiftui/list': mockListReference,
	},
	topicSections: [
		{
			title: 'Views',
			identifiers: [
				'doc://com.apple.documentation/documentation/swiftui/view',
				'doc://com.apple.documentation/documentation/swiftui/text',
			],
		},
		{
			title: 'Controls',
			identifiers: [
				'doc://com.apple.documentation/documentation/swiftui/button',
			],
		},
	],
};

export const mockEmptyFramework: FrameworkData = {
	abstract: [{text: 'An empty framework for testing.', type: 'text'}],
	metadata: {
		title: 'EmptyFramework',
		role: 'collection',
		platforms: [iosPlatform],
	},
	references: {},
	topicSections: [],
};

// Symbol data fixtures
export const mockViewSymbol: SymbolData = {
	abstract: [{text: 'A type that represents part of your app\'s user interface.', type: 'text'}],
	metadata: {
		title: 'View',
		symbolKind: 'protocol',
		roleHeading: 'Protocol',
		platforms: [iosPlatform, macOSPlatform],
	},
	primaryContentSections: [
		{
			kind: 'declarations',
			declarations: [
				{
					languages: ['swift'],
					tokens: [
						{kind: 'keyword', text: 'protocol'},
						{kind: 'text', text: ' '},
						{kind: 'identifier', text: 'View'},
					],
				},
			],
		},
	],
	references: {
		'doc://com.apple.documentation/documentation/swiftui/button': mockButtonReference,
		'doc://com.apple.documentation/documentation/swiftui/text': mockTextReference,
	},
	topicSections: [
		{
			title: 'Related Views',
			identifiers: [
				'doc://com.apple.documentation/documentation/swiftui/button',
				'doc://com.apple.documentation/documentation/swiftui/text',
			],
		},
	],
};

export const mockButtonSymbol: SymbolData = {
	abstract: [{text: 'A control that initiates an action.', type: 'text'}],
	metadata: {
		title: 'Button',
		symbolKind: 'struct',
		roleHeading: 'Structure',
		platforms: [iosPlatform, macOSPlatform],
	},
	primaryContentSections: [
		{
			kind: 'declarations',
			declarations: [
				{
					languages: ['swift'],
					tokens: [
						{kind: 'keyword', text: 'struct'},
						{kind: 'text', text: ' '},
						{kind: 'identifier', text: 'Button'},
						{kind: 'text', text: '<'},
						{kind: 'typeIdentifier', text: 'Label'},
						{kind: 'text', text: '>'},
					],
				},
			],
		},
		{
			kind: 'parameters',
			parameters: [
				{
					name: 'action',
					content: [{type: 'paragraph', inlineContent: [{type: 'text', text: 'The action to perform when the user triggers the button.'}]}],
				},
				{
					name: 'label',
					content: [{type: 'paragraph', inlineContent: [{type: 'text', text: 'A view that describes the purpose of the button\'s action.'}]}],
				},
			],
		},
	],
	references: {},
	topicSections: [],
};

export const mockDeprecatedSymbol: SymbolData = {
	abstract: [{text: 'A deprecated view type.', type: 'text'}],
	metadata: {
		title: 'OldView',
		symbolKind: 'struct',
		roleHeading: 'Structure',
		platforms: [deprecatedPlatform],
	},
	primaryContentSections: [],
	references: {},
	topicSections: [],
};

// Many technologies for pagination testing
export const mockManyTechnologies = (): Record<string, Technology> => {
	const technologies: Record<string, Technology> = {};

	for (let i = 1; i <= 100; i++) {
		const id = `doc://com.apple.documentation/documentation/framework${i}`;
		technologies[id] = {
			identifier: id,
			title: `Framework${i}`,
			url: `/documentation/framework${i}`,
			kind: 'symbol',
			role: 'collection',
			abstract: [{text: `Description for Framework${i}`, type: 'text'}],
		};
	}

	return technologies;
};
