const mineflayer = require('mineflayer')
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const QLearning = require('./qlearning')
const StatsTracker = require('./statsTracker')
const config = require('./config.json')

class SurvivalBot {
    constructor(username) {
        this.username = username + '_' + Math.floor(Math.random() * 1000) // Add random suffix to prevent duplicate logins
        this.bot = null
        this.qlearning = new QLearning()
        this.stats = new StatsTracker()
        this.lastState = null
        this.lastAction = null
        this.currentEpisode = 0
        this.episodeSteps = 0
        this.learningInterval = null
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.isInitialized = false
    }

    connect() {
        if (this.isConnecting) {
            console.log(`${this.username} already connecting, skipping...`)
            return
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`${this.username} exceeded max reconnection attempts. Stopping.`)
            return
        }

        this.isConnecting = true
        this.reconnectAttempts++
        this.isInitialized = false

        if (this.bot) {
            try {
                this.bot.end()
                this.bot = null
            } catch (err) {
                // Ignore end errors
            }
        }

        // Add delay based on reconnect attempts and bot name to stagger connections
        const baseDelay = parseInt(this.username.replace(/Learner(\d+)_.+/, '$1')) * 5000
        const reconnectDelay = this.reconnectAttempts * 2000
        const delay = baseDelay + reconnectDelay
        
        setTimeout(() => {
            console.log(`${this.username} attempting connection (attempt ${this.reconnectAttempts})...`)

            this.bot = mineflayer.createBot({
                host: 'localhost',
                username: this.username,
                port: 25565,
                version: '1.20.2',
                checkTimeoutInterval: 60000,
                closeTimeout: 240*1000,
                keepAlive: true,
                connectTimeout: 30000
            })

            // Load pathfinder plugin right after bot creation
            this.bot.loadPlugin(pathfinder)
            
            this.bot.setMaxListeners(20)
            this.setupBot()
        }, delay)
    }

    setupBot() {
        this.bot.on('spawn', () => {
            console.log(`${this.username} has spawned!`)
            this.isConnecting = false
            this.reconnectAttempts = 0
            
            const mcData = require('minecraft-data')(this.bot.version)
            const movements = new Movements(this.bot, mcData)
            this.bot.pathfinder.setMovements(movements)
            
            // Only reset movement-related state, not learning state
            this.lastState = null
            this.lastAction = null
            
            // Wait a bit longer after respawn before starting movement
            setTimeout(() => {
                this.isInitialized = true
                // Only start learning if it's not already running
                if (!this.learningInterval) {
                    this.startLearning()
                }
                this.stats.startLife()
                console.log(`${this.username} ready to move after respawn`)
            }, 5000)
        })

        this.bot.on('death', () => {
            const survivalTime = this.stats.endLife()
            const msg = `${this.username} died! Survived ${survivalTime.toFixed(1)}s. Episode ${this.currentEpisode}`
            this.bot.chat(msg)
            this.stats.generateGithubGraph()
            
            // Don't end episode or clear learning state on death
            // Just increment episode counter
            this.currentEpisode++
            
            if (config.resetWorldOnDeath) {
                setTimeout(() => this.resetWorld(), 5000)
            } else {
                this.bot.chat(`${this.username} respawning... (no world reset)`)
            }
        })

        this.bot.on('end', () => {
            console.log(`${this.username} disconnected. Cleaning up...`)
            this.endEpisode()
            this.isConnecting = false
            
            // Add delay before reconnect attempt
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const reconnectDelay = 5000 + (this.reconnectAttempts * 2000)
                console.log(`${this.username} scheduling reconnection in ${reconnectDelay/1000}s...`)
                setTimeout(() => this.connect(), reconnectDelay)
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

        // Add position update handler to detect movement issues
        this.bot.on('move', () => {
            if (this.bot.entity && this.bot.entity.velocity) {
                const speed = Math.sqrt(
                    this.bot.entity.velocity.x * this.bot.entity.velocity.x +
                    this.bot.entity.velocity.z * this.bot.entity.velocity.z
                )
                if (speed > 0.5) { // If moving too fast
                    // Reset velocity to prevent "moved too quickly" warnings
                    this.bot.entity.velocity.x = 0
                    this.bot.entity.velocity.z = 0
                }
            }
        })
    }

    startLearning() {
        // Only start if not already running
        if (this.learningInterval) {
            return
        }
        
        this.learningInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) {
                return
            }
            
            if (!this.isInitialized) {
                return
            }
            
            try {
                this.learningStep()
            } catch (err) {
                console.log(`${this.username} error in learning step:`, err.message)
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
    }

    async executeAction(action) {
        if (!this.bot || !this.bot.entity) {
            console.log(`${this.username} skipping action - bot not ready`)
            return
        }

        try {
            switch(action) {
                case 'forward':
                    if (!this.bot.entity || !this.bot.setControlState) {
                        console.log(`${this.username} (forward) bot or setControlState missing. (bot: ${!!this.bot}, entity: ${!!this.bot?.entity}, setControlState: ${!!this.bot?.setControlState})`);
                        return;
                    }
                    this.bot.setControlState('forward', true);
                    await this.bot.waitForTicks(5);
                    this.bot.setControlState('forward', false);
                    break;
                case 'back':
                    if (!this.bot.entity || !this.bot.setControlState) {
                        console.log(`${this.username} (back) bot or setControlState missing. (bot: ${!!this.bot}, entity: ${!!this.bot?.entity}, setControlState: ${!!this.bot?.setControlState})`);
                        return;
                    }
                    this.bot.setControlState('back', true);
                    await this.bot.waitForTicks(5);
                    this.bot.setControlState('back', false);
                    break;
                case 'left':
                    if (!this.bot.entity || !this.bot.setControlState) {
                        console.log(`${this.username} (left) bot or setControlState missing. (bot: ${!!this.bot}, entity: ${!!this.bot?.entity}, setControlState: ${!!this.bot?.setControlState})`);
                        return;
                    }
                    this.bot.setControlState('left', true);
                    await this.bot.waitForTicks(5);
                    this.bot.setControlState('left', false);
                    break;
                case 'right':
                    if (!this.bot.entity || !this.bot.setControlState) {
                        console.log(`${this.username} (right) bot or setControlState missing. (bot: ${!!this.bot}, entity: ${!!this.bot?.entity}, setControlState: ${!!this.bot?.setControlState})`);
                        return;
                    }
                    this.bot.setControlState('right', true);
                    await this.bot.waitForTicks(5);
                    this.bot.setControlState('right', false);
                    break;
                case 'jump':
                    if (!this.bot.entity || !this.bot.setControlState) {
                        console.log(`${this.username} (jump) bot or setControlState missing. (bot: ${!!this.bot}, entity: ${!!this.bot?.entity}, setControlState: ${!!this.bot?.setControlState})`);
                        return;
                    }
                    this.bot.setControlState('jump', true);
                    await this.bot.waitForTicks(5);
                    this.bot.setControlState('jump', false);
                    break;
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
            console.log(`${this.username} action error:`, err.message || err)
        }
    }

    endEpisode() {
        if (this.learningInterval) {
            clearInterval(this.learningInterval)
            this.learningInterval = null
        }
        
        // Save Q-table periodically
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
            console.log(`${this.username} resetting world completely...`)
            
            // Reset connection state
            this.isConnecting = false
            this.reconnectAttempts = 0
            
            // End current connection if exists
            if (this.bot) {
                this.bot.end()
                this.bot = null
            }

            // Stop the server
            console.log('Stopping Minecraft server...')
            await new Promise((resolve) => {
                const { exec } = require('child_process')
                exec('pkill -f "java.*server.jar"', () => {
                    // Wait a moment to ensure server is fully stopped
                    setTimeout(resolve, 2000)
                })
            })

            // Delete the world directory
            console.log('Deleting world directory...')
            const { execSync } = require('child_process')
            execSync('rm -rf world world_nether world_the_end', { stdio: 'inherit' })

            // Start the server again
            console.log('Starting Minecraft server...')
            const { spawn } = require('child_process')
            const server = spawn('java', [
                '-Xmx4G',
                '-Xms4G',
                '-XX:+UseG1GC',
                '-XX:+ParallelRefProcEnabled',
                '-XX:MaxGCPauseMillis=200',
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:G1NewSizePercent=40',
                '-XX:G1MaxNewSizePercent=50',
                '-XX:G1HeapRegionSize=32M',
                '-XX:G1ReservePercent=20',
                '-XX:G1HeapWastePercent=5',
                '-XX:+UseLargePages',
                '-XX:+AlwaysPreTouch',
                '-jar',
                'server.jar',
                'nogui'
            ], {
                detached: true,
                stdio: 'inherit'
            })
            server.unref()

            // Wait fixed 3 minutes for server to be ready
            console.log('Waiting 3 minutes for server to be fully ready...')
            await new Promise(resolve => setTimeout(resolve, 120000))
            console.log('Server wait complete, connecting bot...')
            
            // Reconnect with fresh state
            this.connect()
            
        } catch (err) {
            console.log(`${this.username} error resetting world:`, err.message || err)
            setTimeout(() => this.resetWorld(), 5000)
        }
    }
}

module.exports = { SurvivalBot } 