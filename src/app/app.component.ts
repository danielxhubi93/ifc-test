import { Component, OnInit, Input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from "web-ifc-three/IFCLoader";
import { Raycaster, Vector2 } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { MeshLambertMaterial } from "three";
import { IFCModel } from 'web-ifc-three/IFC/components/IFCModel';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit {
 @ViewChild('threeCanvas', { static: true })
  private canvasRef: ElementRef<HTMLCanvasElement>;

  private scene: THREE.Scene;
  private raycaster: Raycaster;
  private mouse: Vector2;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private size = { width: 0, height: 0 };
  private preselectMat: MeshLambertMaterial;
  //Sets up the IFC loading
  ifcModels:IFCModel[] = [];
  ifcLoader = new IFCLoader();
  modelsContainer = new THREE.Object3D();

  constructor() { }

  ngOnInit(): void {
    // Sets up optimized picking
    this.ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);
    // Sets up the IFC loading
    this.ifcLoader.ifcManager.setWasmPath('assets/wasm/');
    this.preselectMat = new MeshLambertMaterial ({
      transparent: true,
      opacity: 1,
      color: 0xffffff,
      depthTest: false,
    });
    this.initScene();
    this.initRaycaster();
    this.initCamera();
    this.initLights();
    this.initRenderer();
    this.initGrids();
    this.initAxes();
    this.initControls();
    // Load base model
    this.loadIFCBaseModel('assets/ifc/479l7.ifc');
    this.animate();
    window.addEventListener('resize', this.onResize.bind(this));
  }


  ngAfterViewInit(): void {
    this.setHoverSelection();
  }

  extractDataValues(data: any[]): { [entityId: string]: { entityName: string, x: number, y: number, z: number } } {
    const dataValues = {};
    for (const datum of data) {
      const entityId = datum.datasource.entityId;
      if (!dataValues[entityId]) {
        dataValues[entityId] = { entityName: datum.datasource.name, x: 0, y: 0, z: 0 };
      }
      switch (datum.dataKey.name) {
        case 'x':
          dataValues[entityId].x = datum.data[0][1];
          break;
        case 'y':
          dataValues[entityId].y = datum.data[0][1];
          break;
        case 'z':
          dataValues[entityId].z = datum.data[0][1];
          break;
        default:
          break;
      }
    }
    return dataValues;
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
  }

  private initRaycaster(): void {
    this.raycaster = new Raycaster();
    this.raycaster.firstHitOnly = true;
    this.mouse = new Vector2();
  }

  private initCamera(): void {
    this.size.width = window.innerWidth;
    this.size.height = window.innerHeight;
    const aspect = this.size.width / this.size.height;
    this.camera = new THREE.PerspectiveCamera(75, aspect);
  }

  private initLights(): void {
    const lightColor = 0xffffff;
    const ambientLight = new THREE.AmbientLight(lightColor, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(lightColor, 1);
    directionalLight.position.set(0, 10, 0);
    directionalLight.target.position.set(-5, 0, 0);
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef.nativeElement,
      alpha: true
    });
    this.renderer.setSize(this.size.width, this.size.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  private initGrids(): void {
    const grid = new THREE.GridHelper(50, 30);
    this.scene.add(grid);
  }

  private initAxes(): void {
    const axes = new THREE.AxesHelper();
    axes.material.depthTest = false;
    axes.renderOrder = 1;
    this.scene.add(axes);
  }

  private initControls(): void {
    this.controls = new OrbitControls(this.camera, this.canvasRef.nativeElement);
    this.controls.enableDamping = true;
    this.controls.target.set(-2, 0, 0);
  }

  private loadIFCBaseModel(url: string): void {
    this.ifcLoader.load(url, (ifcModel) => {
      this.ifcModels.push(ifcModel);
      this.scene.add(ifcModel)
    });

  }


  private animate(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate.bind(this));
  }

  private onResize(): void {
    this.size.width = window.innerWidth;
    this.size.height = window.innerHeight;
    this.camera.aspect = this.size.width / this.size.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.size.width, this.size.height);
  }

  private cast(event) {
    // Computes the position of the mouse on the screen
    const bounds = this.canvasRef.nativeElement.getBoundingClientRect();

    const x1 = event.clientX - bounds.left;
    const x2 = bounds.right - bounds.left;
    this.mouse.x = (x1 / x2) * 2 - 1;

    const y1 = event.clientY - bounds.top;
    const y2 = bounds.bottom - bounds.top;
    this.mouse.y = -(y1 / y2) * 2 + 1;

    // Places it on the camera pointing to the mouse
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Casts a ray
    return this.raycaster.intersectObjects(this.ifcModels);
  }

  // pick(event: MouseEvent): void {
  //   const found = this.cast(event)[0];
  //   if (found) {
  //     const index = found.faceIndex;
  //     const geometry = found.object.geometry;
  //     const ifc = this.ifcLoader.ifcManager;
  //     const id = ifc.getExpressId(geometry, index);
  //     console.log(id);
  //   }
  // }

  private highlight(event, material, model): void {
    const found = this.cast(event)[0];
    if (found) {
      // Gets model ID
      model.id = found.object.modelID;
  
      // Gets Express ID
      const index = found.faceIndex;
      const geometry = found.object.geometry;
      const id = this.ifcLoader.ifcManager.getExpressId(geometry, index);
  
      // Creates subset
      this.ifcLoader.ifcManager.createSubset({
        modelID: model.id,
        ids: [id],
        material: material,
        scene: this.scene,
        removePrevious: true,
      });
    } else {
      // Removes previous highlight
      this.ifcLoader.ifcManager.removeSubset(model.id, material);
    }
  }

  private setHoverSelection(): void {
    let preselectModel = { id: -1 };
    window.onmousemove = (event: MouseEvent) => this.highlight(event, this.preselectMat, preselectModel);
  }

}

