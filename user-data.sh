#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/hernandezemliano24/Pinball.git"
BRANCH="main"
APP_DIR="/opt/pinball"
WEB_ROOT="/var/www/html"
LOG="/var/log/pinball-deploy.log"

exec > >(tee -a "$LOG") 2>&1

if command -v dnf >/dev/null 2>&1; then
  dnf install -y httpd git
else
  yum install -y httpd git
fi

systemctl enable --now httpd

rm -rf "$APP_DIR"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"

rm -rf "${WEB_ROOT:?}/"*
cp -a "$APP_DIR"/. "$WEB_ROOT"/
rm -rf "$WEB_ROOT/.git"

TOKEN="$(curl -fsS --connect-timeout 2 -X PUT \
  http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600' || true)"

AZ="Unavailable"
if [ -n "$TOKEN" ]; then
  AZ="$(curl -fsS --connect-timeout 2 \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/availability-zone || echo Unavailable)"
fi

sed -i "s/__AZ__/${AZ}/g" "$WEB_ROOT/index.html"

chown -R apache:apache "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

cat >/usr/local/bin/update-pinball <<'UPDATE'
#!/bin/bash
set -euo pipefail
REPO_URL="https://github.com/hernandezemliano24/Pinball.git"
BRANCH="main"
TMP_DIR="$(mktemp -d)"
WEB_ROOT="/var/www/html"
trap 'rm -rf "$TMP_DIR"' EXIT

git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP_DIR/repo"

TOKEN="$(curl -fsS --connect-timeout 2 -X PUT \
  http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600' || true)"

AZ="Unavailable"
if [ -n "$TOKEN" ]; then
  AZ="$(curl -fsS --connect-timeout 2 \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/availability-zone || echo Unavailable)"
fi

rm -rf "${WEB_ROOT:?}/"*
cp -a "$TMP_DIR/repo"/. "$WEB_ROOT"/
rm -rf "$WEB_ROOT/.git"
sed -i "s/__AZ__/${AZ}/g" "$WEB_ROOT/index.html"

chown -R apache:apache "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

systemctl restart httpd
echo "Pinball updated."
UPDATE

chmod 755 /usr/local/bin/update-pinball
systemctl restart httpd
echo "Cyber Pinball Arena deployed in ${AZ}"
