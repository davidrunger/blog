---
title: Automatically compiling Crystal for development tooling
subtitle: The ease and beauty of Ruby, with the speed of C.
image: https://david-runger-public-uploads.s3.amazonaws.com/crystal-logo-stacked.png
---

## The importance of good tooling

Having good tooling can be an important part of the software development process. Good tooling can help a developer to operate more quickly/efficiently, and also to get into a flow state. If one's tooling can take care of some of the more mundane aspects of software development, then more of that developer's time, energy, and uninterrupted focus can be spent on the higher-value aspects of software delivery.

## Custom tooling

Lots of great tooling is available off the shelf, and it's usually best to leverage the work done by others, when it's possible to do so, rather than reinventing the wheel.

However, there are some tools one will want that are unique to one's idiosyncratic workflow, or, for whatever other reason, off-the-shelf tooling might not be available to meet a given need. In these cases, happily, as software developers, we can write our own tooling! I often do.

A lot of the tools that I create for myself comes in the forms of programs that I execute from a terminal, or which are invoked indirectly by some _other_ command that I execute in a terminal.

For example, I often want to pull updates from a GitHub repository down to my local machine, and then rebase my branch onto that updated version of the `main` branch. I do this by executing in my terminal a command that I've written called `gform` (which stands for "git fetch origin and rebase with main").

In addition to updating my branch with the latest version of the `main` branch, this `gform` command also executes another program that I've written, called `install-packages-in-background`, which looks at the project's dependency lock files (the `Gemfile.lock`, `yarn.lock`, etc) and checks whether the relevant package installation command (e.g. `bundle install` or `yarn install`) has ever been executed on my machine for the current version of the dependency lock file. If not, then my `install-packages-in-background` script will execute the relevant package installation command (in the background).

## Which language to use?

Which computer language should `install-packages-in-background` be written in? Since it's just a command that I am running on my local machine, I could write it in pretty much any language that I can install on my machine.

## Consideration: startup time

As a primarily Ruby and JavaScript developer, I always have those languages installed on my development machine, so those are options. However, one downside of these languages is that they have a somewhat noticeable startup time. Running about the most minimal Ruby program imaginable takes over 130 milliseconds on my machine:

```
❯ time ruby -e 'puts("Hi!")'
Hi!
ruby -e 'puts("Hi!")'  0.09s user 0.04s system 99% cpu 0.132 total
```

Node is even a little bit slower, taking about 200 ms to start up:

```
❯ time node -e 'console.log("Hi!")'
Hi!
node -e 'console.log("Hi!")'  0.18s user 0.07s system 122% cpu 0.205 total
```

A few hundred milliseconds might not seem like a lot, but it adds up, and the time spent waiting for a relatively slow Ruby or Node program to execute risks interfering with one's development flow state.

## Bash: the fast solution?

Another (and typically much faster-executing) option is to use a shell scripting language, such as bash. And, indeed, I do write the vast majority of my little development tooling scripts in bash. Bash starts up much more quickly than Ruby or Node:

```
❯ time bash -c 'echo "Hi!"'
Hi!
bash -c 'echo "Hi!"'  0.00s user 0.00s system 89% cpu 0.006 total
```

Just six milliseconds!

## Bash: not fun for complicated logic

However, while bash can do a lot, I don't find it very pleasant to work with when it comes to performing any sort of semi-complicated logic.

## Bash: no package system to lean on

Additionally, the bash scripting language doesn't really have a package management framework, so we don't really have the ability to easily leverage the work of others. Our bash scripts must be pretty self contained and do everything themselves. Bash scripts can call out to other programs, but there aren't generally libraries that we can load into our script to provide useful functionality.

## What about Lua?

Another language that I experimented with recently is Lua. It has a fast startup time that is comparable to bash's (just a few milliseconds) and a package management system (LuaRocks). I was hopeful that I'd find the language/syntax more pleasant and natural to work with than bash.

However, after trying Lua, I found it's standard library to be quite limited. As a result, I had to manually implement some basic functionality (such as merging two dictionaries) that I had hoped/expected would be built into the language.

## Could we use a compiled language?

All of the languages that I have named so far are _interpreted languages_ (as opposed to compiled ones). I never thought that a compiled programming language would work well for writing the sort of developer tooling programs that I've been discussing, for the simple reason that I'd have to remember and bother with recompiling the program into a binary whenever I make a change to the program, and I'd also need to make that compiled binary available as an executable program on my `PATH` (so that they can be invoked easily from the command line or from other programs).

In contrast, when writing a program in an interpreted language, all that I have to do is to put the program's source code in a location on my `PATH`. Then, whenever I edit the program source code, that new version of the program is immediately "live" on my system, without any additional steps on my part. The relative hassle of a compiled language didn't seem worthwhile to me.

## The big idea: automatically compiled programs

However, that all changed, when ChatGPT and I collaborated on a way to automatically compile and make available on my `PATH` the executable binary output of compiled development tooling programs. This opened up a whole new world of compiled programming language options that I could now consider for writing development tooling programs, without the hassle that had made me shy away from compiled languages for this purpose up until now.

## My go-to compiled language: Crystal

![Crystal logo](https://david-runger-public-uploads.s3.amazonaws.com/crystal.png)

The compiled language that I decided to try out first as a language in which to write development tooling is **[Crystal](https://crystal-lang.org/)**. Crystal is a compiled language with a syntax that is very similar to Ruby (with the main difference being that Crystal sometimes requires type annotations). Crystal programs are extremely fast, often comparable to (or even faster than) a raw C implementation. Crystal programs also use much less memory than an equivalent Ruby program would.

Crystal also has extremely helpful and well formatted error messages, and [the documentation][crystal-docs] is useful and easy to read.

[crystal-docs]: https://crystal-lang.org/api/master/

Overall, I find it a pleasure to work with, and I feel lucky that there exists a language with the ease and beauty of Ruby and yet also with the speed of C and light memory usage.

## These concepts apply to any compiled language

The focus of this blog post is not about Crystal, though. What I want to focus on is the framework that ChatGPT and I came up with to automatically compile my Crystal development tooling programs and make them available on my `PATH`. Indeed, there is very little that is Crystal-specific in what I'm about to share, and I think that this framework/process could easily be adapted to almost any other compiled language, such as Rust or Go.

## Example: my `unique-union` program

To illustrate concretely, let's look at one particular program that I have written in Crystal, called `unique-union`. This program takes two arguments, and prints the set of words in those arguments, deduplicated and sorted. Example:

```
❯ unique-union "wave hello bye" "hello ocean wave"
bye
hello
ocean
wave
```

(This might seem kind of pointless, but it's useful within one of my other tools.)

That functionality is implemented in Crystal as such:

```cr
#!/usr/bin/env crystal

# file location: ~/code/dotfiles/crystal-programs/unique-union.cr

def unique_union(set1 : String, set2 : String) : Array(String)
  set1_words = set1.split
  set2_words = set2.split

  (set1_words | set2_words).sort
end

if ARGV.size == 2
  unique_union(ARGV[0], ARGV[1]).each { |item| puts(item) }
else
  puts "Usage: unique-union \"first list of words\" \"second list of words\""
  exit(1)
end
```

## Setting up automatic Crystal compilation

What we want is some way to automatically convert that Crystal source code into an executable binary.

### Part 1: `symlink-crystal-programs`

Part of the trick comes from adding this line to my `~/.zshrc` file:

```sh
# Set up (in the background) symlinks for programs written in Crystal
{ ( symlink-crystal-programs >&3 & ) } 3>&1
```

Most of that syntax is just to make the command execute without printing any output, and to do so in the background (so that it doesn't slow down my shell startup time). The key point is that, whenever I open a new terminal tab, `symlink-crystal-programs` will execute, which is the following bash program.

It iterates over all of the Crystal source code files in my `crystal-programs` source directory, and, for each program, creates a symlink that is available in my `PATH` and which points to another bash program (`run-crystal-program`) that will automatically compile the Crystal source code into a binary, as needed.

The end result will look like this:

```
❯ tree ~/bin/crystal-symlinks
/home/david/bin/crystal-symlinks
├── install-packages-in-background -> /home/david/code/dotfiles/bin/run-crystal-program
├── open-pr-in-browser -> /home/david/code/dotfiles/bin/run-crystal-program
├── runger-config -> /home/david/code/dotfiles/bin/run-crystal-program
└── unique-union -> /home/david/code/dotfiles/bin/run-crystal-program
```

Here's the script that does it:

```sh
#!/usr/bin/env bash
# file name (available on PATH): symlink-crystal-programs

crystal_programs_source_code_directory="$HOME/code/dotfiles/crystal-programs"
crystal_executable_symlinks_directory="$HOME/bin/crystal-symlinks"

# Delete the symlinks directory, to ensure that there aren't any dangling programs left there.
rm -rf "$crystal_executable_symlinks_directory"

# Recreate the symlinks directory.
mkdir -p "$crystal_executable_symlinks_directory"

for crystal_program_source_file in "$crystal_programs_source_code_directory"/*.cr ; do
  symlink_name=$(basename "$crystal_program_source_file" .cr)
  ln -sf ~/code/dotfiles/bin/run-crystal-program "$crystal_executable_symlinks_directory/$symlink_name"
done
```

The symlinks drop the `.cr` extension. That way, although I write the source code in a file called `unique-union.cr`, I will be able to invoke the compiled program from my command line (or other programs) via simply `unique-union`.

### Part 2: `run-crystal-program`

The final piece of the puzzle is the `run-crystal-program` bash script referenced as the target of the symlinks above. That script does two main things:

1. compiles (or recompiles) the relevant Crystal source code into an executable binary, if no binary has yet been compiled, or if the source code or the `run-crystal-program` script itself has been modified more recently than the binary was compiled
2. executes the compiled binary, forwarding along any arguments

```sh
#!/usr/bin/env bash
# file location: ~/code/dotfiles/bin/run-crystal-program

crystal_compiled_binaries_directory="$HOME/bin/crystal-binaries"

script_name=$(basename "$0")
source_file="$HOME/code/dotfiles/crystal-programs/$script_name.cr"
binary_file="$crystal_compiled_binaries_directory/$script_name"

# Check if the binary doesn't exist, the source file has changed, or this
# compilation script has changed.
if [ ! -f "$binary_file" ] || \
    [ "$source_file" -nt "$binary_file" ] || \
    [ "$(realpath "$0")" -nt "$binary_file" ] ; then
  # Create the compiled binaries directory.
  mkdir -p "$crystal_compiled_binaries_directory"

  # Add shards directory for dotfiles to the CRYSTAL_PATH.
  # More details: https://github.com/davidrunger/dotfiles/commit/d73a9df .
  export CRYSTAL_PATH="$HOME/.shards/dotfiles:$CRYSTAL_PATH"

  # Compile the binary.
  echo "Compiling $source_file ..." >&2
  if ! crystal build --warnings=none "$source_file" -o "$binary_file" ; then
    echo "There was an error compiling $source_file ." >&2
    exit 1
  fi
fi

# Execute the compiled binary, passing along any provided arguments.
"$binary_file" "$@"
```

## Review and overview

This all might seem a little bit complicated, and it is. There are three different directories involved, each with a different purpose:

1. `~/code/dotfiles/crystal-programs/`: This is where the Crystal source code lives, e.g. `~/code/dotfiles/crystal-programs/unique-union.cr`.
2. `~/bin/crystal-symlinks/`: This directory (which is on my `PATH`) contains symlinks, one for each Crystal program. These symlinks all point to the `run-crystal-program` script.
3. `~/bin/crystal-binaries/`: This is where the actual compiled binaries created from the Crystal source code are stored. These compiled binaries will be invoked by `run-crystal-program`.

So, when I invoke `unique-union` from my command line, that refers to the `~/bin/crystal-symlinks/unique-union` file (since `~/bin/crystal-symlinks` is on my path). That file is actually just a symlink to the shell script `~/code/dotfiles/bin/run-crystal-program`, so that is what actually executes when invoking `unique-union`. `run-crystal-program` ensures that there is an up-to-date compiled binary located at `~/bin/crystal-binaries/unique-union`, and then executes that binary, passing along any arguments.

## Downsides

Overall, after ironing out a kink or two, this system seems to work pretty smoothly, but there are some downsides.

One downside is that, after I change any Crystal source file, then the next time that I invoke that command, there is a significant delay (a few seconds), as `run-crystal-program` compiles an up-to-date version of the executable binary. However, thereafter, `run-crystal-program` simply invokes the already-compiled binary, and so the compiled program executes quickly.

Another downside is that, even when an up-to-date binary has already been compiled, this system does waste a little bit of time executing the `run-crystal-program` bash script, which probably adds somewhere on the order of 8 milliseconds or so to the overall execution time. It would be faster if, instead of going through the `run-crystal-program` bash script, calling `unique-union` would directly invoke the compiled Crystal binary. However, then I'd lose the benefit of automatic compilation and the assurance that I'm always running a binary that has been compiled using the latest version of the Crystal source code.

## Summary: I'm happy 🙂

For me, the benefits of this framework outweigh these downsides, and I really enjoy being able to write some of my development tooling programs using Crystal, and then executing the resulting, automatically compiled, quick, and low-memory compiled binaries.
