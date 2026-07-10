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
