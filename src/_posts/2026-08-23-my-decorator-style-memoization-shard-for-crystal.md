---
title: My decorator-style memoization shard for Crystal
subtitle: Concise, argument-aware method caching without the boilerplate.
image:
  path: https://david-runger-public-uploads.s3.us-east-1.amazonaws.com/memoization-fox.jpg
  width: 1200
  height: 630
  alt: A fox memoizing stuff
---

![A fox memoizing stuff](https://david-runger-public-uploads.s3.us-east-1.amazonaws.com/memoization-fox.jpg)

I was surprised that I couldn't find an established Crystal shard for memoization with the API I wanted. Rubyists have plenty of options, including [MemoWise](https://github.com/panorama-ed/memo_wise), [Memoist](https://github.com/matthewrudy/memoist), and the memoization support in [`dry-core`](https://github.com/dry-rb/dry-core). In Crystal, my searches mostly turned up snippets or code embedded in a larger framework.

So I made [memoization](https://github.com/davidrunger/memoization), a small Crystal shard that lets me write this:

```crystal
memoize def current_content_sha(file_or_directory : String) : String
  # Calculate and return a SHA-256 digest...
end
```

Each distinct argument gets its own cached result, and repeated calls reuse it.

## Why I wanted a memoization shard

Memoization is an easy optimization to understand: save a method's result and reuse it when the same arguments are passed again.

For a method without arguments, I could manage that myself with an instance variable:

```crystal
def expensive_value : String
  @expensive_value ||= calculate_expensive_value
end
```

However, that adds state-management boilerplate to a method whose meaningful job is simply to calculate a value. It also requires more careful handling when `nil` or `false` is valid; otherwise, the calculation can run again on every call.

Arguments make manual memoization more cumbersome. Remembering `current_content_sha("README.md")` independently from `current_content_sha("src")` requires a hash keyed by the method's arguments, plus lookup and assignment logic around the actual implementation.

One reason I enjoy Ruby and Crystal is that they strip away boilerplate and leave expressive code. Building and maintaining a cache by hand felt like a step backward. I wanted the method definition to say what it calculates, with `memoize` as the one clear declaration that its results should be reused.

## The code I found

My path to the shard included a [Crystal Forum thread about a caching decorator](https://forum.crystal-lang.org/t/decorator-for-caching/6221). Someone pointed to the [`memoize` macro in the Lucky framework](https://github.com/luckyframework/lucky/blob/v1.3.0/src/lucky/memoizable.cr), whose syntax was almost exactly what I wanted:

```crystal
memoize def somefun(a, b) : Whatever
  # ...
end
```

There was one important limitation: for methods with arguments, a call with different arguments replaced the previous cached value. The forum thread's original poster described the same problem:

> I'm looking to use it for dynamic programming, so I'd want to use it for all param sets, not just the latest.

I adapted Lucky's code so that methods with arguments use a hash keyed by argument tuples, preserving results for many sets of arguments instead of only the latest one.

I was very inexperienced with Crystal macros, and getting this working was difficult and fairly bumbling. The macro has to inspect the method definition at compile time and generate a typed cache, an uncached implementation, and a public wrapper. Somewhat to my surprise, I figured it out.

The code first lived in my [dotfiles](https://github.com/davidrunger/dotfiles). Git history tells me that I added it in August 2024 while [converting a personal tool from Ruby to Crystal](https://github.com/davidrunger/dotfiles/commit/c710419e839fcdf25a977ffc9185dcd1ee6342c6). In March 2025, I extracted it into the standalone `memoization` shard so that I could reuse it elsewhere.

## Installation and use

Add the shard to `shard.yml`:

```yaml
dependencies:
  memoization:
    github: davidrunger/memoization
```

Then install it and require it:

```console
shards install
```

```crystal
require "memoization"
```

Add `memoize` before a method definition. Both the return type and every argument type must be explicit so that the macro can construct the correctly typed cache:

```crystal
class Greeting
  memoize def message(name : String) : String
    puts "Generating a greeting for #{name}"
    "Hello, #{name}!"
  end
end

greeting = Greeting.new

greeting.message("Jane")
# Prints "Generating a greeting for Jane" and returns "Hello, Jane!"

greeting.message("John")
# Prints "Generating a greeting for John" and returns "Hello, John!"

greeting.message("Jane")
# Returns the cached "Hello, Jane!" without printing anything
```

The cache belongs to the object instance, with a separate entry for each argument combination. The shard also supports methods without arguments, `nil` results, default and named arguments, private methods, and method names ending in `?` or `!`.

## Where I use it

I use the shard throughout the Crystal tools in my dotfiles. For example, one method calculates a SHA-256 digest for a file or directory. Calls for the same path reuse that work while other paths are cached independently.

I also use it in [Skedjewel](https://github.com/davidrunger/skedjewel), a scheduler for Sidekiq jobs. Skedjewel memoizes parsed schedule values and its lock manager. I use Skedjewel to run scheduled jobs for the [david_runger](https://github.com/davidrunger/david_runger) Rails app, so this is "production" use in the sense that it runs my hobby app, not evidence from a large commercial deployment.

## Limitations

This is a small library that solves the problem I have, not a comprehensive caching system. In particular:

- Cached entries have no expiration, eviction, or reset mechanism.
- A method called with an unbounded number of distinct argument combinations will grow its cache without bound.
- The shard does not promise thread safety.
- It memoizes instance methods, with caches scoped to individual object instances.

A more sophisticated implementation might address these limitations. I haven't needed those features, so I have kept the shard simple.

If that tradeoff fits your program, you can find the source, installation instructions, and complete examples at [github.com/davidrunger/memoization](https://github.com/davidrunger/memoization).
