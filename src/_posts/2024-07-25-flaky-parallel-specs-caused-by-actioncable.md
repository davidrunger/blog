---
title: Flaky specs due to ActionCable leakage
subtitle: Isolate broadcasts for every test process
---

## When this can happen

Your specs can fail intermittently when all of the following are true:

1. You run tests in parallel (locally and/or in CI).
2. Your application uses ActionCable with the Redis adapter.
3. The parallel test processes share a Redis instance, even if they use different Redis databases.
4. The `test` `channel_prefix` in `config/cable.yml` is not unique to each process.

## Why this setup causes flakiness

Redis Pub/Sub channels are shared by every database in an instance. If **Spec A** broadcasts an ActionCable update, a simultaneously running **Spec B** can receive it. In a system or feature spec, that unexpected broadcast can change the browser state and fail the spec.

The failing spec offers no obvious clue because the broadcast originated in another process. Which specs overlap varies between runs, so the failure can also be difficult to reproduce.

## Use a unique `channel_prefix` for each test process

Set `channel_prefix` to a value that differs for every test process. ActionCable then uses distinct Redis Pub/Sub channels, keeping each process's broadcasts isolated.

For example, I [changed][fix-pr] the `test` section of `config/cable.yml` from:

```yaml
test:
  <<: *default
  channel_prefix: david_runger_test
  url: redis://localhost:6379
```

to:

```yaml
test:
  <<: *default
  channel_prefix: david_runger_test<%%= ENV['DB_SUFFIX'] %>
  url: redis://localhost:6379
```

The `<%%= ENV['DB_SUFFIX'] %>` ERB interpolation makes the prefix process-specific. My CI assigns every RSpec process a distinct `DB_SUFFIX`, such as `_unit`, `_api`, or `_feature`.

Rails documents `channel_prefix` for avoiding channel-name collisions when applications share a Redis server: [Redis Adapter](https://guides.rubyonrails.org/action_cable_overview.html#redis-adapter).

## Separate Redis databases do not isolate Pub/Sub

Different Redis database numbers do not solve this problem: Redis Pub/Sub is not scoped to databases. Redis recommends prefixing channel names when they need to be scoped: [Database & Scoping](https://redis.io/docs/latest/develop/pubsub/#database--scoping).

[fix-pr]: https://github.com/davidrunger/david_runger/pull/4586
