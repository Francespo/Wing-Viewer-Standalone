/**
 * Fast path for optional card abilities (v1). The engine still owns the
 * question and the labels: this module only maps its options to the two
 * inputs a player needs — "use" (Enter) and "skip" (Esc). No preference is
 * remembered and nothing is auto-answered.
 */
import type { OptionView } from './live';

export type OptionalChoices = { use: string | null; skip: string | null };

export function optionalChoices(options: OptionView[]): OptionalChoices {
	return {
		use: options.find((option) => !option.decline)?.id ?? null,
		skip: options.find((option) => option.decline)?.id ?? null
	};
}

/** Return the engine option id for a key, or null when the key is unrelated. */
export function optionalKeyChoice(options: OptionView[], key: string): string | null {
	const { use, skip } = optionalChoices(options);
	if (key === 'Enter') return use;
	if (key === 'Escape') return skip;
	return null;
}
