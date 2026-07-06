# Prototype: salesperson on the printed estimate

**Question:** How should the signed-in user's profile (name/phone/email) appear
on the printed estimate? The user-profile branch had a small "Prepared by …"
byline under the customer name.

**Explored:** header byline (baseline), letterhead strip above the header,
footer signature block, and a borderless "salesperson card" beside the
estimated total — the card direction won and was iterated into three versions
(lines spread to the total's height, business-card stack, serif name).

**Answer: C3 — "serif name, mirrors the total".** Header top-right, next to the
estimated total: eyebrow "YOUR SALESPERSON", the name in the estimate's serif
(text-2xl), phone · email in small type underneath. The block stretches to the
total's exact height (`flex items-stretch` + `flex-col justify-between`) so the
eyebrows align across the top and the contact line sits flush with the bottom
of the dollar amount. No border. If the name is blank the email stands in as
the name and is not repeated in the contact line.

Folded into the estimate print header in `src/App.jsx` (search "Your
salesperson"); profile-modal copy and CLAUDE.md updated from "Prepared by" to
"Your salesperson". Prototype code (`src/PreparedByPrototype.jsx` + App.jsx
hooks) deleted the same day.
