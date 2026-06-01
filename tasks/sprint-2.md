# Sprint 2 — Matching + Materials (with Critic)

> Phase 13 · 2 weeks · Goal: jobs are scored/ranked with rationale + confidence, and the
> system generates grounded, fabrication-checked resume + cover letter per selected job.

## Sprint goal (demo-able)
"Pick a discovered job → see a match score with rationale → generate a tailored resume +
cover letter → the Critic blocks any fabricated claim and passes grounded ones."

## Committed tasks (~39 pts)
| ID | Task | Pts | Depends on |
|----|------|-----|------------|
| T-201 | Profile ingest from MERN_Nikhil.pdf + seed | 5 | T-004 |
| T-202 | Chunk + embed profile (pgvector) | 5 | T-201 |
| T-203 | Job embedding + ANN index | 3 | T-202 |
| T-204 | Rule filters (location/seniority/must-have/comp) | 5 | T-201 |
| T-205 | Matching agent (subscores/score/rationale/confidence) | 8 | T-203,T-204 |
| T-206 | Ranked queue + auto-archive | 3 | T-205 |
| T-301 | Resume agent (grounded) + claims[] | 8 | T-202 |
| T-302 | Cover-letter agent | 5 | T-301 |
| T-303 | Critic/Guardrail (claim→profileRef) | 8 | T-301 |
| T-304 | Material versioning + PDF render | 5 | T-301 |
| T-305 | Fabrication eval set + CI gate | 3 | T-303 |
| T-702 | Approval Queue + Application Detail (read) | 8 | T-701,T-205 |

> Over-committed on purpose; re-point at planning. Critic (T-303) + fabrication gate
> (T-305) are non-negotiable this sprint — they block all of Sprint 3.

## Acceptance for the sprint
- AC-M1, AC-M2 (matching) green.
- AC-B1 (fabrication block) green; injected-fabrication eval recall = 100%.
- AC-B2 (versioning) green.
- Match rationale + confidence visible in Application Detail.

## Risks / notes
- Anti-fabrication is the core trust feature — invest here, add adversarial fixtures.
- Use prompt caching for the master-profile block to control cost.
