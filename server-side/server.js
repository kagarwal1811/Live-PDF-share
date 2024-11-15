const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up storage for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // React frontend URL
    methods: ["GET", "POST"]
  }
});

let rooms = {}; // Store information about rooms and shared PDF state

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createRoom', (roomId) => {
    if (!rooms[roomId]) {
      socket.join(roomId);
      rooms[roomId] = { currentPage: 1, pdfUrl: null, owner: socket.id };
      console.log(`Room ${roomId} created`);
    }
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      socket.emit('updatePage', rooms[roomId].currentPage);
      if (rooms[roomId].pdfUrl) {
        socket.emit('pdfUploaded', rooms[roomId].pdfUrl);
      }
      console.log(`User joined room ${roomId}`);
    } else {
      console.log(`Room ${roomId} does not exist`);
    }
  });

  socket.on('changePage', ({ roomId, pageNumber }) => {
    if (rooms[roomId] && rooms[roomId].owner === socket.id) {
      rooms[roomId].currentPage = pageNumber;
      io.in(roomId).emit('updatePage', pageNumber);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

app.post('/upload', upload.single('pdf'), (req, res) => {
  const { roomId } = req.body;
  if (rooms[roomId]) {
    rooms[roomId].pdfUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    rooms[roomId].currentPage = 1; // Set the page to the first page after uploading
    io.in(roomId).emit('pdfUploaded', rooms[roomId].pdfUrl);
    io.in(roomId).emit('updatePage', rooms[roomId].currentPage);
    res.status(200).send({ pdfUrl: rooms[roomId].pdfUrl });
  } else {
    res.status(400).send('Room does not exist');
  }
});

const PORT = 8082;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
