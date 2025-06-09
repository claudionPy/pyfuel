#!/bin/bash
set -e

echo "==> INSTALLING DOCKER"
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER

echo "==> INSTALLING DOCKER-COMPOSE PLUGIN"
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-armv7 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose

# Ensure ~/.docker/cli-plugins is on PATH
if [[ ":$PATH:" != *":$HOME/.docker/cli-plugins:"* ]]; then
    echo 'export PATH=$PATH:$HOME/.docker/cli-plugins' >> ~/.bashrc
    export PATH=$PATH:$HOME/.docker/cli-plugins
fi

echo "==> APPLYING docker group WITHOUT LOGOUT"
newgrp docker <<EONG
echo "==> DOCKER AND COMPOSE INSTALLED SUCCESSFULLY"
docker version
docker compose version
EONG

cd ~
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
sudo tee /etc/systemd/system/pyfuel-docker.service > /dev/null <<EOF
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
sudo systemctl enable pyfuel-docker.service
sudo systemctl start pyfuel-docker.service

echo "==> INSTALLING PIGPIO DAEMON"
sudo apt-get update
sudo apt-get install -y --no-install-recommends xserver-xorg xinit openbox x11-utils python3-tk python3-pip python3-venv pigpio
echo "==> CREATING PYTHON VENV AND INSTALLING DEPENDENCIES"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

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
