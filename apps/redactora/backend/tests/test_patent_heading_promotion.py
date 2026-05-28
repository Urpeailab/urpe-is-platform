"""Regression tests for the patent section-heading promotion fix.

Covers the reported bug where the "complete" patent PDF showed section
subtitles as numbered body paragraphs (e.g. "¶0009 CROSS-REFERENCE TO RELATED
APPLICATIONS") instead of bold headings.

`_promote_numbered_patent_headings` converts a <p> whose entire text is just a
canonical USPTO section heading (optionally prefixed by a paragraph-number
marker) into an <h2>, BEFORE paragraph renumbering, so the promoted heading
does not consume a ¶ number (no gaps in body numbering).
"""

import os
import sys

# Make the backend package importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import _promote_numbered_patent_headings as promote  # noqa: E402


def test_entity_numbered_heading_becomes_h2():
    html = ('<p>&#182;0009 CROSS-REFERENCE TO RELATED APPLICATIONS</p>'
            '<p>&#182;0010 This application claims no priority.</p>')
    out = promote(html)
    assert '<h2><strong>CROSS-REFERENCE TO RELATED APPLICATIONS</strong></h2>' in out
    assert 'This application claims no priority' in out
    # the heading paragraph + its number must be gone
    assert '0009 CROSS' not in out


def test_pilcrow_with_bold_title_becomes_h2():
    out = promote('<p>¶0016 <strong>FIELD OF THE INVENTION</strong></p>')
    assert '<h2><strong>FIELD OF THE INVENTION</strong></h2>' in out
    assert '<p' not in out


def test_bracket_marker_spanish_heading_becomes_h2():
    out = promote('<p>[0005] CAMPO DE LA INVENCIÓN</p>')
    assert '<h2><strong>CAMPO DE LA INVENCIÓN</strong></h2>' in out


def test_plain_heading_without_number_becomes_h2():
    out = promote('<p>ABSTRACT</p>')
    assert '<h2><strong>ABSTRACT</strong></h2>' in out


def test_body_paragraph_is_not_promoted():
    html = '<p>&#182;0017 The present invention relates to predictive maintenance.</p>'
    out = promote(html)
    assert '<h2>' not in out
    assert 'The present invention relates' in out


def test_prose_starting_with_heading_word_is_not_promoted():
    out = promote('<p>BACKGROUND of the system is robust and scalable.</p>')
    assert '<h2>' not in out


def test_inventor_header_line_is_not_promoted():
    html = '<p>&#182;0002 <strong>Title of the Invention:</strong> Cyber-physical platform</p>'
    out = promote(html)
    assert '<h2>' not in out


def test_content_without_paragraphs_is_unchanged():
    html = '<h2><strong>SUMMARY</strong></h2><div>x</div>'
    assert promote(html) == html


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
