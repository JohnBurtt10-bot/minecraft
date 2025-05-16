const rcon = require('rcon-client')
const { EventEmitter } = require('events')
const fs = require('fs')
const path = require('path')

class ServerManager extends EventEmitter {
    constructor(config = {}) {
        super()
        this.config = {
            host: config.host || 'localhost',
            port: config.rconPort || 25575,
            password: config.rconPassword || 'minecraft',
            worldPath: config.worldPath || 'world',
            maxRetries: config.maxRetries || 5,
            ...config
        }
        this.rcon = null
        this.seed = null
        this.connectRetries = 0
        this.isConnecting = false
        this.isServerRestarting = false
    }

    async connect() {
        if (this.isConnecting) {
            console.log('Already attempting to connect to RCON...')
            return
        }

        if (this.connectRetries >= this.config.maxRetries) {
            console.error('Max RCON connection retries reached')
            return
        }

        this.isConnecting = true
        this.connectRetries++

        try {
            // Check if server.properties exists and has RCON enabled
            if (fs.existsSync('server.properties')) {
                const props = fs.readFileSync('server.properties', 'utf8')
                if (!props.includes('enable-rcon=true')) {
                    // Add RCON settings if not present
                    const rconSettings = `
enable-rcon=true
rcon.password=${this.config.password}
rcon.port=${this.config.port}
`
                    fs.appendFileSync('server.properties', rconSettings)
                    console.log('Added RCON settings to server.properties')
                    console.log('Please restart your Minecraft server for RCON changes to take effect')
                    this.isConnecting = false
                    return
                }
            }

            // Cleanup existing connection if any
            if (this.rcon) {
                try {
                    await this.disconnect()
                } catch (err) {
                    console.log('Error cleaning up existing RCON connection:', err.message)
                }
            }

            console.log(`Attempting RCON connection (attempt ${this.connectRetries})...`)
            this.rcon = new rcon.Rcon({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                timeout: 5000
            })

            // Set up connection error handler
            this.rcon.on('error', (err) => {
                console.error('RCON connection error:', err.message)
                this.isConnecting = false
                if (!this.isServerRestarting && this.connectRetries < this.config.maxRetries) {
                    const delay = this.connectRetries * 2000
                    console.log(`Retrying RCON connection in ${delay/1000}s...`)
                    setTimeout(() => this.connect(), delay)
                }
            })

            await this.rcon.connect()
            console.log('Server manager connected to RCON')
            this.isConnecting = false
            this.connectRetries = 0

            // Test RCON connection
            const response = await this.rcon.send('list')
            console.log('RCON test response:', response)

        } catch (err) {
            console.error('Failed to connect to RCON:', err.message)
            this.isConnecting = false
            
            if (!this.isServerRestarting && this.connectRetries < this.config.maxRetries) {
                const delay = this.connectRetries * 2000
                console.log(`Retrying RCON connection in ${delay/1000}s...`)
                setTimeout(() => this.connect(), delay)
            }
        }
    }

    async resetWorld() {
        try {
            this.isServerRestarting = true

            if (!this.rcon || !this.rcon.socket?.writable) {
                console.log('RCON not connected, attempting to reconnect...')
                await this.connect()
                // Wait for connection
                await new Promise(resolve => setTimeout(resolve, 5000))
            }

            if (!this.rcon || !this.rcon.socket?.writable) {
                throw new Error('Failed to establish RCON connection')
            }

            console.log('Starting world reset...')
            
            try {
                // Save and kick all players
                await this.rcon.send('save-all')
                await this.rcon.send('kick @a Server resetting world...')
                
                // Properly disconnect RCON before stopping server
                await this.disconnect()
                
                // Stop the server
                await this.rcon.send('stop')
                
                // Wait for server to fully stop
                await new Promise(resolve => setTimeout(resolve, 10000))
                
                // Delete world files but preserve seed
                const worldPath = this.config.worldPath
                if (fs.existsSync(worldPath)) {
                    console.log('Deleting world files...')
                    const files = fs.readdirSync(worldPath)
                    for (const file of files) {
                        const filePath = path.join(worldPath, file)
                        if (file !== 'level.dat') {
                            if (fs.lstatSync(filePath).isDirectory()) {
                                fs.rmdirSync(filePath, { recursive: true })
                            } else {
                                fs.unlinkSync(filePath)
                            }
                        }
                    }
                }

                // Start server
                console.log('Starting server...')
                const { spawn } = require('child_process')
                const server = spawn('java', ['-Xmx2G', '-jar', 'server.jar', 'nogui'])
                
                // Wait longer for server to start and RCON to be available
                await new Promise(resolve => setTimeout(resolve, 45000))
                
                // Reset connection state and retry count
                this.isConnecting = false
                this.connectRetries = 0
                
                // Reconnect RCON
                await this.connect()
                
                this.isServerRestarting = false
                console.log('World reset completed')
            } catch (err) {
                this.isServerRestarting = false
                console.error('Error during reset process:', err.message)
                throw err
            }
        } catch (err) {
            this.isServerRestarting = false
            console.error('Error resetting world:', err.message)
            throw err
        }
    }

    async disconnect() {
        if (this.rcon) {
            try {
                await this.rcon.end()
            } catch (err) {
                console.error('Error disconnecting RCON:', err.message)
            }
            this.rcon = null
        }
        this.isConnecting = false
    }
}

module.exports = ServerManager 