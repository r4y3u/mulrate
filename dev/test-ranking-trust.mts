import { analyzeSessionRisk, isFreshVerifiedBaseline } from '../supabase/functions/_shared/ranking-trust.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const normal = analyzeSessionRisk(Array.from({ length: 10 }, (_, index) => ({ firstTime: 0.72 + index * 0.08 })));
assert(!normal.shouldQuarantine, 'Normal human timing must not be quarantined.');
assert(normal.flags.length === 0, 'Normal timing must not be flagged.');

const impossible = analyzeSessionRisk(Array.from({ length: 10 }, (_, index) => ({ firstTime: index < 8 ? 0.18 : 0.6 })));
assert(impossible.shouldQuarantine, 'Eight answers under 250 ms must be quarantined.');
assert(impossible.flags.includes('IMPOSSIBLE_SPEED_BURST'), 'Impossible speed flag is missing.');

const uniform = analyzeSessionRisk(Array.from({ length: 10 }, () => ({ firstTime: 0.8 })));
assert(!uniform.shouldQuarantine, 'Uniform timing alone is a review signal, not automatic quarantine.');
assert(uniform.flags.includes('UNIFORM_SUBSECOND_TIMING'), 'Uniform timing flag is missing.');

assert(isFreshVerifiedBaseline({ ratingBefore: 300, completedSets: 1, typeIndex: 0, patternIndex: 0, patternStayCount: 0 }), 'Fresh baseline should be verified.');
assert(!isFreshVerifiedBaseline({ ratingBefore: 301, completedSets: 1, typeIndex: 0, patternIndex: 0, patternStayCount: 0 }), 'Modified rating baseline must be provisional.');
assert(!isFreshVerifiedBaseline({ ratingBefore: 300, completedSets: 2, typeIndex: 0, patternIndex: 0, patternStayCount: 0 }), 'Prior offline sets must be provisional.');
assert(!isFreshVerifiedBaseline({ ratingBefore: 300, completedSets: 1, typeIndex: 1, patternIndex: 0, patternStayCount: 0 }), 'Advanced progress baseline must be provisional.');

console.log('Ranking trust tests passed.');
