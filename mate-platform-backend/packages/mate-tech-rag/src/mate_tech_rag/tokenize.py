"""Shared text tokenization for RAG matching / similarity.

Produces a bag-of-words set that works for both space-delimited languages
(English) and CJK languages (Chinese) without a segmentation dictionary:

* Latin / digit runs        -> lowercased whole-word tokens.
* Consecutive CJK ideographs -> overlapping character bigrams (a lone
  ideograph yields a unigram). This is the standard "CJK bigram" approach
  used by Lucene/Elasticsearch CJK analyzers.

Naive ``str.split()`` / ``re.findall(r"\\w+", ...)`` both fail on Chinese:
there are no word boundaries, so the whole CJK run collapses into a single
token and overlap-based scoring (KeywordReranker) or similarity-based
splitting (SemanticChunker) becomes a no-op. This module fixes that while
leaving Latin text tokenized exactly as before.
"""
from __future__ import annotations

import re

# Whole Latin/number "word" tokens.
_WORD_RE = re.compile(r"[0-9A-Za-z]+")

# A maximal run of CJK ideographs. Covers Extension A (U+3400-4DBF),
# the Unified block (U+4E00-9FFF), and Compatibility Ideographs (U+F900-FAFF)
# — enough for simplified/traditional Chinese, which is this platform's focus.
_CJK_RUN_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]+")


def tokenize_for_match(text: str) -> set[str]:
    """Return a lowercased bag-of-words set for overlap/similarity scoring.

    Latin/digit runs become whole words; CJK runs become overlapping
    character bigrams (plus a unigram for a lone ideograph). The empty
    string yields an empty set.
    """
    tokens: set[str] = set()
    tokens.update(w.lower() for w in _WORD_RE.findall(text))
    for run in _CJK_RUN_RE.findall(text):
        if len(run) == 1:
            tokens.add(run)
        else:
            tokens.update(run[i : i + 2] for i in range(len(run) - 1))
    return tokens
