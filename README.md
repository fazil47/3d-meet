# 3D Meet

A 3D teleconferencing (voice only) app made with Babylon.js, WebSockets (socket.io) and WebRTC (peer.js).

https://user-images.githubusercontent.com/18116695/197512205-831d38e6-368f-4d05-98b5-5b687601a932.mp4

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
