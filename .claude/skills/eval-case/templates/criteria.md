---
type: llm
weight: 1
---

<!-- One or two sentences: the claim under test, and whether this is a capability
     case or a regression guard. A reader who deletes this case later will do it on
     the strength of this paragraph. -->

Passes if:
- <observable behaviour, decidable by someone who has not read the skill>
- <what it must NOT do, where staying silent is the correct answer>

Fails if:
- <the defect, stated as the confident wrong answer actually looks>
- <the hedge: naming the defect and its opposite together. A rubric that accepts
   both is scoring vocabulary, not judgment.>

Baseline: <expected to fail unaided | expected to pass unaided>.
<If expected to pass: say why the case is kept anyway — which regression it guards
 against — or the retention table says to delete it.>
