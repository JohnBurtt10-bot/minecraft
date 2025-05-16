const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const QLearning = require('./qlearning')
const fs = require('fs')

// Bot settings
const RETRY_DELAY = 5000 // 5 seconds between retries
const MAX_RETRIES = 10   // Maximum number of reconnection attempts
let retryCount = 0
let bot = null
let qlearning = null
let lastState = null
let lastAction = null
let isLearning = false

// Reward functions
function calculateReward(bot) {
    let reward = 0
    
    // Base reward for staying alive
    reward += 0.1
    
    // Health-based rewards
    reward += bot.health / 20.0  // 0-1 points for health
    if (bot.health < (lastState ? JSON.parse(lastState).health : 20)) {
        reward -= 2  // Bigger penalty for taking damage
    }
    
    // Movement-based rewards
    const pos = bot.entity.position
    const blockBelow = bot.blockAt(pos.offset(0, -1, 0))
    if (!blockBelow || blockBelow.name === 'air') {
        reward -= 0.5  // Penalty for being above air (dangerous!)
    }
    
    // Block interaction rewards
    const blockAhead = bot.blockAt(pos.offset(1, 0, 0))
    if (lastAction === 'mine' && blockAhead && blockAhead.name !== 'air') {
        reward += 0.3  // Reward for mining when there's actually a block
    }
    if (lastAction === 'place' && bot.inventory.items().length > 0) {
        reward += 0.2  // Reward for placing blocks when we have them
    }
    
    // Exploration rewards
    if (lastState) {
        const lastPos = JSON.parse(lastState).position
        if (lastPos) {
            const distance = Math.sqrt(
                Math.pow(pos.x - lastPos.x, 2) + 
                Math.pow(pos.z - lastPos.z, 2)
            )
            reward += distance * 0.1  // Reward for exploring new areas
        }
    }
    
    // Achievement rewards
    if (bot.food === 20) {
        reward += 0.5  // Reward for being well fed
    }
    if (bot.inventory.items().length > 0) {
        reward += 0.2  // Reward for having items
    }
    
    return reward
}

function performAction(bot, action) {
    switch(action) {
        case 'forward':
            bot.setControlState('forward', true)
            setTimeout(() => bot.setControlState('forward', false), 500)
            break
        case 'back':
            bot.setControlState('back', true)
            setTimeout(() => bot.setControlState('back', false), 500)
            break
        case 'left':
            bot.setControlState('left', true)
            setTimeout(() => bot.setControlState('left', false), 500)
            break
        case 'right':
            bot.setControlState('right', true)
            setTimeout(() => bot.setControlState('right', false), 500)
            break
        case 'jump':
            bot.setControlState('jump', true)
            setTimeout(() => bot.setControlState('jump', false), 500)
            break
        case 'mine':
            const block = bot.blockAt(bot.entity.position.offset(1, 0, 0))
            if (block && block.name !== 'air') {
                bot.dig(block)
            }
            break
        case 'place':
            // Simple block placement - you might want to expand this
            const referenceBlock = bot.blockAt(bot.entity.position.offset(1, -1, 0))
            const faceVector = { x: 0, y: 1, z: 0 }
            if (referenceBlock && bot.inventory.items().length > 0) {
                bot.placeBlock(referenceBlock, faceVector)
            }
            break
    }
}

function createBot() {
  console.log('Attempting to connect to Minecraft server...')
  console.log('Make sure:')
  console.log('1. Minecraft is running')
  console.log('2. A world is loaded')
  console.log('3. The world is open to LAN (Press Escape -> Open to LAN -> Start LAN World)')
  console.log('4. Note the port number shown in chat after opening to LAN')

  if (retryCount >= MAX_RETRIES) {
    console.log('Maximum retry attempts reached. Please:')
    console.log('1. Check if Minecraft is running')
    console.log('2. Verify the world is open to LAN')
    console.log('3. Restart the bot with: npm start')
    process.exit(1)
  }

  retryCount++
  console.log(`Connection attempt ${retryCount}/${MAX_RETRIES}`)

  bot = mineflayer.createBot({
    host: 'localhost',    // minecraft server ip
    username: 'Bot',      // minecraft username
    port: 25565,         // minecraft server port
    version: '1.20.4',   // minecraft version - latest stable version
    checkTimeoutInterval: 60000,  // Increase timeout check interval
    closeTimeout: 240*1000, // Close connection after 4 minutes of failed connection attempts
    keepAlive: true,     // Enable keep-alive packets
    connectTimeout: 30000 // Wait 30 seconds before timing out connection attempt
  })

  // Initialize Q-learning
  if (!qlearning) {
    qlearning = new QLearning()
    // Try to load existing Q-table
    try {
      if (fs.existsSync('qtable.json')) {
        const data = JSON.parse(fs.readFileSync('qtable.json'))
        qlearning.loadQTable(data)
        console.log('Loaded existing Q-table')
      }
    } catch (err) {
      console.log('Starting with fresh Q-table')
    }
  }

  // Initialize pathfinder
  bot.loadPlugin(pathfinder)

  // Log when bot connects
  bot.once('spawn', () => {
    console.log('Success! Bot connected to Minecraft!')
    retryCount = 0 // Reset retry count on successful connection
    bot.chat('Hello! I am a learning bot. Commands: learn, stop, status')
    // Initialize movements
    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)
  })

  // Learning loop
  bot.on('physicsTick', () => {
    if (!isLearning) return

    const currentState = qlearning.getState(bot)
    const reward = lastState ? calculateReward(bot) : 0

    if (lastState && lastAction) {
      qlearning.update(lastState, lastAction, currentState, reward)
    }

    const action = qlearning.chooseAction(currentState)
    performAction(bot, action)

    lastState = currentState
    lastAction = action
  })

  // Better error handling
  bot.on('error', (err) => {
    console.log('Connection error:', err)
    console.log('Error details:', {
      code: err.code,
      syscall: err.syscall,
      address: err.address,
      port: err.port
    })
    // Only attempt to reconnect for certain errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      console.log('Network error - will attempt to reconnect...')
      setTimeout(createBot, RETRY_DELAY)
    }
  })

  bot.on('kicked', (reason, loggedIn) => {
    console.log('Bot was kicked. Reason:', reason)
    if (!loggedIn) {
      console.log('Attempting to reconnect...')
      setTimeout(createBot, RETRY_DELAY)
    }
  })

  bot.on('end', (reason) => {
    console.log('Bot disconnected. Reason:', reason)
    setTimeout(createBot, RETRY_DELAY)
  })

  let following = null

  // Listen for messages
  bot.on('chat', (username, message) => {
    if (username === bot.username) return

    // Commands
    switch(message) {
      case 'learn':
        isLearning = true
        lastState = null
        lastAction = null
        bot.chat('Starting learning mode!')
        break

      case 'stop':
        isLearning = false
        bot.chat('Stopped learning mode')
        // Save Q-table
        fs.writeFileSync('qtable.json', JSON.stringify(qlearning.saveQTable()))
        console.log('Saved Q-table')
        break

      case 'status':
        const state = qlearning.getState(bot)
        bot.chat(`Current state: ${state}`)
        bot.chat(`Learning: ${isLearning}, Epsilon: ${qlearning.epsilon}`)
        break

      case 'come':
        const player = bot.players[username]
        if (!player || !player.entity) {
          bot.chat("I can't see you!")
          return
        }
        bot.chat('Coming to you!')
        const goal = new goals.GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 1)
        bot.pathfinder.setGoal(goal)
        break

      case 'jump':
        bot.setControlState('jump', true)
        setTimeout(() => bot.setControlState('jump', false), 500)
        break
        
      case 'items':
        const items = bot.inventory.items()
        if (items.length === 0) {
          bot.chat('My inventory is empty!')
        } else {
          const itemNames = items.map(item => `${item.count} ${item.name}`).join(', ')
          bot.chat(`My inventory: ${itemNames}`)
        }
        break

      case 'look':
        const target = bot.players[username]
        if (!target || !target.entity) {
          bot.chat("I can't see you!")
          return
        }
        bot.lookAt(target.entity.position.offset(0, target.entity.height, 0))
        break

      case 'follow':
        following = username
        bot.chat(`I will follow ${username}`)
        break

      case 'stop':
        following = null
        bot.pathfinder.setGoal(null)
        bot.chat('Stopped all actions')
        break
    }
  })

  // Following logic
  bot.on('physicsTick', () => {
    if (following) {
      const target = bot.players[following]
      if (target && target.entity) {
        const pos = target.entity.position
        bot.pathfinder.setGoal(new goals.GoalNear(pos.x, pos.y, pos.z, 2))
      }
    }
  })
}

// Start the bot
createBot()

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down bot...')
  if (isLearning) {
    fs.writeFileSync('qtable.json', JSON.stringify(qlearning.saveQTable()))
    console.log('Saved Q-table')
  }
  if (bot) {
    bot.end()
  }
  process.exit()
}) 