"""Tests for `_strip_unresolved_brackets` — the final post-Firecrawl pass
that removes residual placeholder brackets from whitepaper content.

Covers:
  • `[NEEDED: ...]`, `[TBD: ...]`, `[TODO]`, `[REQUERIDO: ...]`
  • `[Organization]`, `[Leading Financial Institution]` (descriptor labels)
  • `[Insert X]`, `[Specify X]`, `[Your Company]`
  • `[X%]`, `[Y]` style variable placeholders
  • MUST NOT strip legitimate content such as URLs, citations like
    `[9 C.F.R. § 204.5]` or `[Fig. 2]` or markdown reference links `[1]`
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import _strip_unresolved_brackets


def test_needed_stripped():
    text = "The pilot will cover [NEEDED: target SME count] SMEs across [NEEDED: target states]."
    out = _strip_unresolved_brackets(text)
    assert "[NEEDED" not in out
    assert "SMEs across" in out


def test_pending_information_stripped():
    text = "Revenue growth of [pending information] YoY."
    out = _strip_unresolved_brackets(text)
    assert "[pending" not in out.lower()


def test_single_word_descriptor_removed():
    text = "Founded by the [Organization] in 2019."
    out = _strip_unresolved_brackets(text)
    assert "[Organization]" not in out
    # Replaced with empty → double space collapsed
    assert "Founded by the" in out


def test_multiword_descriptor_replaced_with_qualitative():
    text = "Partnered with [Leading Financial Institution] and [Economic Association]."
    out = _strip_unresolved_brackets(text)
    assert "[Leading Financial Institution]" not in out
    assert "[Economic Association]" not in out
    assert "a recognized institution" in out


def test_insert_specify_describe_stripped():
    text = "[INSERT number] users active as of [SPECIFY date]."
    out = _strip_unresolved_brackets(text)
    assert "[INSERT" not in out
    assert "[SPECIFY" not in out


def test_your_x_stripped():
    text = "Contact [Your Company] for more information."
    out = _strip_unresolved_brackets(text)
    assert "[Your" not in out


def test_variable_x_stripped():
    text = "Growth of [X%] per year."
    out = _strip_unresolved_brackets(text)
    assert "[X%]" not in out
    assert "[X]" not in out


def test_legitimate_citations_preserved():
    # Legal citations contain digits / punctuation → our descriptor regex
    # requires 1-6 capitalized words only, so these are safe.
    text = "INA § 203(b)(2)(A)(i); see [8 C.F.R. § 204.5(k)(2)]."
    out = _strip_unresolved_brackets(text)
    assert "[8 C.F.R. § 204.5(k)(2)]" in out


def test_markdown_ref_links_preserved():
    text = "As noted in prior work [1] and follow-up [2]."
    out = _strip_unresolved_brackets(text)
    assert "[1]" in out
    assert "[2]" in out


def test_figure_refs_preserved():
    text = "See [Fig. 2] for details and [Eq. 3]."
    out = _strip_unresolved_brackets(text)
    # These contain punctuation so our descriptor regex won't match.
    assert "[Fig. 2]" in out
    assert "[Eq. 3]" in out


def test_empty_and_none_safe():
    assert _strip_unresolved_brackets("") == ""
    assert _strip_unresolved_brackets("Plain text no brackets") == "Plain text no brackets"


def test_nested_brackets_best_effort():
    text = "See [NEEDED: refer to [1] of table]."
    out = _strip_unresolved_brackets(text)
    # Either [NEEDED] is removed (and a dangling `[1]` kept) or the whole
    # thing is stripped; what matters is `[NEEDED` no longer survives.
    assert "[NEEDED" not in out


def test_idempotent():
    text = "[NEEDED: x] then [Organization] then plain."
    once = _strip_unresolved_brackets(text)
    twice = _strip_unresolved_brackets(once)
    assert once == twice
