---
title: Enforce Git hooks in a Rails initializer
---

## Git hooks

Git has a cool feature called [Git hooks][git-hooks]:

> Git Hooks are scripts that Git can execute automatically when certain events occur, such as before or after a commit, push, or merge.

[git-hooks]: https://githooks.com/

For example, I have a [pre-push Git hook][pre-push-hook] script that I want to be run before I push any code up to GitHub for [my website][davidrunger.com]'s repository. This script performs various checks, such as using [Gitleaks][gitleaks] to scan the diff that's about to be pushed up to GitHub for any secrets (like an API access token) and to abort the push if any such secrets are found. The `pre-push` hook also runs various linters.

As long as everyone who works on the repository configures their local Git setup to use the repository's Git hooks, then Git will run that `pre-push` check and verify that it passes before Git will actually push any code to GitHub.

[pre-push-hook]: https://github.com/davidrunger/david_runger/blob/295ee53c793fc9975ca8fe2d8b3b5523ecd6cafc/bin/githooks/pre-push
[davidrunger.com]: https://davidrunger.com/
[gitleaks]: https://github.com/gitleaks/gitleaks

## But, how to enforce that Git hooks are used?

The problem is that, although we can put Git hook scripts in a repo, we cannot enforce that developers actually use them. The nature of git hooks is that one must "opt in" to use them in the configuration of each local copy of a repository, and it's easy to fail to do so. For example, I recently set up a Linux boot on my MacBook. I had previously set up the git hooks for the version of my repository in my Mac operating system, but I didn't think to also set up the git hooks after I then cloned the repository to my fresh Linux OS.

Frequently, a repository's README.md or setup documentation might say something like, "We encourage you to set up this repository's Git hooks, by executing [a certain command]," but developers might ignore or accidentally overlook that instruction, or at some later point they might lose their git configuration and not think to reconfigure the git hooks.

## Idea: enforce Git hooks configuration in a Rails initializer

One solution to this conundrum recently occurred to me: put a check in a Rails initializer to verify that the project's git hooks have indeed been configured. If not, then refuse to boot the app.

I should note that, unfortunately, this is not a _100%_ foolproof way to ensure that developers configure their git setup to use a project's git hooks. A developer could theoretically modify the project's source code without ever successfully booting up the app. But, realistically speaking, I think that's quite unlikely, at least for a developer who is going to do any substantial amount of work on an application. They're going to need to boot up the app sooner or later.

The solution presented below is nominally Rails-specific (in that it leverages the fact that Rails will automatically load during the boot process any `.rb` file in the `config/initializers/` directory), but it should also be very possible to translate this general approach to other web frameworks (or other types of applications), by hooking into the local development boot process in a similar way.

## The initializer

Here's what my relatively simple initializer looks like (with some minor tweaks):

```rb
# File: config/initializers/githooks_check.rb
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

[githooks-check-initializer]: https://github.com/davidrunger/david_runger/blob/295ee53c793fc9975ca8fe2d8b3b5523ecd6cafc/config/initializers/githooks_check.rb

So, if one tries to boot up the Rails app (e.g. `rails server`) without having locally set up the repository's Git hooks, then an error message like this will be printed to stderr, and the app will abort the boot process:

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

## Breaking it down

Here's an explanation of each part of the initializer:

- `Rails.env.local?` checks that we are booting in either the `development` or `test` environment (i.e. not `production`, where Git hooks won't be configured).
- `ENV['SKIP_GITHOOKS_CHECK'].blank?` gives developers a way to skip this check, if that is necessary for some reason, by setting this environment variable.
- `ENV['CI'].blank?` checks that the app is not booting in our Continuous Integration (CI) environment (GitHub Actions), because, like `production`, our Git hooks aren't configured there.

If those conditions are all true, then we perform the key part of the check:

- `` `git config core.hooksPath`.strip != 'bin/githooks'``: This checks if the local git repository has _not_ been configured to use the project's `bin/githooks/` directory as the Git hooks path, and, if it hasn't, then we enter the body of the `if` condition.

Within the `if` block, we print a warning stating that the developer doesn't have the repository's Git hooks configured, and providing a command to configure the git hooks. Finally, we abort the boot process, via `exit(1)`. The developer won't be able to boot the app successfully until they make some sort of change (such as, ideally, configuring the git hooks on their machine, using the provided command).

## Configuring the Git hooks

Remedying that situation is as simple as executing the provided command at the top level of the project directory:

```
❯ git config core.hooksPath bin/githooks
```

That tells Git to look in the repository's [`bin/githooks/`][bin-githooks] directory for relevant scripts before and after performing key actions. For example, Git will look for (and run) a script called `pre-push` before pushing, or a `pre-push` script before committing.

[bin-githooks]: https://github.com/davidrunger/david_runger/tree/main/bin/githooks

Having configured the Git hooks, the `rails server` will now boot successfully!:

```
❯ bin/rails server
=> Booting Puma
=> Rails 7.1.3.4 application starting in development
   [ ... ]
* Listening on http://127.0.0.1:3000
* Listening on http://[::1]:3000
Use Ctrl-C to stop
```

And, when the developer goes to push their code changes up to GitHub, then all of the repository's intended pre-push checks will execute, guarding against secrets being accidentally committed to the source code, and helping to keep code quality high by running several of the project's linting tools.
