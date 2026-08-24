---
title: "Quick Tip: Use gem.wtf to open a Ruby gem's repository"
---

[gem.wtf](https://gem.wtf/) takes you straight to a Ruby gem's source repository (usually a GitHub repo). Enter `gem.wtf/<gem-name>` in your browser's address bar; for example, [gem.wtf/rails](https://gem.wtf/rails).

It uses the gem's RubyGems metadata, so it works with repositories outside GitHub too. If a gem does not declare a source repository, it falls back to its documentation or RubyGems page.

It's handy for checking a gem's README, issues, and history before using the gem or while debugging a problem.

It was created by [Zeke Sikelianos](https://github.com/zeke); its source is available on [GitHub](https://github.com/zeke/gem.wtf).

**Bonus tip:** [ghub.io](https://ghub.io/) does the same for npm packages.
