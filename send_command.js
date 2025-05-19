const { Rcon } = require('rcon-client');

async function sendCommand() {
    const rcon = await Rcon.connect({
        host: 'localhost',
        port: 25575,
        password: 'minecraft'
    });

    await rcon.send('op JohnBurtt');
    await rcon.send('gamemode creative JohnBurtt');
    
    await rcon.end();
}

sendCommand().catch(console.error); 