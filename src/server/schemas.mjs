import { z } from 'zod';

export const changesSchema = z.strictObject({
  owner: z.string().trim().min(1).max(80).optional(),
  blocker: z.string().trim().max(300).optional(),
  nextAction: z.string().trim().min(1).max(300).optional()
}).refine(value => Object.keys(value).length > 0, 'At least one changed field is required.');

export const proposalSchema = z.strictObject({
  itemId: z.string().min(1).max(80),
  sourceRevision: z.number().int().positive(),
  changes: changesSchema
});

export const chatSchema = z.strictObject({ message: z.string().trim().min(1).max(1500) });
export const decisionSchema = z.strictObject({ sourceRevision: z.number().int().positive() });
export const switchSessionSchema = z.strictObject({ sessionId: z.uuid() });

export function parseInput(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}
