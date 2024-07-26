---
title: Flaky specs due to ActionCable leakage
subtitle: A cautionary tale
---

## A spec setup at risk of flaking

If the following are all true of your application, then your tests might flake (i.e. fail randomly).

1. You run tests in parallel (locally and/or in CI)
3. Your application uses ActionCable with the Redis adapter
2. Your parallel tests use the same Redis instance (even if different Redis database numbers)
4. You don't have a `channel_prefix` for the `test` environment in your `config/cable.yml`, or the `channel_prefix` doesn't have any dynamic interpolation

## Why this setup causes flakiness

This test setup causes flakiness because Redis's publish/subscribe messaging system is global to a Redis instance. This creates a risk of unintentional interaction between your specs. If **Spec A** triggers an ActionCable update to be broadcast, then that ActionCable update might be received in some other, simultaneously executing **Spec B**. If **Spec B** is a system spec or feature spec, for example, then this ActionCable update might cause a change in the data in the browser, and this unanticipated change to the browser state might cause the spec to fail.

In a case like this, uncovering the cause of the flakiness can be really tricky, because — no matter how hard you look through the code of **Spec B** — there is nothing there that gives a hint about why the browser UI sometimes seems to update in a seemingly random way that causes the spec to fail. This is because the thing that's causing the unexpected state change actually originates in the code of an entirely different spec. What's more, it's probably pretty random which specs happen to execute at the same time in any given test run. This makes it challenging to reproduce the flakiness/failures with any reliability, adding to the difficulty of investigating the cause of the flakiness.

## The solution: use a `channel_prefix` that is unique to each test process

Fortunately, ActionCable includes a configuration option — `channel_prefix` — that can prevent this problem, by effectively keeping the ActionCable broadcasts issued by one Rails/RSpec process from being received by tests that are executing in another Rails/RSpec process.

In my case, the solution looked like [changing][fix-pr] the `test` section of my `config/cable.yml` from this:

```yml
test:
  <<: *default
  channel_prefix: david_runger_test
  url: redis://localhost:6379
```

to this:

```yaml
test:
  <<: *default
  channel_prefix: david_runger_test<%%= ENV['DB_SUFFIX'] %>
  url: redis://localhost:6379
```

Note the addition of the `<%%= ENV['DB_SUFFIX'] %>` ERB interpolation tag at the end of the `channel_prefix`. In my CI test setup, each of the RSpec processes (some of which might execute simultaneously) is provided with a different `DB_SUFFIX` environment variable (such as `_unit`, `_api`, `_feature`, etc.). I'm leveraging that environment variable to ensure that the `channel_prefix` is distinct for each test process, meaning that their ActionCable broadcasts will remain isolated from each other, even when executing in parallel.

Here's some relevant Rails documentation about this feature: [Redis Adapter](https://guides.rubyonrails.org/action_cable_overview.html#redis-adapter).

[fix-pr]: https://github.com/davidrunger/david_runger/pull/4586

## Note: Using distinct Redis database numbers will _not_ work

I initially tried to fix this problem in a different (but conceptually similar) way, by using a different Redis database number for each RSpec process. However, that didn't work, because Redis's publish/subscribe functionality (the basis for the ActionCable functionality) is global to all of the databases of a given Redis instance.
