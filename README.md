# Minecraft Learning Bot

## Live Bot Progress

Below is a live-updated graph of the bot's survival stats (updated every 50 seconds):

<img src="http://15.156.77.30:3000/graph" alt="Live Bot Survival Graph" width="800" height="400" />

Below is a live-updated view of the survival stats (updated every 50 seconds):

<iframe src="http://15.156.77.30:3000/stats" width="800" height="400" frameborder="0" scrolling="no" title="Live Survival Stats"></iframe>

A reinforcement learning bot that learns to survive in Minecraft through trial and error using Q-learning.

## Overview

This project implements a Q-learning agent that learns to survive in Minecraft by:
- Observing its environment (health, nearby entities, blocks, etc.)
- Taking actions (movement, jumping, interaction)
- Learning from rewards (health changes, survival time)
- Building a Q-table of state-action values

## Features

- **State Representation**: The bot observes:
  - Health and food levels
  - Nearby entities (up to 5 closest, including type, distance, and hostility)
  - Block information (what's below and in front)
  - Environmental conditions (water, lava, fire, rain, time of day)
  - Movement state (falling, sprinting, sneaking)

- **Actions**: The bot can:
  - Move (forward, back, left, right)
  - Jump
  - Interact (click)

- **Learning**:
  - Uses Q-learning algorithm
  - Epsilon-greedy exploration strategy
  - Saves and loads Q-tables between sessions
  - Tracks survival statistics and generates graphs

## Setup

1. **Prerequisites**:
   - Node.js (v14 or higher)
   - Java 17 or higher
   - Minecraft server jar (1.20.2)

2. **Installation**:
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd minecraft-learning-bot

   # Install dependencies
   npm install

   # Place your Minecraft server.jar in the project root
   # Accept the EULA
   echo "eula=true" > eula.txt
   ```

3. **Configuration**:
   - Edit `config.json` to set the number of bots
   - Server settings can be modified in `server.properties`
   - Use `start_server.sh test` for a flat world with one bot
   - Use `start_server.sh` for normal world generation

## Usage

1. **Start the server**:
   ```bash
   # Normal mode (default world)
   ./start_server.sh

   # Test mode (flat world, single bot)
   ./start_server.sh test
   ```

2. **Start the bots**:
   ```bash
   npm start
   ```

3. **Monitor learning**:
   - Check `survival_stats.json` for survival statistics
   - View `survival_graph.svg` for visual representation of learning progress
   - Q-tables are saved in `stats/qtable_<botname>_<timestamp>.json`

## Project Structure

- `qlearning.js`: Core Q-learning implementation
- `survivalTeam.js`: Bot behavior and state management
- `statsTracker.js`: Statistics tracking and visualization
- `index.js`: Bot initialization and server connection
- `start_server.sh`: Server startup script

## Learning Process

The bot learns through:
1. **State Observation**: Gathering information about its environment
2. **Action Selection**: Using epsilon-greedy policy to choose actions
3. **Reward Calculation**: Based on health changes and survival
4. **Q-Value Updates**: Using the Q-learning formula to update state-action values

## Learning Progress

### Achievements
Despite having a simple reward system based only on health changes, the bot has demonstrated impressive learning capabilities:

1. **Combat Awareness**:
   - Learned to identify and track hostile entities (slimes, zombies, etc.)
   - Developed strategies to maintain safe distances from threats
   - Successfully evades attacks by moving away when health is low

2. **Tactical Decision Making**:
   - Learned when to engage (attack) versus when to retreat
   - Developed an understanding of entity distances and their impact on health
   - Shows improved survival times as learning progresses

3. **State Understanding**:
   - Bot only has access to its current state (health, nearby entities, etc.)
   - No explicit "rules" or heuristics were programmed
   - All behaviors emerged purely through reinforcement learning

### Video Demonstration
A video demonstration of the bot's learning in a testing environment can be seen here:
[Bot Learning Progress Video](https://github.com/user-attachments/assets/0215b804-2abe-4955-9b24-57961aec5cf5)


The video shows the bot:
- Identify and respond to threats
- Successfully evading and engaging with hostile entities

### Future Improvements
While the current implementation shows promising results, potential improvements include:
- Adding rewards for successful attacks
- Incorporating food/health management
- Expanding the state space to include more environmental factors
- Implementing more sophisticated action sequences

## Monitoring Bot Progress

### Real-time Stats Server
The project includes a real-time stats server that allows you to monitor the bots' learning progress through a web interface. The server provides:

- Live updates of survival statistics
- Real-time visualization of the learning graph
- Connection status indicator
- Accessible from any web browser

#### Starting the Stats Server
```bash
# Start the stats server in a tmux session
tmux new-session -d -s stats-server && tmux send-keys -t stats-server 'node stats_server.js' C-m

# View the server output
tmux attach-session -t stats-server
```

#### Accessing the Stats
1. The stats server runs on port 3000
2. Access the web interface using your AWS instance's public IP:
   ```
   http://<your-aws-ip>:3000
   ```
3. To find your AWS instance's public IP:
   ```bash
   curl http://169.254.169.254/latest/meta-data/public-ipv4
   ```

#### Features
- **Live Updates**: Stats and graph update automatically when changes occur
- **Connection Status**: Visual indicator shows connection state
- **Responsive Design**: Works on desktop and mobile browsers
- **CORS Enabled**: Can be embedded in other web applications

### Stats Files
The following files are monitored and displayed by the stats server:
- `survival_stats.json`: Contains current survival statistics
- `survival_graph.svg`: Visual representation of learning progress

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Uses [mineflayer](https://github.com/PrismarineJS/mineflayer) for Minecraft bot API
- Inspired by reinforcement learning research in game environments 
