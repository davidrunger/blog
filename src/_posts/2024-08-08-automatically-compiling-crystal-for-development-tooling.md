---
title: Automatically compiling Crystal for development tooling
subtitle: The ease and beauty of Ruby, with the speed of C.
image: https://david-runger-public-uploads.s3.amazonaws.com/crystal-logo-stacked.png
---

## Why Crystal?

I write many small command-line tools for my own development workflow. For example, my `gform` command fetches a Git repository and rebases the current branch onto the updated `main` branch. It also runs `install-packages-in-background`, another tool that checks dependency lock files and installs any changed dependencies in the background.

Most of my small tools are bash scripts. Bash starts quickly:

```console
❯ time bash -c 'echo "Hi!"'
Hi!
bash -c 'echo "Hi!"'  0.00s user 0.00s system 89% cpu 0.006 total
```

Bash becomes unpleasant for more complicated logic, though, and it lacks a package ecosystem comparable to those of many general-purpose languages. Ruby and Node are more expressive, but their startup time is noticeable for frequently invoked tools. On my machine, even minimal programs took about 130 milliseconds with Ruby and 200 milliseconds with Node.

I also tried Lua, which starts as quickly as bash and has a package manager, but its limited standard library left me implementing basic functionality that I expected the language to provide.

A compiled language offered fast programs and richer language features, but introduced a different inconvenience: I would need to recompile each tool after changing its source and make the resulting binary available on my `PATH`.

ChatGPT and I devised a setup that handles both tasks automatically. Although I use it with Crystal, the same approach should work with other compiled languages such as Rust or Go.

## Why I chose Crystal

![Crystal logo](https://david-runger-public-uploads.s3.amazonaws.com/crystal.png)

**[Crystal](https://crystal-lang.org/)** is a compiled, statically typed language with Ruby-inspired syntax. Its type inference means that explicit type annotations are often unnecessary, while its compiler produces efficient native programs.

I also appreciate Crystal's clear compiler errors and approachable [documentation][crystal-docs]. It gives me much of what I enjoy about writing Ruby while producing fast, memory-efficient executables.

[crystal-docs]: https://crystal-lang.org/reference/latest/

## Example: my `unique-union` program

As an example, my `unique-union` program combines the words in two arguments, removes duplicates, and sorts the result:

```
❯ unique-union "wave hello bye" "hello ocean wave"
bye
hello
ocean
wave
```

I use this small program as a building block in another tool.

Here is its Crystal source:

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

Two shell scripts make the source available as a command and compile it when necessary.

### Part 1: `symlink-crystal-programs`

My `~/.zshrc` runs `symlink-crystal-programs` in the background whenever I open a terminal:

```sh
# Set up (in the background) symlinks for programs written in Crystal
{ ( symlink-crystal-programs >&3 & ) } 3>&1
```

The surrounding shell syntax preserves standard output while letting the script run asynchronously, so it does not delay shell startup.

The script recreates a directory of extensionless symlinks, one for each `.cr` source file. That directory is on my `PATH`, and every symlink points to the same `run-crystal-program` script:

```console
❯ tree ~/bin/crystal-symlinks
/home/david/bin/crystal-symlinks
├── install-packages-in-background -> /home/david/code/dotfiles/bin/run-crystal-program
├── open-pr-in-browser -> /home/david/code/dotfiles/bin/run-crystal-program
├── runger-config -> /home/david/code/dotfiles/bin/run-crystal-program
└── unique-union -> /home/david/code/dotfiles/bin/run-crystal-program
```

Here is `symlink-crystal-programs`:

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

Dropping the `.cr` extension lets me invoke `unique-union.cr` as simply `unique-union`.

### Part 2: `run-crystal-program`

The shared `run-crystal-program` script:

1. Compiles the relevant Crystal source if the binary does not exist or is older than either the source or this runner.
2. Executes the binary with the supplied arguments.

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

## How the pieces fit together

The setup uses three directories:

1. `~/code/dotfiles/crystal-programs/` stores the Crystal source.
2. `~/bin/crystal-symlinks/`, which is on my `PATH`, stores a symlink for each program.
3. `~/bin/crystal-binaries/` stores the compiled executables.

Invoking `unique-union` resolves to `~/bin/crystal-symlinks/unique-union`, which runs `run-crystal-program`. The runner derives the source and binary paths from the invoked name, compiles an up-to-date binary if needed, and executes it.

## Downsides

The first invocation after a source change pauses for a few seconds while `run-crystal-program` compiles the executable. Later invocations reuse that binary and are fast.

Even with a current binary, the runner adds roughly eight milliseconds of shell overhead. Pointing each command directly to its binary would avoid that cost, but would also sacrifice automatic compilation.

## Conclusion

For me, those costs are worthwhile: I can write development tools in Crystal and run current, compiled versions without a manual build step.
