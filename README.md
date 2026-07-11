# Cyborg Core: Mission Pinball

A full browser pinball game built with plain HTML, CSS, JavaScript, and Canvas. It is designed to run as a static website on an AWS EC2 `t3.micro` instance using Amazon Linux and Apache.

The design is inspired by classic space-themed computer pinball tables, but all artwork and code are original vector graphics rendered in the browser.

## Features

- 120 Hz fixed-step physics loop for smooth gameplay
- Two responsive flippers
- Dedicated launch lane and charge meter
- Five rollover data gates
- Left and right orbit scoring
- Five pop bumpers
- Central animated reactor
- Stand-up targets, posts, slingshots, inlanes, and outlanes
- Mission progression and score multiplier
- Combo scoring
- Generated Web Audio sound effects with no audio files
- Keyboard and touch controls
- Local high-score saving
- Responsive side mission panel
- EC2 Availability Zone display

## Controls

- `A` or `Left Arrow`: left flipper
- `D` or `Right Arrow`: right flipper
- Hold and release `Space`: charge and launch
- `P`: pause
- `R`: restart

## Repository files

- `index.html` — page structure and mission panel
- `styles.css` — cabinet and interface styling
- `game.js` — gameplay, physics, drawing, missions, and sound
- `user-data.sh` — EC2 startup script that clones this repository and serves it with Apache

## Upload this project to GitHub

Your repository URL should be:

```text
https://github.com/hernandezemliano24/Pinball
```

From the folder containing these files:

```bash
git init
git add .
git commit -m "Add Cyborg Core mission pinball"
git branch -M main
git remote add origin https://github.com/hernandezemliano24/Pinball.git
git push -u origin main
```

If the repository already contains files, clone it first and copy these files into the cloned folder before committing.

## Deploy on EC2

1. Make sure the GitHub repository is public.
2. Launch an Amazon Linux 2023 EC2 instance.
3. Use `user-data.sh` as the instance user data.
4. In the security group, allow inbound TCP port `80` from the desired source.
5. Open the instance Public IPv4 address in a browser using `http://`.

The user-data script installs Git and Apache, clones the `main` branch, places the game in `/var/www/html`, inserts the EC2 Availability Zone, and starts Apache.

## Updating the live game

After pushing new changes to GitHub, connect to the instance and run:

```bash
sudo /usr/local/bin/update-pinball
```

Then refresh the browser. A hard refresh may be needed because browsers cache JavaScript and CSS.

## Troubleshooting

Check Apache:

```bash
sudo systemctl status httpd
```

Check user-data output:

```bash
sudo tail -n 100 /var/log/cloud-init-output.log
```

Check the deployed files:

```bash
ls -la /var/www/html
```

Check the update log:

```bash
sudo cat /var/log/pinball-deploy.log
```


## Geometry fixes in this version

- Dedicated open launch lane that curves into the playfield above the divider.
- Shorter flippers with a real center drain gap.
- Repositioned pink slingshots with clearance from the blue rails.
- Continuous inlanes and outlanes that avoid corner traps.

## Version 3 table fixes

- Shooter lane now bends through an open upper-right entrance into the playfield.
- No blue rail crosses the launch path.
- Pink triangle slingshots were removed.
- Lower side geometry uses continuous funnels with no enclosed pockets.
- Flippers are shorter and farther apart, creating a larger real center drain.
- Added cache-busting query strings so browsers load the newest code after deployment.

## Version 5 shooter-lane redesign

- Replaced the two right-side channels with one single shooter tunnel.
- Removed dark-blue rails from the tunnel entrance.
- Added a strong leftward handoff into the main playfield.
- Removed pink triangle slingshots completely.
- Increased the gap between the flippers.
- Simplified lower geometry to avoid all trap pockets.

## Version 6 definitive shooter fix

- Exactly one shooter tunnel remains.
- A top sensor/kicker guarantees the ball enters the playfield at x=690.
- All dark-blue rails were removed from the shooter mouth.
- Pink triangle slingshots remain completely removed.
- Right-side obstacles were moved away from the entrance.
- Flippers are shorter and farther apart for a larger center drain.
- Lower guides are continuous and contain no closed trap pockets.

## Version 7 final tunnel/flipper restoration

- Right side now uses the cabinet edge as the outer wall and only one inner divider.
- Ball is restored and visibly starts inside the shooter tunnel.
- Both flippers are restored with a wider center drain.
- The shooter exit uses a reliable leftward handoff into the playfield.
- No triangle slingshots or closed corner pockets.

## Version 8 ball and flipper repair

- Restored the missing `drawPosts()` and `drawFlippers()` functions.
- Fixed the JavaScript error that stopped rendering before the ball and flippers.
- Moved the real ball spawn to the center of the single shooter tunnel.
- Preserved the wider center drain between the two flippers.
- Added cache version `v=8`.

## Version 9 smooth shooter exit

- Shooter handoff now happens exactly once per ball.
- Ball launches straight upward with no horizontal drift.
- Ball enters lower in the open playfield instead of beside the top rail.
- Ball receives a downward-left velocity so gravity carries it naturally toward the flippers.
- Upper-right guide collisions are temporarily disabled while the ball clears the exit.
- Added cache version `v=9`.

## Version 10 stable physics

- Removed the artificial anti-stall nudges.
- Reduced gravity and bounce energy for smoother movement.
- Added a hard maximum ball-speed limit.
- Removed the collision code that forced slow balls back to high speed.
- Reduced bumper, reactor, wall, post, and flipper impulses.
- Lowered shooter-entry velocity.
- Added cache version `v=10`.
