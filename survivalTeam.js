const mineflayer = require('mineflayer')
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const QLearning = require('./qlearning')
const StatsTracker = require('./statsTracker')

class SurvivalBot {
    constructor(username) {
        this.username = username
        this.bot = null
        this.qlearning = new QLearning()
        this.stats = new StatsTracker()
        this.lastState = null
        this.lastAction = null
        this.currentEpisode = 0
        this.episodeSteps = 0
        this.maxEpisodeSteps = 2000
        this.learningInterval = null
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
    }

    connect() {
        if (this.isConnecting) return
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`${this.username} exceeded max reconnection attempts. Stopping.`)
            return
        }

        this.isConnecting = true
        this.reconnectAttempts++

        if (this.bot) {
            try {
                this.bot.end()
            } catch (err) {
                // Ignore end errors
            }
            this.bot = null
        }

        console.log(`${this.username} attempting connection (attempt ${this.reconnectAttempts})...`)

        this.bot = mineflayer.createBot({
            host: 'localhost',
            username: this.username,
            port: 25565,
            version: '1.20.4',
            checkTimeoutInterval: 60000,
            closeTimeout: 240*1000,
            keepAlive: true,
            connectTimeout: 30000
        })

        // Load pathfinder plugin right after bot creation
        this.bot.loadPlugin(pathfinder)
        
        this.bot.setMaxListeners(20)
        this.setupBot()
    }

    setupBot() {
        this.bot.once('spawn', () => {
            console.log(`${this.username} has spawned! Starting from zero...`)
            this.isConnecting = false
            this.reconnectAttempts = 0
            
            const mcData = require('minecraft-data')(this.bot.version)
            const movements = new Movements(this.bot, mcData)
            this.bot.pathfinder.setMovements(movements)
            
            // Small delay before starting to ensure world is loaded
            setTimeout(() => {
                this.startLearning()
                this.stats.startLife()
            }, 1000)
        })

        this.bot.on('death', () => {
            if (!this.bot.entity) return
            const survivalTime = this.stats.endLife()
            console.log(`${this.username} died. Survived for ${survivalTime.toFixed(1)} seconds.`)
            this.stats.generateGithubGraph()
            this.endEpisode()
            this.resetWorld()
        })

        this.bot.on('end', () => {
            console.log(`${this.username} disconnected. Cleaning up...`)
            this.endEpisode()
            this.isConnecting = false
            
            // Only attempt reconnect if we haven't exceeded max attempts
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log(`${this.username} scheduling reconnection...`)
                setTimeout(() => this.connect(), 5000)
            }
        })

        this.bot.on('error', (err) => {
            console.log(`${this.username} error:`, err.message || err)
            this.endEpisode()
            this.isConnecting = false
        })

        // Add kicked handler
        this.bot.on('kicked', (reason) => {
            console.log(`${this.username} was kicked. Reason:`, reason)
            this.endEpisode()
            this.isConnecting = false
        })
    }

    startLearning() {
        this.endEpisode() // Clear any existing interval
        
        this.currentEpisode++
        this.episodeSteps = 0
        this.lastState = null
        this.lastAction = null
        this.learningInterval = setInterval(() => {
            if (this.bot && this.bot.entity) {
                this.learningStep()
            } else {
                this.endEpisode()
            }
        }, 50)
    }

    async learningStep() {
        if (!this.bot || !this.bot.entity) {
            this.endEpisode()
            return
        }

        this.episodeSteps++
        
        const currentState = this.qlearning.getState(this.bot)
        
        if (this.lastState && this.lastAction) {
            const reward = this.qlearning.calculateReward(
                this.bot,
                this.lastState,
                this.lastAction,
                currentState
            )
            this.qlearning.update(this.lastState, this.lastAction, currentState, reward)
        }

        const action = this.qlearning.chooseAction(currentState)
        await this.executeAction(action)
        
        this.lastState = currentState
        this.lastAction = action

        if (this.episodeSteps >= this.maxEpisodeSteps) {
            const survivalTime = this.stats.endLife()
            console.log(`${this.username} Episode ${this.currentEpisode} completed. Survived for ${survivalTime.toFixed(1)} seconds.`)
            this.stats.generateGithubGraph()
            this.endEpisode()
            this.resetWorld()
        }
    }

    async executeAction(action) {
        try {
            switch(action) {
                case 'forward':
                    this.bot.setControlState('forward', true)
                    await this.bot.waitForTicks(5)
                    this.bot.setControlState('forward', false)
                    break
                case 'back':
                    this.bot.setControlState('back', true)
                    await this.bot.waitForTicks(5)
                    this.bot.setControlState('back', false)
                    break
                case 'left':
                    this.bot.setControlState('left', true)
                    await this.bot.waitForTicks(5)
                    this.bot.setControlState('left', false)
                    break
                case 'right':
                    this.bot.setControlState('right', true)
                    await this.bot.waitForTicks(5)
                    this.bot.setControlState('right', false)
                    break
                case 'jump':
                    this.bot.setControlState('jump', true)
                    await this.bot.waitForTicks(5)
                    this.bot.setControlState('jump', false)
                    break
                case 'click':
                    // Enhanced safety checks for clicking/attacking
                    const target = this.bot.blockAtCursor(4)
                    if (target) {
                        // If we see a block, try to break it
                        try {
                            await this.bot.dig(target)
                        } catch (err) {
                            // Ignore dig errors - block might be unbreakable or already broken
                        }
                    } else {
                        // Only attack if we have a valid entity target
                        const entity = this.bot.nearestEntity(e => {
                            // Only target hostile mobs and animals
                            return (
                                e && // entity exists
                                e.type === 'mob' && // is a mob
                                e.position && // has a position
                                e.velocity && // has velocity (is active)
                                e !== this.bot.entity && // is not self
                                this.bot.entity.position.distanceTo(e.position) < 4 // within range
                            )
                        })
                        
                        if (entity) {
                            try {
                                // Look at entity before attacking
                                await this.bot.lookAt(entity.position.offset(0, entity.height * 0.5, 0))
                                await this.bot.waitForTicks(1) // Small delay to ensure look completed
                                
                                // Only attack if entity is still valid and in range
                                if (entity.isValid && this.bot.entity.position.distanceTo(entity.position) < 4) {
                                    await this.bot.attack(entity)
                                }
                            } catch (err) {
                                // Ignore attack errors - entity might have died or moved
                            }
                        }
                    }
                    break
            }
        } catch (err) {
            // Log any unexpected errors but don't crash
            console.log(`${this.username} action error:`, err.message || err)
        }
    }

    endEpisode() {
        if (this.learningInterval) {
            clearInterval(this.learningInterval)
            this.learningInterval = null
        }
        
        if (this.currentEpisode % 10 === 0) {
            const fs = require('fs')
            try {
                fs.writeFileSync(
                    `qtable_${this.username}_${this.currentEpisode}.json`,
                    JSON.stringify(this.qlearning.saveQTable())
                )
            } catch (err) {
                console.log(`${this.username} error saving Q-table:`, err.message || err)
            }
        }
    }

    async resetWorld() {
        try {
            // On death/reset, just reconnect to get a fresh spawn
            console.log(`${this.username} resetting through reconnection...`)
            
            // End current connection
            if (this.bot) {
                this.bot.end()
            }
            
            // Small delay before reconnecting
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Reset connection attempts since this is an intentional reset
            this.reconnectAttempts = 0
            
            // Reconnect to get a fresh spawn
            this.connect()
            
        } catch (err) {
            console.log(`${this.username} error resetting world:`, err.message || err)
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => this.resetWorld(), 5000)
            }
        }
    }
}

module.exports = { SurvivalBot } 