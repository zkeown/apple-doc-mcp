/**
 * Validation helper functions for Apple API responses.
 * Provides detailed error messages when validation fails.
 */
import type {ZodSchema, ZodError} from 'zod';
import {
	FrameworkDataSchema,
	SymbolDataSchema,
	TechnologySchema,
	PlatformInfoSchema,
	ReferenceDataSchema,
	DeclarationTokenSchema,
	PrimaryContentSectionSchema,
} from './schemas.js';

export type ValidationResult<T> =
	| {success: true; data: T}
	| {success: false; errors: string[]; rawData: unknown};

/**
 * Formats Zod errors into human-readable messages
 */
function formatZodErrors(error: ZodError, context: string): string[] {
	return error.issues.map(issue => {
		const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
		return `[${context}] ${path}: ${issue.message}`;
	});
}

/**
 * Validates data against a Zod schema with detailed error messages
 */
export function validateWithSchema<T>(
	schema: ZodSchema<T>,
	data: unknown,
	context: string,
): ValidationResult<T> {
	const result = schema.safeParse(data);

	if (result.success) {
		return {success: true, data: result.data};
	}

	const errors = formatZodErrors(result.error, context);
	return {success: false, errors, rawData: data};
}

/**
 * Asserts that data matches schema, throws with detailed message on failure
 */
export function assertValidSchema<T>(
	schema: ZodSchema<T>,
	data: unknown,
	context: string,
): T {
	const result = validateWithSchema(schema, data, context);

	if (!result.success) {
		const errorMessage = [
			`Schema validation failed for ${context}:`,
			...result.errors.map(e => `  - ${e}`),
			'',
			'This may indicate Apple has changed their API response format.',
			'Raw data sample:',
			JSON.stringify(result.rawData, null, 2).slice(0, 500) + '...',
		].join('\n');

		throw new Error(errorMessage);
	}

	return result.data;
}

// Convenience validators for specific types
export const validateFrameworkData = (data: unknown, path: string) =>
	assertValidSchema(FrameworkDataSchema, data, `FrameworkData(${path})`);

export const validateSymbolData = (data: unknown, path: string) =>
	assertValidSchema(SymbolDataSchema, data, `SymbolData(${path})`);

export const validateTechnology = (data: unknown, id: string) =>
	assertValidSchema(TechnologySchema, data, `Technology(${id})`);

export const validatePlatformInfo = (data: unknown, context: string) =>
	assertValidSchema(PlatformInfoSchema, data, `PlatformInfo(${context})`);

export const validateReferenceData = (data: unknown, context: string) =>
	assertValidSchema(ReferenceDataSchema, data, `ReferenceData(${context})`);

export const validateDeclarationToken = (data: unknown, context: string) =>
	assertValidSchema(DeclarationTokenSchema, data, `DeclarationToken(${context})`);

export const validatePrimaryContentSection = (data: unknown, context: string) =>
	assertValidSchema(PrimaryContentSectionSchema, data, `PrimaryContentSection(${context})`);
