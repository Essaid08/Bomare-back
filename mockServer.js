

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

let isGeneratingData = false;
let mockInterval = null;

function generateMockData() {
  const frequencies = [200000, 20000, 2000, 200, 20]; // Frequencies in Hz
  const frequency = frequencies[Math.floor(Math.random() * frequencies.length)];
  
  const getRandomResistance = () => {
    const magnitude = Math.floor(Math.random() * 3); // 0, 1, or 2 for ohms, kOhms, MOhms
    const baseValue = Math.random() * 900 + 100; // Random value between 100 and 1000
    
    let value, unit;
    switch (magnitude) {
      case 0:
        value = baseValue.toFixed(2);
        unit = "Ω";
        break;
      case 1:
        value = (baseValue / 1000).toFixed(2);
        unit = "kΩ";
        break;
      case 2:
        value = (baseValue / 1000000).toFixed(2);
        unit = "MΩ";
        break;
    }
    
    return `Z = ${value} ${unit}`;
  };
  
  const count = Math.floor(Math.random() * 5) + 1;
  const resistanceValues = [];
  for (let i = 0; i < count; i++) {
    resistanceValues.push(getRandomResistance());
  }
  
  return {
    portInfo: "PORT COM3 (Arduino Nano)",
    resistanceValues: resistanceValues,
    lastUpdated: new Date().toISOString()
  };
}

app.get('/api/resistance-data', (req, res) => {
  if (isGeneratingData) {
    res.json(generateMockData());
  } else {
    res.json({
      portInfo: "PORT COM3 (Arduino Nano)",
      resistanceValues: [],
      lastUpdated: new Date().toISOString()
    });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send initial data
  socket.emit('multimeter-data', {
    portInfo: "PORT COM3 (Arduino Nano)",
    resistanceValues: [],
    lastUpdated: new Date().toISOString()
  });
  
  // Handle start/stop commands
  socket.on('command', (command) => {
    if (command === 'start' && !isGeneratingData) {
      console.log('Starting data generation');
      isGeneratingData = true;
      
      // Send data immediately
      const data = generateMockData();
      io.emit('multimeter-data', data);
      
      // Then set up interval
      mockInterval = setInterval(() => {
        const data = generateMockData();
        io.emit('multimeter-data', data);
      }, 3000);
      
    } else if (command === 'stop' && isGeneratingData) {
      console.log('Stopping data generation');
      isGeneratingData = false;
      
      if (mockInterval) {
        clearInterval(mockInterval);
        mockInterval = null;
      }
      
      io.emit('multimeter-data', {
        portInfo: "PORT COM3 (Arduino Nano)",
        resistanceValues: [],
        lastUpdated: new Date().toISOString()
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Mock server running on port ${PORT}`);
  console.log('Access the API at http://localhost:3000/api/resistance-data');
  console.log('WebSocket server is running');
});

console.log('To start generating data, connect to the server and send a "start" command');
console.log('To stop generating data, send a "stop" command');