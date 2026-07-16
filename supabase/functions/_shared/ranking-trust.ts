export type RankingStatus = 'not_joined' | 'provisional' | 'verified' | 'quarantined' | 'hidden';

export interface TimingSample {
  firstTime: number;
}

export interface RiskAnalysis {
  flags: string[];
  shouldQuarantine: boolean;
}

export function analyzeSessionRisk(items: TimingSample[]): RiskAnalysis {
  const times = items.map((item) => Number(item.firstTime)).filter(Number.isFinite);
  const flags: string[] = [];
  const ultraFastCount = times.filter((time) => time < 0.25).length;
  if (ultraFastCount >= 8) flags.push('IMPOSSIBLE_SPEED_BURST');

  const roundedMillis = new Set(times.map((time) => Math.round(time * 1000)));
  if (times.length === 10 && roundedMillis.size === 1 && times[0] < 1.5) {
    flags.push('UNIFORM_SUBSECOND_TIMING');
  }

  return {
    flags,
    shouldQuarantine: flags.includes('IMPOSSIBLE_SPEED_BURST')
  };
}

export function isFreshVerifiedBaseline(input: {
  ratingBefore: number;
  completedSets: number;
  typeIndex: number;
  patternIndex: number;
  patternStayCount: number;
}): boolean {
  return input.ratingBefore === 300
    && input.completedSets === 1
    && input.typeIndex === 0
    && input.patternIndex === 0
    && input.patternStayCount === 0;
}
