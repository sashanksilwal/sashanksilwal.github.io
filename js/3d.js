let scene, renderer, camera, container;
let geometry, material, box;

container = document.querySelector(".canvas");

function init(){
    scene = new THREE.Scene();
    var gui = new dat.GUI();

    // scene.fog = new THREE.FogExp2(0xffffff , 0.2);
    box = getBox(2,2,2);
    var plane = getPlane(4);
    var light = getPointLight(1);
    var sphere = getSphere(0.05);


    plane.rotation.y = Math.PI/2 ;
    light.position.x = 1.7;
    light.intensity = 2;
    gui.add(light, "intensity");
    gui.add(light.position, "z")

    
    scene.add(plane);
    scene.add(box);
    light.add(sphere);
    scene.add(light);
    

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight,0.1,1000);
    camera.position.set(1, 2, 5);
    camera.lookAt(new THREE.Vector3(0,0,0));

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor("#ffffff");

    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 8;
    controls.maxDistance = 10;

    update(renderer, scene, camera, controls);
    return scene;
}

function getBox(w, h, d){
    geometry = new THREE.BoxGeometry(w,h,d);
    material = new THREE.MeshPhongMaterial({
        color: 0x00ff00
    });

    var mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function getPlane(size){
    geometry = new THREE.PlaneGeometry(size, size);
    material = new THREE.MeshBasicMaterial({
        color: 0xff0000, 
        side: THREE.DoubleSize
    });

    var mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function getPointLight(intensity){
    var light = new THREE.PointLight(0xffffff, intensity);
    return light;
}
function getSphere(radius){
    var geometry = new THREE.SphereGeometry(radius, 24, 24);
    var material = new THREE.MeshBasicMaterial({
        color: 0xbbbbbb
    });

    var mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  
  window.addEventListener("resize", onWindowResize);
 
  
function update(renderer, scene, camera, controls){
    box.rotation.x += 0.005;
    box.rotation.z += 0.02;
    renderer.render(scene, camera);
    controls.update();

    requestAnimationFrame(function(){update(renderer, scene, camera, controls)})

}

var scene1 = init();








