/**
 * "Skip all optional" (D-174 #18). A UI preference that posts an engine
 * question's own decline id back to the engine. It evaluates no rule and never
 * hard-codes an option id: the id comes from `optionalChoices`, which derives
 * it from `option.decline` in the live contract.
 */
import type { Question } from './live';
import { optionalChoices } from './optional-fast';

/** Engine decline id for an optional question, or null when nothing may be posted. */
export function autoSkipOptionalId(question: Question | null, skipAll: boolean): string | null {
	if (!skipAll || question === null || question.kind !== 'optional') return null;
	return optionalChoices(question.options).skip;
}
