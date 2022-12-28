# 3D Meet

A 3D teleconferencing (voice only) app made with Babylon.js, WebSockets (socket.io) and WebRTC (peer.js).


https://user-images.githubusercontent.com/18116695/209786392-79d3c6af-93b4-45d8-a5d6-d055d99de9b6.mp4


## Project Structure
```
3d-meet
│
└───backend
│
└───frontend
│
└───peer-server
```
`cd` into each and run them simultaneously to run the project.

## backend
The backend is an express server which uses socket.io to synchronize the positions of participants.
```
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm build

# Run prod server
npm start
```

## frontend
The frontend is a vanilla JavaScript app which uses Babylon.js for making the 3D world, socket.io for sending and receiving participant positions and peer.js for voice chat with WebRTC.
```
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm build

# Run prod server
npm start
```

## peer-server
The peer server was made using peer.js for voice chat using WebRTC.
```
# Install dependencies
npm install

# Run prod server
npm start
```
