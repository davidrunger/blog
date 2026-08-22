---
title: Using VS Code as a Rails app:update merge tool
image: https://david-runger-public-uploads.s3.amazonaws.com/app-upate-vs-code-three-way-merge.png
---

When upgrading Rails, you should run [`bin/rails app:update`](https://guides.rubyonrails.org/upgrading_ruby_on_rails.html#the-update-task). The command compares your application's configuration files with those that the new Rails version would generate, then asks how to resolve each difference:

```
❯ bin/rails app:update
    conflict  config/boot.rb
Overwrite /home/david/code/david_runger/config/boot.rb? (enter "h" for help) [Ynaqdhm]
```

Entering `h` explains the available options:

```
Y - yes, overwrite
n - no, do not overwrite
a - all, overwrite this and all others
q - quit, abort
h - help, show this help
d - diff, show the differences between the old and the new
m - merge, run merge tool
```

Overwriting (`Y`) can discard application-specific configuration, while declining (`n`) can miss relevant changes from the new Rails version. A three-way merge (`m`) makes it easier to preserve your configuration while incorporating new defaults.

Without a configured merge tool, however, choosing `m` produces an error:

```
Overwrite /home/david/code/david_runger/config/boot.rb? (enter "h" for help) [Ynaqdhm] m
Please specify merge tool to `THOR_MERGE` env.
Overwrite /home/david/code/david_runger/config/boot.rb? (enter "h" for help) [Ynaqdhm]
```

Here is how to use VS Code as that merge tool.

## Create a VS Code adapter

For each conflict, Rails's underlying Thor library passes `THOR_MERGE` two paths: a temporary file containing the new Rails default and the application's existing file.

VS Code's [`--merge` option](https://code.visualstudio.com/docs/configure/command-line#_core-cli-options) instead expects four paths:

```
code --merge <path1> <path2> <base> <result>
```

An adapter script can supply the two additional paths. Open a new script in VS Code, then make it executable after you save and close it:

```sh
code --wait bin/app_update_thor_merge_tool
chmod +x bin/app_update_thor_merge_tool
```

Paste this into the script:

```sh
#!/usr/bin/env bash

rails_default_config=$1
app_current_config=$2

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

current_copy="$temporary_directory/current"
base_copy="$temporary_directory/base"

cp "$app_current_config" "$current_copy"
cp "$app_current_config" "$base_copy"

code --merge \
  "$rails_default_config" \
  "$current_copy" \
  "$base_copy" \
  "$app_current_config" \
  --wait
```

Then run `app:update` with the script's absolute path in `THOR_MERGE`:

```sh
THOR_MERGE="$(pwd)/bin/app_update_thor_merge_tool" bin/rails app:update
```

When you choose `m` for a conflict, VS Code opens its three-way merge editor:

![app:update VS Code three-way merge](https://david-runger-public-uploads.s3.amazonaws.com/app-upate-vs-code-three-way-merge.png)

The left pane contains the new Rails default, the right pane contains your application's current configuration, and the center pane contains the result. Review the relevant Rails documentation, resolve the differences, save the result, and close the tab. Because the adapter passes `--wait`, `app:update` will then advance to the next file.

Repeat until you have reviewed every conflict.
