---
title: Enforce Git hooks in a Rails initializer
---

## Git hooks

Git hooks are scripts that Git runs automatically at points such as before a commit, push, or merge. For example, a [pre-push hook][pre-push-hook] in this site's repository uses [Betterleaks][betterleaks] to scan the outgoing diff for secrets and runs linters. See the [Git hook documentation][git-hooks] for the full list.

That feedback is useful only when each contributor's clone is configured to use the hooks stored in the repository.

[git-hooks]: https://git-scm.com/docs/githooks

[pre-push-hook]: https://github.com/davidrunger/david_runger/blob/8e20a1c49595bf48a66682c9e48ce5cc3f892c16/bin/githooks/pre-push
[betterleaks]: https://github.com/betterleaks/betterleaks

## The configuration gap

Git does not automatically use hook scripts committed to a repository; each clone must opt in by setting `core.hooksPath`. Setup documentation can ask contributors to do that, but instructions are easy to miss.

## Check during Rails boot

For a Rails application, an initializer can verify the setting and refuse to boot until it is fixed. That makes a missing one-time setup step visible when a developer first uses the app.

This is a usability guardrail, not a security or policy boundary. A developer can bypass Git hooks (for example, with `git push --no-verify`) or change the initializer without booting the app. Checks that must not be bypassed belong in CI or protected server-side controls.

The idea is not Rails-specific: an application built with any framework could run an equivalent check during local development startup.

## The initializer

Place this in `config/initializers/githooks_check.rb`:

```rb
if (
  Rails.env.local? &&
    ENV['SKIP_GITHOOKS_CHECK'].blank? &&
    ENV['CI'].blank? &&
    `git config core.hooksPath`.strip != 'bin/githooks'
)
  $stderr.puts(<<~ERROR)
    You have not configured the git hooks for this repo! To do so, run:
        git config core.hooksPath bin/githooks
    Or, if you must, you can put SKIP_GITHOOKS_CHECK=1 in your .env file.
  ERROR

  exit(1)
end
```

(You can see the actual source code [here][githooks-check-initializer].)

[githooks-check-initializer]: https://github.com/davidrunger/david_runger/blob/8e20a1c49595bf48a66682c9e48ce5cc3f892c16/config/initializers/githooks_check.rb

Without the setting, `bin/rails server` prints the following error to standard error and aborts:

```
❯ bin/rails server
=> Booting Puma
=> Rails 7.1.3.4 application starting in development
=> Run `bin/rails server --help` for more startup options
You have not configured the git hooks for this repo! To do so, run:
    git config core.hooksPath bin/githooks
Or, if you must, you can put SKIP_GITHOOKS_CHECK=1 in your .env file.
Exiting
```

The conditions limit the check to local, non-CI boots; `SKIP_GITHOOKS_CHECK` provides an escape hatch. The remaining condition verifies that Git uses `bin/githooks`. If it does not, the initializer explains the fix and exits unsuccessfully.

## Configuring the Git hooks

At the project root, run:

```
❯ git config core.hooksPath bin/githooks
```

This tells Git to find hooks in the repository's [`bin/githooks/`][bin-githooks] directory. Git runs `pre-push` before pushing and `pre-commit` before committing, when those executable scripts exist.

[bin-githooks]: https://github.com/davidrunger/david_runger/tree/main/bin/githooks

Rails can now boot:

```
❯ bin/rails server
=> Booting Puma
=> Rails 7.1.3.4 application starting in development
   [ ... ]
* Listening on http://127.0.0.1:3000
* Listening on http://[::1]:3000
Use Ctrl-C to stop
```

Future pushes will also run the repository's pre-push checks locally.
