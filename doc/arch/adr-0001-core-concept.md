# ADR 0001: Core Concept

## Context

Every day, almost all people make little notes to themselves. These may be small text notes or they might be a lightweight bookmark of a website. Maybe an image or PDF. Such notes and bookmarks are inherently immutable, living on a timeline that is rarely (if ever) revisited.

Some people use GMail for this purpose, due to its search capabilities. Some people use WhatsApp or Telegram. But these are all the wrong tool. Kaya intends to replace these, for this one purpose.

A core feature of Kaya will be that it can easily do local-first, peer-to-peer (p2p) sync of its data.

## Decision

Notes and bookmarks ("anga") are just files on disk, each named in a sequential fashion, following a `YYYY-mm-ddTHHMMSS` format, in UTC. The folder containing these files is append-only and these files are _immutable_, meaning that the user records one and then never touches it again. The timestamp associated with the file corresponds to the time (in UTC) the user made the record. In the rare case when there is a sub-section collision, the filename prefix format is `YYYY-mm-ddTHHMMSS_SSSSSSSSS`, representing nanoseconds.

Examples:

* `~/.kaya/anga/2026-01-27T171207-bookmark.url`
* `~/.kaya/anga/2025-01-01T120000-wakarimasen-lol.png`
* `~/.kaya/anga/2026-01-21T164145_354000000-note.md`

The core functionality of Kaya comes from retrieval: looking up old notes, bookmarks, and files. Arbitrary files can be added, but images and PDFs are the most likely formats.

## Status

Accepted.

## Consequences

This very simple design decision has a lot of helpful downstream consequences. Backing up to a server is easy. Local-first sync becomes easier, since conflicts are impossible.
