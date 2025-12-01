import {describe, it, expect} from 'vitest';
import {
	header,
	bold,
	list,
	blankLine,
	paragraph,
	section,
	trimWithEllipsis,
	codeBlock,
	inlineCode,
	warning,
	deprecationWarning,
	availabilityBadge,
} from './markdown.js';

describe('markdown utilities', () => {
	describe('header', () => {
		it('creates h1 header', () => {
			expect(header(1, 'Title')).toBe('# Title');
		});

		it('creates h2 header', () => {
			expect(header(2, 'Subtitle')).toBe('## Subtitle');
		});

		it('handles level 0 as level 1', () => {
			expect(header(0, 'Title')).toBe('# Title');
		});

		it('handles negative level as level 1', () => {
			expect(header(-1, 'Title')).toBe('# Title');
		});
	});

	describe('bold', () => {
		it('creates bold label-value pair', () => {
			expect(bold('Name', 'SwiftUI')).toBe('**Name:** SwiftUI');
		});
	});

	describe('list', () => {
		it('creates bulleted list with default bullet', () => {
			expect(list(['one', 'two'])).toBe('• one\n• two');
		});

		it('creates list with custom bullet', () => {
			expect(list(['a', 'b'], '-')).toBe('- a\n- b');
		});

		it('handles empty list', () => {
			expect(list([])).toBe('');
		});
	});

	describe('blankLine', () => {
		it('returns empty string', () => {
			expect(blankLine()).toBe('');
		});
	});

	describe('paragraph', () => {
		it('returns text as-is', () => {
			expect(paragraph('Some text')).toBe('Some text');
		});
	});

	describe('section', () => {
		it('creates section with h2 title and body', () => {
			const result = section('Title', ['Line 1', 'Line 2']);
			expect(result).toEqual(['## Title', 'Line 1', 'Line 2', '']);
		});
	});

	describe('trimWithEllipsis', () => {
		it('returns text unchanged when under max length', () => {
			expect(trimWithEllipsis('short', 100)).toBe('short');
		});

		it('returns text unchanged when equal to max length', () => {
			expect(trimWithEllipsis('exact', 5)).toBe('exact');
		});

		it('trims and adds ellipsis when over max length', () => {
			expect(trimWithEllipsis('this is a long text', 10)).toBe('this is a ...');
		});

		it('handles zero max length', () => {
			expect(trimWithEllipsis('text', 0)).toBe('...');
		});
	});

	describe('codeBlock', () => {
		it('creates code block with default swift language', () => {
			expect(codeBlock('let x = 1')).toBe('```swift\nlet x = 1\n```');
		});

		it('creates code block with custom language', () => {
			expect(codeBlock('const x = 1', 'javascript')).toBe('```javascript\nconst x = 1\n```');
		});
	});

	describe('inlineCode', () => {
		it('wraps text in backticks', () => {
			expect(inlineCode('View')).toBe('`View`');
		});
	});

	describe('warning', () => {
		it('creates warning blockquote', () => {
			expect(warning('Be careful')).toBe('> ⚠️ **Warning:** Be careful');
		});
	});

	describe('deprecationWarning', () => {
		it('creates deprecation warning without message', () => {
			expect(deprecationWarning('iOS')).toBe('> ⚠️ **Deprecated** on iOS');
		});

		it('creates deprecation warning with message', () => {
			expect(deprecationWarning('iOS', 'Use NewAPI instead')).toBe('> ⚠️ **Deprecated** on iOS: Use NewAPI instead');
		});
	});

	describe('availabilityBadge', () => {
		it('creates basic availability badge', () => {
			expect(availabilityBadge('iOS', '15.0')).toBe('iOS 15.0+');
		});

		it('creates deprecated badge', () => {
			expect(availabilityBadge('iOS', '15.0', {deprecated: true})).toBe('⚠️ iOS 15.0+');
		});

		it('creates beta badge', () => {
			expect(availabilityBadge('visionOS', '1.0', {beta: true})).toBe('β visionOS 1.0+');
		});

		it('creates unavailable badge', () => {
			expect(availabilityBadge('watchOS', '1.0', {unavailable: true})).toBe('watchOS: ~~unavailable~~');
		});

		it('creates badge with multiple flags', () => {
			expect(availabilityBadge('iOS', '15.0', {deprecated: true, beta: true})).toBe('⚠️β iOS 15.0+');
		});

		it('handles empty options object', () => {
			expect(availabilityBadge('iOS', '15.0', {})).toBe('iOS 15.0+');
		});
	});
});
