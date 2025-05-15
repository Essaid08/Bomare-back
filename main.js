const express = require('express');
const { SerialPort, ReadlineParser } = require('serialport');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

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
app.use(express.static('public')); 


let multimeterData = {
  portInfo: "Not Connected",
  resistanceValues: [],
  lastUpdated: new Date().toISOString()
};


let serialPort;
let parser;


function initializeSerialConnection() {

  SerialPort.list().then(ports => {
    console.log('Available ports:');
    ports.forEach(port => {
      console.log(port.path);
      // On Windows it might be 'COM3', on Mac/Linux it might be '/dev/ttyUSB0' or '/dev/ttyACM0'
      if (port.manufacturer && port.manufacturer.includes('Arduino') ||
          port.path.includes('ttyACM') || port.path.includes('ttyUSB') || port.path.includes('COM')) {
        
        console.log('Attempting to connect to:', port.path);
        serialPort = new SerialPort({ 
          path: port.path, 
          baudRate: 9600 // Make sure this matches your Arduino sketch
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        // Handle data from Arduino
        parser.on('data', (data) => {
          console.log('Received data:', data);
          processArduinoData(data);
        });

        serialPort.on('open', () => {
          console.log('Serial port opened successfully');
          multimeterData.portInfo = `PORT ${port.path}`;
        });

        serialPort.on('error', (err) => {
          console.error('Serial port error:', err.message);
          multimeterData.portInfo = "Error: " + err.message;
        });
      }
    });
  }).catch(err => {
    console.error('Error listing ports:', err);
  });
}


function processArduinoData(data) {

  
  try {
    // Check if it's a resistance measurement
    if (data.includes('Z = ')) {
      const resistanceValue = data.trim();
      
      multimeterData.resistanceValues.unshift(resistanceValue);
      
      if (multimeterData.resistanceValues.length > 5) {
        multimeterData.resistanceValues = multimeterData.resistanceValues.slice(0, 5);
      }
      
      multimeterData.lastUpdated = new Date().toISOString();
      
      // Emit to all connected clients
      io.emit('multimeter-data', multimeterData);
    } 
    else if (data.includes('Nouvelle fréquence :')) {
      console.log('Frequency changed:', data);
    }
  } catch (error) {
    console.error('Error processing Arduino data:', error);
  }
}

app.get('/api/resistance-data', (req, res) => {
  res.json(multimeterData);
});

io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.emit('multimeter-data', multimeterData);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
  
  socket.on('command', (command) => {
    if (command === 'start') {
      console.log('Start command received');
    } else if (command === 'stop') {
      console.log('Stop command received');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeSerialConnection();
});