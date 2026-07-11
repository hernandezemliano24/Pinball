# Cyber Pinball Arena

This version removes the shooter tunnel completely. The entire table is now the playing field, so the ball no longer enters a repeated scripted area.

## Features

- Open-field layout
- No shooter tunnel
- Randomized launch angle
- Solid wall collision with substeps
- Speed clamp to prevent the ball from flying off-screen
- Bumpers, targets, lanes, posts, slingshots, and flippers
- Larger gap between the flippers
- Touch and keyboard controls
- Saved high score
- EC2 Availability Zone display

## Controls

- `Space`: hold and release to launch
- `A` or `Left Arrow`: left flipper
- `D` or `Right Arrow`: right flipper
- `R`: restart
- `P`: pause

## Deploy on EC2

Use `user-data.sh` when launching an Amazon Linux EC2 instance. The script clones:

```text
https://github.com/hernandezemliano24/Pinball.git
```

After pushing updates to GitHub, update the running instance with:

```bash
sudo /usr/local/bin/update-pinball
```
