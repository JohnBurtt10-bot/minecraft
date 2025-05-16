const { SurvivalBot } = require('./survivalTeam')
const fs = require('fs')

// Create learning bots
const bots = [
    new SurvivalBot('Learner1'),
    new SurvivalBot('Learner2'),
    new SurvivalBot('Learner3')
]

console.log('Starting learning bots...')
console.log('Make sure:')
console.log('1. Minecraft is running')
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

// Connect bots with delay
bots.forEach((bot, index) => {
    setTimeout(() => {
        bot.connect()
    }, index * 2000)
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