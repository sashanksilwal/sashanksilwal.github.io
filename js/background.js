// took inspiration from: https://www.youtube.com/watch?v=H-9jCNhLe-Q
const particles =[];
let x1, x2, x3, x4,x5,x6,x7,x8, y1, y2, y3, y4, y5,y6, y7,y8;

function setup(){
    let cnv = createCanvas(window.innerWidth, window.innerHeight);
    cnv.parent('canvas1');
    const particlesLength = Math.floor(window.innerWidth/15);
    for (let i=0; i<particlesLength; i++){
        particles.push(new Particle());
    }
}

function draw(){
    background('255,255,255')
    particles.forEach((p, index)=>{
        p.update();
        p.draw();
        p.checkParticle(particles.slice(index));
    });
    // console.log(frameCount);
    
    //to change the position of the text after 60 frames
    if (frameCount % 80 == 0){
        x1= random(width*0.85, width*0.95);
        x2 = random(width*0.85, width*0.95);
        x3 = random(0,width*0.10);
        x6 = random(0,width*0.10);
        
       
        y1 = random(height);
        y2 = random(height);
        y3 = random(height);
        y6 = random(height);
        
        
    }
    if (frameCount % 60 == 0){
        x4 = random(0,width*0.10);
        x5=  random(width*0.95);
        x7 = random(0,width*0.80);
        x8 = random(0,width*0.70);

        y4 = random(height);
        y5 = random(height*0.85,height*0.98);
        y7 = random(height*0.85);
        y8 = random(height*0.95);
    }
        textSize(32);
        fill('rgba(70, 204, 204, 0.5)')
        text("Python", x1, y1, 70, 80);
        text("React", x2, y2, 70, 80);
        text("JavaScript", x3, y3, 70, 80);
        text("Redux", x4, y4, 70, 80);
         text("Swift", x5, y5, 70, 80);
         text("Node.js", x6, y6, 70, 80);
         text("Matplotlib", x7, y7, 70, 80);
         text("Numpy", x8, y8, 70, 80);
}

class Particle{
    constructor(){
        //position
        this.pos = createVector(random(width), random(height));
        //velocity
        this.vel = createVector(random(-2,2), random(-2, 2));
        //size
        this.size = 10;
    }
    // update the movements bu adding velocity
    update(){
        this.pos.add(this.vel);
        this.edges();
    }

    //draw single particle 
    draw(){
        noStroke();
        fill('rgba(0,0,0,0.3)');
        circle(this.pos.x, this.pos.y, this.size);
    }

    //detect edges
    edges(){
        if(this.pos.x< 0 || this.pos.x>width){
            this.vel.x *= -1;
        }
        if(this.pos.y< 0 || this.pos.y>height){
            this.vel.y *= -1;
        }
    }
    //Connect the particles
    checkParticle(particles){
        particles.forEach(particle =>{
            const d = dist(this.pos.x, this.pos.y, particle.pos.x, particle.pos.y);
            if (d<120){
                stroke('rgba(0,0,0,0.3)')
                line(this.pos.x, this.pos.y, particle.pos.x, particle.pos.y);

            }
        });
    }
}