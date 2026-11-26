import { applyDecorators, ParseUUIDPipe, type PipeTransform } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { fieldErrors } from '@yantramitra/shared-validation';
import { z } from 'zod';
import { AppError } from './app-error.js';

/** DTO validation pipe. Unknown keys are stripped, so clients cannot mass-assign fields. */
export function zod<T extends z.ZodType>(schema: T): PipeTransform<unknown, z.output<T>> {
  return {
    transform(value: unknown): z.output<T> {
      const result = schema.safeParse(value ?? {});
      if (!result.success) throw new AppError(400, 'VALIDATION_FAILED', 'Validation failed', fieldErrors(result.error));
      return result.data;
    },
  };
}

export const uuidParam = new ParseUUIDPipe({
  exceptionFactory: () => new AppError(404, 'NOT_FOUND', 'Resource not found'),
});

type JsonSchema = { $schema?: string; properties?: Record<string, object>; required?: string[] };

function toOpenApi(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' }) as JsonSchema;
  delete json.$schema;
  return json;
}

/** Generates OpenAPI from the same schema used for validation. */
export function ApiZod(schemas: { body?: z.ZodType; query?: z.ZodType }): MethodDecorator {
  const decorators: MethodDecorator[] = [];
  if (schemas.body) decorators.push(ApiBody({ schema: toOpenApi(schemas.body) as object, required: true }));
  if (schemas.query) {
    const { properties = {}, required = [] } = toOpenApi(schemas.query);
    for (const [name, schema] of Object.entries(properties))
      decorators.push(ApiQuery({ name, schema, required: required.includes(name) && !('default' in schema) }));
  }
  return applyDecorators(...decorators);
}
