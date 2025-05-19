#!/bin/bash

# Check if test mode is requested
TEST_MODE=false
if [ "$1" = "test" ]; then
    TEST_MODE=true
    echo "Starting server in TEST MODE - Flat world with single bot"
    # Delete existing world for fresh flat world
    echo "Deleting existing world for fresh flat world..."
    rm -rf world/
    
    # Create test server.properties
    cat > server.properties << EOL
spawn-protection=0
max-tick-time=60000
query.port=25565
generator-settings={}
sync-chunk-writes=true
force-gamemode=false
allow-nether=false
enforce-whitelist=false
gamemode=survival
broadcast-console-to-ops=true
enable-query=false
player-idle-timeout=0
difficulty=peaceful
spawn-monsters=true
broadcast-rcon-to-ops=true
op-permission-level=4
pvp=true
entity-broadcast-range-percentage=100
snooper-enabled=true
level-type=flat
hardcore=false
enable-status=true
enable-command-block=true
max-players=10
network-compression-threshold=512
resource-pack-sha1=
max-world-size=29999984
function-permission-level=2
rcon.port=25575
server-port=25565
debug=false
server-ip=
spawn-npcs=true
allow-flight=true
level-name=world
view-distance=4
resource-pack=
spawn-animals=true
white-list=false
rcon.password=minecraft
generate-structures=true
online-mode=false
max-build-height=256
level-seed=
prevent-proxy-connections=false
use-native-transport=true
enable-jmx-monitoring=false
motd=A Minecraft Server
rate-limit=0
enable-rcon=true
EOL
else
    # Create normal server.properties
    echo "Creating normal world server properties..."
    cat > server.properties << EOL
spawn-protection=0
max-tick-time=60000
query.port=25565
generator-settings={}
sync-chunk-writes=true
force-gamemode=false
allow-nether=true
enforce-whitelist=false
gamemode=survival
broadcast-console-to-ops=true
enable-query=false
player-idle-timeout=0
difficulty=hard
spawn-monsters=true
broadcast-rcon-to-ops=true
op-permission-level=4
pvp=true
entity-broadcast-range-percentage=100
snooper-enabled=true
level-type=normal
level-seed=123456789
hardcore=false
enable-status=true
enable-command-block=true
max-players=20
network-compression-threshold=256
resource-pack-sha1=
max-world-size=29999984
function-permission-level=2
rcon.port=25575
server-port=25565
debug=false
server-ip=
spawn-npcs=true
allow-flight=false
level-name=world
view-distance=10
resource-pack=
spawn-animals=true
white-list=false
rcon.password=minecraft
generate-structures=true
online-mode=false
max-build-height=256
level-seed=
prevent-proxy-connections=false
use-native-transport=true
enable-jmx-monitoring=false
motd=A Minecraft Server
rate-limit=0
enable-rcon=true
EOL
fi

# Kill any existing Java processes (Minecraft server)
pkill -f "java.*server.jar" || true

# Wait a moment to ensure the server is fully stopped
sleep 2

# Start the server
echo "Starting Minecraft server..."
java -Xmx10G -Xms10G -jar server.jar nogui &

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# If in test mode, start a single bot
if [ "$TEST_MODE" = true ]; then
    echo "Starting single bot in test mode..."
    # Create a temporary config for single bot
    echo '{"numBots": 1}' > config.json
    # Start the bot
    npm start
else
    # Normal mode - start with default config
    echo "Server started in normal mode. Use 'npm start' to start bots when ready."
fi