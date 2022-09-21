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
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Button,
} from "@babylonjs/gui";
import Assets from "@babylonjs/assets";
import { isInPortrait, isTouchOnly } from "./utils";

import EntryGUI from "./ui/EntryGUI.json" assert { type: "json" };

export class Room {
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

    // TODO: Set roomId in GUI

    // Show landscape instruction only on touch only devices
    const landscapeInstructionText = adt.getControlByName(
      "LandscapeInstructionText"
    );
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
