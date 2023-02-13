---
title: "Quick Tip: Use gem.wtf to go to the GitHub repo of a gem"
subtitle:
---

[gem.wtf](https://gem.wtf/) is a handy little website/tool that I use probably at least once a week.
Its purpose is quite simple: enter `gem.wtf/some_ruby_gem` into your browser's URL bar, and it will
redirect you to that gem's source code repository (i.e. usually their GitHub repo).

Here are some examples:
- [gem.wtf/rails](https://gem.wtf/rails)
- [gem.wtf/sidekiq](https://gem.wtf/sidekiq)
- [gem.wtf/simple_cov-formatter-terminal](https://gem.wtf/simple_cov-formatter-terminal)

This is a really quick and convenient way to get from the name of a gem to its GitHub repo, which
can be handy...

- to quickly see how many GitHub stars a gem has that you're thinking about using
- to view a gem's README documentation
- to search/browse through the GitHub Issues/PRs/Discussions, if you're running into a bug/problem
- to clone the git repository, so that you can dig through the code history and get some additional
  context about how and why the library works the way it does
- and more!

Of course, you can also find the gem's GitHub repo through Google or
[RubyGems](https://rubygems.org/), but this saves you a click and takes you straight there.

Thanks to the creator of gem.wtf, [Zeke Sikelianos](https://github.com/zeke). You can check out
gem.wtf's source code [here](https://github.com/zeke/gem.wtf) (it's actually a simple Node `express`
app).

**Bonus tip:** There's a similar tool to get to the GitHub repo for a JavaScript npm package:
[ghub.io](https://ghub.io/). For example, [ghub.io/lodash](https://ghub.io/lodash) takes you to the
GitHub repo for the `lodash` npm package.
