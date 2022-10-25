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
  StandardMaterial,
  Color3,
  CubeTexture,
  Texture,
  FreeCameraVirtualJoystickInput,
  Sound,
  AbstractMesh,
  AnimationGroup,
  Nullable,
  PointLight,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control } from "@babylonjs/gui";
import Assets from "@babylonjs/assets";

// Imports for multiuser support
import { Peer, MediaConnection } from "peerjs";
import { io, Socket } from "socket.io-client";

import { isInPortrait, isTouchOnly } from "./utils";

// Babylon.js GUI editor exports
import GoFullScreenGUI from "./ui/GoFullScreenGUI.json" assert { type: "json" };

// Meshes
import KayBear from "./models/KayBear.glb" assert { type: "glb" };
import KayDog from "./models/KayDog.glb" assert { type: "glb" };
import KayDuck from "./models/KayDuck.glb" assert { type: "glb" };
import dungeonGLB from "./models/dungeon.glb" assert { type: "glb" };

class Participant {
  id: string;
  name: string;
  mesh: AbstractMesh;
  idleAnimation: AnimationGroup | null = null;
  walkAnimation: AnimationGroup | null = null;
  lerpTargetPosition: Vector3 | null = null;
  voice: Sound | null;

  constructor(
    id: string,
    name: string,
    mesh: AbstractMesh,
    idleAnimation: AnimationGroup | null,
    walkAnimation: AnimationGroup | null
  ) {
    this.id = id;
    this.name = name;
    this.mesh = mesh;

    if (idleAnimation) {
      this.idleAnimation = idleAnimation;
      this.idleAnimation.play();
    }

    if (walkAnimation) {
      this.walkAnimation = walkAnimation;
    }

    this.voice = null;
  }

  setVoice(voice: Sound) {
    this.voice = voice;
    this.voice.attachToMesh(this.mesh);
    this.voice.setDirectionalCone(90, 180, 0);
    this.voice.setLocalDirectionToMesh(this.mesh.forward);
  }

  // This needs to be called every frame
  update() {
    if (
      this.lerpTargetPosition === null ||
      this.mesh.position.equalsWithEpsilon(this.lerpTargetPosition, 0.1)
    ) {
      if (this.walkAnimation && this.walkAnimation.isPlaying) {
        this.walkAnimation.stop();
        this.idleAnimation?.play();
      }

      return;
    }

    this.mesh.position = Vector3.Lerp(
      this.mesh.position,
      this.lerpTargetPosition,
      0.2
    );
  }

  walkTo(position: Vector3) {
    // If position hasn't changed, do nothing
    if (this.mesh.position.equalsWithEpsilon(position, 0.1)) {
      return;
    }

    // Play walk animation if not already playing
    if (this.walkAnimation && !this.walkAnimation.isPlaying) {
      this.walkAnimation.play();
    }

    this.lerpTargetPosition = position;
  }

  setYRotation(yRotation: number) {
    this.mesh.rotation = new Vector3(
      this.mesh.rotation.x,
      yRotation,
      this.mesh.rotation.z
    );
  }

  destroy() {
    this.mesh.dispose();
    this.voice?.dispose();
  }
}

export class Room {
  roomId = "";
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
  characterModels: string[] = [KayBear, KayDog, KayDuck];
  selfCharacterModel: string;

  constructor(userName: string, roomId: string) {
    this.roomId = roomId;

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

    // Setup connections
    [this.socket, this.selfPeer] = this.setupConnection();

    this.createEnvironment();
    this.createGUI();

    if (process.env.NODE_ENV === "development") {
      this.createDebugLayer();
    }

    // Event listener to resize the babylon engine when the window is resized
    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    // Select a random character from this.characterModels
    this.selfCharacterModel =
      this.characterModels[
        Math.floor(Math.random() * this.characterModels.length)
      ];

    // run the main render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();

      // Update participants
      Object.values(this.peers).forEach((peer) => {
        peer.participant.update();
      });
    });
  }

  createController(): FreeCamera {
    const camera = new FreeCamera(
      "Camera",
      new Vector3(1.5, 4, -15),
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

    adt.parseSerializedObject(GoFullScreenGUI);
    const fullScreenGUI = adt.getControlByName("GoFullScreenGUI") as Control;

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

    const enterButton = adt.getControlByName("FullScreenButton");
    if (enterButton) {
      enterButton.onPointerClickObservable.add(() => {
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
        fullScreenGUI.isVisible = false;
      });
    }
  }

  async createEnvironment(): Promise<void> {
    // this.scene.shadowsEnabled = true;

    // Light 1
    const light1 = new DirectionalLight(
      "light1",
      new Vector3(0, 0, 0),
      this.scene
    );
    light1.position = new Vector3(0, 12, 0);
    light1.direction = new Vector3(0, -1, 0);
    light1.diffuse = new Color3(1, 0.34, 0.151);
    light1.intensity = 0.5;

    const light2 = new HemisphericLight(
      "light2",
      new Vector3(0, 0.5, 0.5),
      this.scene
    );
    light2.intensity = 0.25;
    light2.diffuse = new Color3(1, 0.34, 0.151);

    const light3 = new PointLight(
      "light3",
      new Vector3(12.71, 2.7, 0),
      this.scene
    );
    light3.diffuse = new Color3(1, 0.34, 0.151);
    light3.intensity = 80;
    // const shadowGenerator = new ShadowGenerator(512, light3);

    // Gravity and collision
    const framesPerSecond = 60;
    const gravity = -5;
    this.scene.gravity = new Vector3(0, gravity / framesPerSecond, 0);
    this.scene.collisionsEnabled = true;

    // Environment meshes
    const { meshes } = await SceneLoader.ImportMeshAsync(
      "",
      dungeonGLB,
      "",
      this.scene
    );
    meshes.forEach((mesh) => {
      if (mesh.name.split(".")[0] === "Collider") {
        try {
          mesh.checkCollisions = true;
          mesh.visibility = 0;
        } catch (e) {
          if (
            e instanceof TypeError &&
            process.env.NODE_ENV === "development"
          ) {
            console.log(
              `Instanced mesh ${mesh.name}'s collider is already enabled`
            );
          } else {
            console.log(e);
          }
        }
      } else if (mesh.name.split(".")[0] === "IgnorePointLight") {
        light3.excludedMeshes.push(mesh);
      }
      // else if (mesh.name.split(".")[0] !== "CastShadow") {
      //   // shadowGenerator.addShadowCaster(mesh);
      // }

      // try {
      //   mesh.receiveShadows = true;
      // } catch (e) {
      //   console.log(e);
      // }
    });

    // Skybox
    const skybox = MeshBuilder.CreateBox(
      "skyBox",
      { size: 1000.0 },
      this.scene
    );
    const skyboxMaterial = new StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    // skyboxMaterial.reflectionTexture = new CubeTexture(
    //   Assets.skyboxes.TropicalSunnyDay_nx_jpg.rootUrl + "TropicalSunnyDay",
    //   this.scene
    // );
    skyboxMaterial.reflectionTexture = new CubeTexture(
      Assets.skyboxes.space_back_jpg.rootUrl + "space",
      this.scene,
      [
        "_left.jpg",
        "_up.jpg",
        "_front.jpg",
        "_right.jpg",
        "_down.jpg",
        "_back.jpg",
      ]
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skyboxMaterial.emissiveColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    skybox.rotate(new Vector3(1, 0, 0), Math.PI / 2);
  }

  setupConnection(): [Socket, Peer] {
    // Connect to websocket server
    const socket = io(
      process.env.SERVER_URL ? process.env.SERVER_URL : "http://localhost:3000"
    );

    // Remove participant from scene when they disconnect
    socket.on("user-disconnected", (userId) => {
      if (this.peers[userId]) {
        this.peers[userId].stream.close();
        this.peers[userId].participant.destroy();
      }
    });

    // Connect to peer server
    const selfPeer = new Peer({
      host: process.env.PEER_SERVER_HOST
        ? process.env.PEER_SERVER_HOST
        : "localhost",
      port: parseInt(
        process.env.PEER_SERVER_PORT ? process.env.PEER_SERVER_PORT : "9000"
      ),
    });

    // Setup peer object event listeners
    selfPeer.on("open", (id) => {
      socket.emit("join-room", this.roomId, id);

      // Send this user's position and rotation to the server every 1/20 s
      setInterval(() => {
        socket.emit(
          "client-update",
          this.camera.position,
          this.camera.rotation
        );
      }, 1000 / 20);

      // Receive other users' position and rotation from the server
      socket.on(
        "server-update",
        (userId: string, position: Vector3, rotation: Vector3) => {
          if (userId === selfPeer.id) return;

          if (this.peers[userId]) {
            this.peers[userId].participant.walkTo(
              new Vector3(position._x, position._y, position._z)
            );

            this.peers[userId].participant.setYRotation(rotation._y);
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

    this.selfPeer.on("call", async (call) => {
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

      const [characterMesh, idleAnimation, walkAnimation] =
        await this.loadCharacter(call.peer, call.metadata.characterModel);
      characterMesh.position = new Vector3(0, 2.5, 0);

      const newParticipant = new Participant(
        call.peer,
        "TODO: Change this",
        characterMesh,
        idleAnimation,
        walkAnimation
      );

      this.peers[call.peer] = {
        stream: call,
        participant: newParticipant,
      };
    });

    this.socket.on("user-connected", async (userId, userCharacter) => {
      await this.connectToNewParticipant(userId, userCharacter);
    });

    this.socket.on("user-disconnected", (userId) => {
      if (this.peers[userId]) {
        this.peers[userId].stream.close();
        this.peers[userId].participant.destroy();
      }
    });

    this.socket.emit("user-ready", this.selfCharacterModel);
  }

  async connectToNewParticipant(
    participantId: string,
    participantCharacterModel: string
  ): Promise<void> {
    if (!this.socket || !this.selfPeer || !this.audioStream) {
      return;
    }

    const call = this.selfPeer.call(participantId, this.audioStream, {
      metadata: { characterModel: this.selfCharacterModel },
    });
    call.on("stream", (userAudioStream) => {
      this.addAudioStream(participantId, userAudioStream);
    });
    call.on("close", () => {
      if (this.peers[participantId]) {
        this.peers[participantId].stream.close();
        this.peers[participantId].participant.destroy();
      }
    });

    const [characterMesh, idleAnimation, walkAnimation] =
      await this.loadCharacter(participantId, participantCharacterModel);
    characterMesh.position = new Vector3(0, 2.5, 0);

    const newParticipant = new Participant(
      participantId,
      "TODO: Change this",
      characterMesh,
      idleAnimation,
      walkAnimation
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

  async loadCharacter(
    name: string,
    characterModel: string
  ): Promise<
    [AbstractMesh, Nullable<AnimationGroup>, Nullable<AnimationGroup>]
  > {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { meshes, particleSystems, skeletons, animationGroups } =
      await SceneLoader.ImportMeshAsync("", characterModel, "", this.scene);

    // Manipulating the meshes only work properly if the structure of the model is same as the one in the models folder
    meshes[0].name = name;
    meshes[0].scaling = new Vector3(2, 2, 2);

    meshes.slice(1, meshes.length).forEach((mesh) => {
      mesh.position.z = 1;
    });

    const idleAnimation = animationGroups.find(
      (ag) => ag.name === "Idle_KayKit Animated Character2"
    );
    const walkAnimation = animationGroups.find(
      (ag) => ag.name === "Walk_KayKit Animated Character2"
    );

    if (idleAnimation) {
      idleAnimation.play(true);
    }

    return [
      meshes[0],
      idleAnimation ? idleAnimation : null,
      walkAnimation ? walkAnimation : null,
    ];
  }

  createDebugLayer(): void {
    console.log("Debug layer enabled");

    // Toggle Inspector visibility
    window.addEventListener("keydown", (ev) => {
      if (
        ev.ctrlKey &&
        ev.shiftKey &&
        ev.altKey &&
        (ev.key === "i" || ev.key === "I")
      ) {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
        } else {
          this.scene.debugLayer.show();
        }
      }
    });
  }
}
