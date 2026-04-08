# ADR 0003: Metadata

## Context

Because bookmarks, notes, and other files are immutable and the `~/.kaya/anga` directory is append-only, we want somewhere save to collect metadata about those files.

## Decision

Metadata, like anga, is represented by files on disk, each named in sequential fashion. Like anga, metadata files follow a `YYYY-mm-ddTHHMMSS` format, in UTC. The folder containing these files is append-only and these files are also _immutable_, meaning that the user records one and then never touches it again. The timestamp associated with the file corresponds to the time (in UTC) the user made the record. In the rare case when there is a sub-section collision, the filename prefix format is `YYYY-mm-ddTHHMMSS_SSSSSSSSS`, representing nanoseconds.

Metadata is stored as human-readable [`.toml`](https://toml.io/en/) files.

Examples:

* `~/.kaya/meta/2026-01-27T171207-note.toml`
* `~/.kaya/meta/2025-01-01T120000-tags.toml`
* `~/.kaya/meta/2026-01-21T164145_354000000-note.toml`

The format looks like the following as of 2026-01-30, but may evolve with time:

```toml
[anga]
filename = "2026-01-28T205208-bookmark.url"

[meta]
tags = ["podcast", "democracy", "cooperatives"]
note = '''This is a longer note, containing a reminder to myself that I was a guest on this podcast.

It can be multi-line and uses single quotes to prevent escaping.'''
```

## Status

Accepted.

## Consequences

Metadata files are helpful for two reasons: tags and notes can be presented to the user in a "Preview" or detail-oriented user interface, if desired. But more importantly, metadata helps search mechanisms both in Kaya clients and the Kaya Server by adding context to the item/anga that's been saved.
