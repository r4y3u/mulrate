import assert from 'node:assert/strict';
import {
  CERTIFICATION_QUESTION_COUNT,
  certificationTierForTypeIndex,
  createCertificationQuestions,
  evaluateCertification
} from '../supabase/functions/_shared/certification.ts';
import { RATE_CATALOG } from '../supabase/functions/_shared/rate-catalog.ts';

const catalogIds = new Set(RATE_CATALOG.map((item) => item.id));
assert.equal(CERTIFICATION_QUESTION_COUNT, 30);
assert.deepEqual([0, 14, 15, 26, 27, 55, 56, 87, 88, 99].map(certificationTierForTypeIndex), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);

for (const typeIndex of [0, 20, 45, 75, 99]) {
  const attemptId = `00000000-0000-4000-8000-${String(typeIndex).padStart(12, '0')}`;
  const a = createCertificationQuestions(attemptId, typeIndex);
  const b = createCertificationQuestions(attemptId, typeIndex);
  assert.deepEqual(a, b, `question generation must be deterministic for index ${typeIndex}`);
  assert.equal(a.length, 30);
  assert.equal(new Set(a.map((q) => q.id)).size, 30);
  assert.equal(a.filter((q) => q.band === 'foundation').length, 8);
  assert.equal(a.filter((q) => q.band === 'core').length, 16);
  assert.equal(a.filter((q) => q.band === 'challenge').length, 6);
  for (const question of a) {
    assert.ok(catalogIds.has(question.typeId), `unknown typeId ${question.typeId}`);
    assert.ok(Number.isFinite(question.left) && Number.isFinite(question.right));
    assert.ok(question.targetSeconds > 0);
  }

  const perfect = evaluateCertification(a, a.map((q) => ({
    questionId: q.id,
    answer: q.left * q.right,
    firstTime: Math.max(0.5, q.targetSeconds)
  })));
  assert.equal(perfect.passed, true);
  assert.equal(perfect.overallCorrect, 30);

  const tooFast = evaluateCertification(a, a.map((q) => ({
    questionId: q.id,
    answer: q.left * q.right,
    firstTime: 0.1
  })));
  assert.equal(tooFast.passed, false);
  assert.equal(tooFast.riskPass, false);

  const wrong = evaluateCertification(a, a.map((q, index) => ({
    questionId: q.id,
    answer: index < 23 ? q.left * q.right : q.left * q.right + 1,
    firstTime: q.targetSeconds
  })));
  assert.equal(wrong.passed, false);
  assert.equal(wrong.correctnessPass, false);
}

console.log('Certification generation and evaluation tests passed.');
