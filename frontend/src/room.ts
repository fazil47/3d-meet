import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import {
  Engine,
  Scene,
  Vector3,
  MeshBuilder,
  SceneLoader,
  FreeCamera,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  PointLight,
  SpotLight,
  StandardMaterial,
  Color3,
  CubeTexture,
  Texture,
  VirtualJoystick,
  Matrix,
  Axis,
  FreeCameraVirtualJoystickInput,
  Sound,
  Mesh,
  CreateCapsule,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Button,
  InputText,
} from "@babylonjs/gui";
import Assets from "@babylonjs/assets";

// Imports for multiuser support
import { v4 as uuidV4 } from "uuid";
import { Peer, MediaConnection } from "peerjs";
import { io, Socket } from "socket.io-client";

import { isInPortrait, isTouchOnly } from "./utils";

import EntryGUI from "./ui/EntryGUI.json" assert { type: "json" };

class Participant {
  id: string;
  name: string;
  mesh: Mesh;
  voice: Sound | null;

  constructor(id: string, name: string, mesh: Mesh) {
    this.id = id;
    this.name = name;
    this.mesh = mesh;
    this.voice = null;
  }

  setVoice(voice: Sound) {
    this.voice = voice;
    voice.attachToMesh(this.mesh);
  }

  destroy() {
    this.mesh.dispose();
    this.voice?.dispose();
  }
}

export class Room {
  roomId: string = "";
  socket: Socket | null = null;
  selfPeer: Peer | null = null;
  audioStream: MediaStream | null = null;
  peers: {
    [peerId: string]: { stream: MediaConnection; participant: Participant };
  } = {};
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: FreeCamera;

  constructor() {
    // create the canvas html element and attach it to the webpage
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.id = "gameCanvas";
    document.body.appendChild(this.canvas);

    // initialize babylon scene and engine
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.camera = this.createController();

    this.createEnvironment();
    this.createGUI();
    this.createDebugLayer();

    // Event listener to resize the babylon engine when the window is resized
    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    // run the main render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  createController(): FreeCamera {
    const camera = new FreeCamera(
      "Camera",
      new Vector3(1.5, 2.5, -15),
      this.scene
    );
    camera.setTarget(Vector3.Zero());
    camera.attachControl(this.canvas, true);

    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new Vector3(1, 1, 1); // Camera collider

    camera.minZ = 0.45;
    camera.speed = 0.25;
    camera.angularSensibility = 4000;

    // Add keyboard controls
    camera.keysUp.push(87); // W
    camera.keysLeft.push(65); // A
    camera.keysDown.push(83); // S
    camera.keysRight.push(68); // D

    this.scene.onPointerDown = (evt) => {
      if (evt.button === 0) {
        this.engine.enterPointerlock();
      } else if (evt.button === 1) {
        this.engine.exitPointerlock();
        document.exitFullscreen();
      }
    };

    return camera;
  }

  createGUI(): void {
    const adt = AdvancedDynamicTexture.CreateFullscreenUI("UI");

    adt.parseSerializedObject(EntryGUI);
    const entryGUI = adt.getControlByName("EntryGUI") as Control;

    // Get a reference to the RoomIdInput control to later set roomId
    const roomIdInput = adt.getControlByName("RoomIdInput") as InputText;

    // Show landscape instruction only on touch only devices
    const landscapeInstructionText = adt.getControlByName(
      "LandscapeInstructionText"
    ) as Control;
    if (landscapeInstructionText) {
      if (!isTouchOnly()) {
        landscapeInstructionText.isVisible = false;
      } else {
        window.addEventListener("resize", function () {
          landscapeInstructionText.isVisible = isInPortrait();
        });

        landscapeInstructionText.isVisible = isInPortrait();
      }
    }

    const enterButton = adt.getControlByName("EnterButton");
    if (enterButton) {
      enterButton.onPointerClickObservable.add(() => {
        // Set roomId to the value of the RoomIdInput control
        if (roomIdInput && roomIdInput.text !== roomIdInput.promptMessage) {
          this.roomId = roomIdInput.text;
        } else {
          this.roomId = uuidV4();
        }

        // Go into fullscreen
        document.documentElement.requestFullscreen();

        // Add virtual joystick controls for touch only devices
        if (isTouchOnly()) {
          this.camera.inputs.add(new FreeCameraVirtualJoystickInput());
          const vJoystick = this.camera.inputs.attached["virtualJoystick"];
          if (vJoystick && vJoystick.camera) {
            vJoystick.camera.minZ = 0.45;
            vJoystick.camera.speed = 0.25;
            vJoystick.camera.angularSensibility = 12000;
          }
        }

        // Hide entry GUI
        entryGUI.isVisible = false;

        [this.socket, this.selfPeer] = this.setupConnection();
      });
    }
  }

  async createEnvironment(): Promise<void> {
    this.scene.shadowsEnabled = true;

    // Light 1
    const light1 = new DirectionalLight(
      "light1",
      new Vector3(0, 0, 0),
      this.scene
    );
    light1.direction = new Vector3(-0.713, -0.328, 0.619);
    light1.intensity = 2;
    light1.shadowEnabled = true;
    const shadowGenerator1 = new ShadowGenerator(1024, light1);

    // Light 2
    const light2 = new HemisphericLight(
      "light2",
      new Vector3(0, 0, 0),
      this.scene
    );
    light2.intensity = 0.5;

    // Gravity and collision
    const framesPerSecond = 60;
    const gravity = -9.81;
    this.scene.gravity = new Vector3(0, gravity / framesPerSecond, 0);
    this.scene.collisionsEnabled = true;

    // Environment meshes
    const { meshes } = await SceneLoader.ImportMeshAsync(
      "",
      "./models/",
      "KenneyPlayground.glb",
      this.scene
    );
    meshes.forEach((mesh) => {
      mesh.checkCollisions = true;
      mesh.receiveShadows = true;
      shadowGenerator1.addShadowCaster(mesh);
    });

    // Skybox
    const skybox = MeshBuilder.CreateBox(
      "skyBox",
      { size: 1000.0 },
      this.scene
    );
    const skyboxMaterial = new StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture(
      Assets.skyboxes.skybox_nx_jpg.rootUrl + "skybox",
      this.scene
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;
  }

  setupConnection(): [Socket, Peer] {
    // Connect to websocket server
    const socket = io("ws://localhost:3000");

    // Remove participant from scene when they disconnect
    socket.on("user-disconnected", (userId) => {
      if (this.peers[userId]) {
        this.peers[userId].stream.close();
        this.peers[userId].participant.destroy();
      }
    });

    // Connect to peer server
    const selfPeer = new Peer({
      host: "localhost",
      port: 3001,
    });

    // Setup peer object event listeners
    selfPeer.on("open", (id) => {
      socket.emit("join-room", this.roomId, id);

      // Send this user's position and rotation to the server every 1/60 s
      setInterval(() => {
        socket.emit(
          "client-update",
          this.camera.position,
          this.camera.rotation
        );
      }, 1000 / 60);

      // Receive other users' position and rotation from the server
      socket.on(
        "server-update",
        (userId: string, position: Vector3, rotation: Vector3) => {
          if (userId === selfPeer.id) return;

          if (this.peers[userId]) {
            this.peers[userId].participant.mesh.position = new Vector3(
              position._x,
              position._y,
              position._z
            );

            this.peers[userId].participant.mesh.rotation.y = rotation._y;
          }
        }
      );

      this.setupAudioInput();
    });

    return [socket, selfPeer];
  }

  async setupAudioInput(): Promise<void> {
    if (!this.socket || !this.selfPeer) {
      return;
    }

    this.audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });

    // this.addAudioStream(this.selfPeer.id, stream);

    this.selfPeer.on("call", (call) => {
      if (this.audioStream === null) return;

      call.answer(this.audioStream);
      call.on("stream", (userAudioStream) => {
        this.addAudioStream(call.peer, userAudioStream);
      });
      call.on("close", () => {
        if (this.peers[call.peer]) {
          this.peers[call.peer].stream.close();
          this.peers[call.peer].participant.destroy();
        }
      });

      const newParticipantMesh = CreateCapsule(call.peer, {}, this.scene);
      newParticipantMesh.position = new Vector3(0, 2.5, 0);

      const newParticipant = new Participant(
        call.peer,
        "TODO: Change this",
        newParticipantMesh
      );

      this.peers[call.peer] = {
        stream: call,
        participant: newParticipant,
      };
    });

    this.socket.on("user-connected", (userId) => {
      this.connectToNewParticipant(userId);
    });

    this.socket.on("user-disconnected", (userId) => {
      if (this.peers[userId]) {
        this.peers[userId].stream.close();
        this.peers[userId].participant.destroy();
      }
    });

    this.socket.emit("user-ready");
  }

  connectToNewParticipant(participantId: string) {
    if (!this.socket || !this.selfPeer || !this.audioStream) {
      return;
    }

    const call = this.selfPeer.call(participantId, this.audioStream);
    call.on("stream", (userAudioStream) => {
      this.addAudioStream(participantId, userAudioStream);
    });
    call.on("close", () => {
      if (this.peers[participantId]) {
        this.peers[participantId].stream.close();
        this.peers[participantId].participant.destroy();
      }
    });

    const newParticipantMesh = CreateCapsule(participantId, {}, this.scene);
    newParticipantMesh.position = new Vector3(0, 2.5, 0);

    const newParticipant = new Participant(
      participantId,
      "TODO: Change this",
      newParticipantMesh
    );

    this.peers[participantId] = {
      stream: call,
      participant: newParticipant,
    };
  }

  addAudioStream(participantId: string, stream: MediaStream) {
    // Remote media streams don't work in Chromium browsers if they are not attached to an HTML element
    // So it attach to an audio element first
    const audioElement = document.createElement("audio");
    audioElement.srcObject = stream;

    const voice = new Sound(
      "voice",
      audioElement.srcObject,
      this.scene,
      () => {
        this.peers[participantId].participant.setVoice(voice);
      },
      {
        spatialSound: true,
        streaming: true,
        autoplay: true,
      }
    );
  }

  createDebugLayer(): void {
    // Toggle Inspector visibility
    window.addEventListener("keydown", (ev) => {
      // Shift + Ctrl + Alt + I
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
        } else {
          this.scene.debugLayer.show();
        }
      }
    });
  }
}
