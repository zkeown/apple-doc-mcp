import {expect} from 'vitest';
import type {ToolResponse} from '../server/context.js';

/**
 * Extracts the text content from a ToolResponse.
 */
export const getResponseText = (response: ToolResponse): string => {
	if (!response.content || response.content.length === 0) {
		return '';
	}

	return response.content[0]?.text ?? '';
};

/**
 * Asserts that the response contains the expected text.
 */
export const expectResponseContains = (response: ToolResponse, expected: string): void => {
	const text = getResponseText(response);
	expect(text).toContain(expected);
};

/**
 * Asserts that the response does NOT contain the text.
 */
export const expectResponseNotContains = (response: ToolResponse, notExpected: string): void => {
	const text = getResponseText(response);
	expect(text).not.toContain(notExpected);
};

/**
 * Asserts that the response contains a markdown header at the specified level.
 */
export const expectMarkdownHeader = (response: ToolResponse, level: number, content: string): void => {
	const text = getResponseText(response);
	const headerPrefix = '#'.repeat(level);
	expect(text).toContain(`${headerPrefix} ${content}`);
};

/**
 * Asserts that the response contains a bold key-value pair.
 */
export const expectBoldValue = (response: ToolResponse, key: string, value: string): void => {
	const text = getResponseText(response);
	expect(text).toContain(`**${key}:** ${value}`);
};

/**
 * Asserts that the response matches a regex pattern.
 */
export const expectResponseMatches = (response: ToolResponse, pattern: RegExp): void => {
	const text = getResponseText(response);
	expect(text).toMatch(pattern);
};

/**
 * Asserts that the response is valid (has content array with text).
 */
export const expectValidResponse = (response: ToolResponse): void => {
	expect(response).toHaveProperty('content');
	expect(Array.isArray(response.content)).toBe(true);
	expect(response.content.length).toBeGreaterThan(0);
	expect(response.content[0]).toHaveProperty('type', 'text');
	expect(response.content[0]).toHaveProperty('text');
	expect(typeof response.content[0].text).toBe('string');
};

/**
 * Counts occurrences of a substring in the response text.
 */
export const countOccurrences = (response: ToolResponse, search: string): number => {
	const text = getResponseText(response);
	return (text.match(new RegExp(search, 'g')) || []).length;
};

/**
 * Extracts all lines from response that match a pattern.
 */
export const getMatchingLines = (response: ToolResponse, pattern: RegExp): string[] => {
	const text = getResponseText(response);
	return text.split('\n').filter(line => pattern.test(line));
};
