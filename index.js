const { SurvivalBot } = require('./survivalTeam')
const fs = require('fs')
const path = require('path')

// Function to check if server is ready
function isServerReady() {
    if (!fs.existsSync('server.log')) {
        console.log('Server log file not found')
        return false
    }
    
    try {
        const logContent = fs.readFileSync('server.log', 'utf8')
        const hasDone = logContent.includes('Done!')
        const hasRCON = logContent.includes('RCON running on')
        const hasPreparing = logContent.includes('Preparing spawn area')
        const hasStarting = logContent.includes('Starting minecraft server')
        const hasError = logContent.includes('ERROR')
        
        console.log('Server status check:')
        console.log('- Done message:', hasDone)
        console.log('- RCON running:', hasRCON)
        console.log('- Preparing area:', hasPreparing)
        console.log('- Starting server:', hasStarting)
        console.log('- Has errors:', hasError)
        
        // Only require Done! and RCON running, ignore other conditions
        return hasDone && hasRCON
    } catch (err) {
        console.log('Error reading server log:', err.message)
        return false
    }
}

// Function to wait for server with timeout
async function waitForServer(timeout = 180000) { // 3 minutes timeout
    const startTime = Date.now()
    const checkInterval = 2000 // Check every 2 seconds
    
    while (Date.now() - startTime < timeout) {
        if (isServerReady()) {
            console.log('Server is ready!')
            return true
        }
        
        console.log('Waiting for server to be ready...')
        await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    console.log('Timeout waiting for server to be ready')
    return false
}

// Create learning bots
let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (err) {
    console.log('Error reading config.json, using default of 3 bots');
    config = { numBots: 3 };
}

const bots = Array.from({ length: config.numBots }, (_, i) => 
    new SurvivalBot(`Learner${i + 1}`)
);

console.log(`Starting ${config.numBots} learning bots...`)
console.log('Make sure:')
console.log('1. Minecraft server is running')
console.log('2. A world is loaded in Hard mode')
console.log('3. The world is open to LAN (Press Escape -> Open to LAN -> Start LAN World)')
console.log('4. Cheats are enabled for world resets')
console.log('\nBots will:')
console.log('- Learn from scratch through trial and error')
console.log('- Reset world and stats will be tracked after each death')
console.log('- Generate survival time graphs (survival_graph.svg)')
console.log('- Save detailed statistics (survival_stats.json)')

// Create stats directory if it doesn't exist
if (!fs.existsSync('./stats')) {
    fs.mkdirSync('./stats')
}

// Wait for server and then connect bots
async function startBots() {
    console.log('Connecting bots immediately...')
    
    // Connect bots with delay
    bots.forEach((bot, index) => {
        setTimeout(() => {
            console.log(`Connecting ${bot.username}...`)
            bot.connect()
        }, index * 2000)
    })
}

// Start the bots
startBots().catch(err => {
    console.error('Error starting bots:', err)
    process.exit(1)
})

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down bots and saving final stats...')
    bots.forEach(bot => {
        if (bot.bot) {
            // Generate final graphs
            bot.stats.generateGithubGraph()
            // Save final Q-table
            fs.writeFileSync(
                `./stats/qtable_${bot.username}_final.json`,
                JSON.stringify(bot.qlearning.saveQTable())
            )
            bot.bot.end()
        }
    })
    process.exit()
}) 