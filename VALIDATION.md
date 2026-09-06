# Validation

- Vocabulary: 320 unique entries, 16 groups of 20, each with independently written Chinese meaning, part of speech and English collocation.
- Word identities and ordering checked against the first 320 entries of https://english-exam.lazynote.cn/cet4/words/stats/syllabus/ on 2026-09-06. This is a third-party corpus reference, not an official all-years ranking. No coverage or pass-rate claims.
- Production build and TypeScript check passed.
- Local route returned HTTP 200 before preview handoff.
- Browser visual/interaction QA was not performed (not requested).
- WebMCP tools feature-detect document.modelContext, register once, validate rating inputs and current-word identity, use the visible card action, and unregister on unmount. The environment exposes no supported WebMCP contract validation context; tools have not been runtime-verified.
- Learning state is device-local only; storage failures show an explicit notice. Speech requires browser/device speech synthesis.
