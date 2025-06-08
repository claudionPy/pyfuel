#!/bin/bash
set -e

echo "==> INITIALIZING DOCKER AND DOCKER-COMPOSE"
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

echo "==> INSTALLING DOCKER-COMPOSE PLUGIN"
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose

echo "==> CLONING FILES FROM GIT REPOSITORY"
cd ~
git clone https://github.com/claudionPy/ObjorFuel---py.git
cd pyfuel

echo "==> CREATING FILE .env"
cat > .env <<EOF
POSTGRES_USER=pyfuel
POSTGRES_PASSWORD=securepassword
POSTGRES_DB=pyfueldb
EOF

echo "==> BUILDING AND STARTING CONTAINER"
docker compose build
docker compose up -d

echo "==> CREATING SYSTEMD SERVICE FOR DOCKER"
sudo tee /etc/systemd/system/objorfuel.service > /dev/null <<EOF
[Unit]
Description=PyFuelDocker Compose stack
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/$USER/pyfuel
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable objorfuel.service
sudo systemctl start objorfuel.service

echo "==> INSTALLING PIGPIO DAEMON"
sudo apt-get update
sudo apt-get install --no-install-recommends xserver-xorg xinit openbox x11-utils python3-tk python3-pip pigpio
pip3 install --user -r requirements.txt

sudo systemctl enable pigpiod
sudo systemctl start pigpiod

echo "==> CONFIGURING AUTOMATIC STTART OF PYFUEL (GUI)"
cat > ~/.xinitrc <<EOF
#!/bin/sh
xset -dpms
xset s off
xset s noblank
unclutter -idle 0.1 &

set -a
. /home/pyuser/pyfuel/.env
set +a

export DB_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}

cd /home/pyuser/pyfuel

exec python3 -m src.controller
EOF
chmod +x ~/.xinitrc

if ! grep -q "startx" ~/.bashrc; then
  cat >> ~/.bashrc <<'EOF'

if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx
fi
EOF
fi

echo "==> INSTALLATION COMPLETE: please reboot the system"

