const fs = require('fs');
try {
    const content = fs.readFileSync('d:\\GitHub\\sabor-app\\data\\menu-database.json', 'utf8');
    JSON.parse(content);
    console.log('JSON is valid');
} catch (e) {
    console.log(e.message);
    // Try to find the position
    if (e.message.includes('position')) {
        const match = e.message.match(/position (\d+)/);
        if (match) {
            const pos = parseInt(match[1]);
            const lines = content.substring(0, pos).split('\n');
            console.log(`Error at line ${lines.length}, column ${lines[lines.length - 1].length}`);
            console.log(`Context: ${lines[lines.length - 1]}`);
        }
    }
}
