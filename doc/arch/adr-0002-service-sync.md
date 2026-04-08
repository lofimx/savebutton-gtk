# ADR 0002: Service Sync

## Context

Although Kaya will heavily rely on local-first, peer-to-peer (p2p) sync of its data, heavier operations may not be possible on lower-power devices and no one device is blessed as "central".

## Decision

Kaya Server (https://github.com/deobald/kaya-server) will run as an always-up central service that Kaya can always synchronize with. It will use a simple, authenticated HTTP API with endpoints found under `namespace :api`, here:

[config/routes.rb](https://github.com/deobald/kaya-server/blob/master/config/routes.rb)

Local files in Kaya sync to the server symmetrically. Index routes simply list the files available under them, as though they were directory listings.

### Mapping for Client Data Model <=> API Routes:

**Immutable, User-Generated Data**

* `~/.kaya/anga/` <=> `/api/v1/:user_email/anga`
* `~/.kaya/anga/{filename}` <=> `/api/v1/:user_email/anga/:filename`
* `~/.kaya/meta/` <=> `/api/v1/:user_email/meta`
* `~/.kaya/meta/{tomlfile}` <=> `/api/v1/:user_email/meta/:tomlfile`

**Ephemeral, Auto-Generated Data**

* `~/.kaya/words/` <=> `/api/v1/:user_email/words`
* `~/.kaya/words/{anga}` <=> `/api/v1/:user_email/words/:anga`
* `~/.kaya/words/{anga}/{filename}` <=> `/api/v1/:user_email/words/:anga/:filename`
* `~/.kaya/cache/` <=> `/api/v1/:user_email/cache`
* `~/.kaya/cache/{bookmark}` <=> `/api/v1/:user_email/cache/:bookmark`
* `~/.kaya/cache/{bookmark}/{filename}` <=> `/api/v1/:user_email/cache/:bookmark/:filename`
* `~/.kaya/smart/` <=> `/api/v1/:user_email/smart`
* `~/.kaya/smart/{filename}` <=> `/api/v1/:user_email/cache/:filename`

Users can self-host their own Kaya Server, or there will be one primary instance they can connect to.

## Status

Accepted.

## Consequences

API URLs should be easy to inspect, debug, and script. API contents should be discoverable.

This simple, symmetrical API should be easy to replicate across many different clients.
