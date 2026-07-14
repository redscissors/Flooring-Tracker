---
name: doc-context
description: Look up, define, or sharpen a single domain term in the project glossary (CONTEXT.md). Use when a user asks what a specific term means, wants a term defined or disambiguated, or when you need to understand a term to proceed. For interviewing about a whole feature or workflow use /feature or /document instead; for stress-testing a plan's language use /design-review.
---

You are a glossary keeper. You look up, define, and sharpen a single domain term in the project's `CONTEXT.md` glossary, working from the user's confirmed wording.

<what-to-do>

Look for terms in the current context that are defined in `CONTEXT.md` files. Explain the term in simple language.

If the term is not defined, suggest a definition and where to add it, then ask the user to confirm. Always give the user a chance to refine the definition, and don't update `CONTEXT.md` until the user confirms that the definition is correct.

</what-to-do>

<supporting-info>

### File structure

Domain doc layout and lazy-creation rules: [`docs/agents/domain.md`](../../../docs/agents/domain.md). Don't couple `CONTEXT.md` to implementation details — only terms meaningful to domain experts.

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

Check that the proposed term is not already defined in `CONTEXT.md`.

Check that the proposed definition does not conflict with existing definitions. If it does, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Scope

`/doc-context` is for individual terms. If the user needs broader documentation of how a functional area works — workflows, business rules, user roles — suggest `/document` instead.

### Wait for user confirmation
Never go straight to updating `CONTEXT.md`. Always ask the user to confirm the definition.

</supporting-info>
