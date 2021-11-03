const _ctx = document.querySelector("#canvas").getContext("2d");

const _fileInput = document.querySelector('#file');
document.querySelector('#file').addEventListener('change', _loadFile.bind(this), false);
_ctx.canvas.addEventListener('click', () => _fileInput.click(), false);
const w = 400;
const h = 300;
_ctx.font="24px arial";_ctx.textAlign="center";_ctx.lineJoin="round"; 
_ctx.canvas.width = w;
_ctx.canvas.height = h;


_ctx.fillStyle = 'rgba(255,255,255,.5)';
_ctx.fillRect(0, 0, w, h);

function _loadFile (evt) {
    const file = evt.target.files[0];
    const obj = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = obj;

    // use requestAnimationFrame when doing any form of animation via javascript
    window.requestAnimationFrame(draw);
    function draw(){

        view.canvasDefault(); // set default transform to clear screen
        // _ctx.imageSmoothingEnabled = false;
        _ctx.fillStyle = "white";
        _ctx.fillRect(0, 0, w, h);
    
    
        //scale image in imgHolder to fit canvas siae
        const scale = Math.max(w / img.width, h / img.height);
        const x = (img.width * scale) + (w * scale) / w;
        const y = (img.height * scale) + (h * scale) / h;
    
        view.apply(); 
        _ctx.drawImage(img, 0,0, img.width, img.height, 0, 0, x, y);
        view.setBounds(0,0,x,y);
        view.canvasDefault();
    
        requestAnimationFrame(draw);
        if(mouse.overId === "canvas"){ //and image is present
            //change cursor
            canvas.style.cursor = mouse.button ? "none" : "move";
            //prevent page scrolling
        }else{
            canvas.style.cursor = "default";
        }
    }
}

// zoom and pan
const view = (()=>{
    const m = [1,0,0,1,0,0];    // matrix: current view transform
    const im = [1,0,0,1,0,0];   // inverse-matrix: current inverse view transform
    let scale = 1;              // initial scale
    const bounds = {
        top : 0,
        left : 0,
        right : w,
        bottom : h,
    }
    let useConstraint = true;   // keep bounds within current context
    
    let maxScale = 1;
    const wp1 = {x :0, y : 0};  //workpoint1
    const wp2 = {x :0, y : 0};  //workpoint2
    const pos = {               // current position of origin
        x : 0,
        y : 0,
    }
    let dirty = true;
    const API = {
        canvasDefault () { _ctx.setTransform(1,0,0,1,0,0) },
        apply(){
            if(dirty){ this.update() }
            _ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);
        },
        getScale () { return scale },
        getMaxScale () { return maxScale },
        m,  // expose the matrix
        im, // expose the inverse matrix
        update(){ // call to update transforms
            dirty = false;
            m[3] = m[0] = scale;
            m[1] = m[2] = 0;
            m[4] = pos.x;
            m[5] = pos.y;
            if(useConstraint){
                this.constrain();
            }
            this.invScale = 1 / scale;
            // calculate the inverse transformation
            let cross = m[0] * m[3] - m[1] * m[2];
            im[0] =  m[3] / cross;
            im[1] = -m[1] / cross;
            im[2] = -m[2] / cross;
            im[3] =  m[0] / cross;
        },
        constrain(){
            maxScale = Math.max(
                _ctx.canvas.width / (bounds.right - bounds.left) ,
                _ctx.canvas.height / (bounds.bottom - bounds.top)
            );
            if (scale < maxScale) {  m[0] = m[3] = scale = maxScale }
            wp1.x = bounds.left;
            wp1.y = bounds.top;
            this.toScreen(wp1,wp2);
            if (wp2.x > 0) { m[4] = pos.x -= wp2.x }
            if (wp2.y > 0) { m[5] = pos.y -= wp2.y }
            wp1.x = bounds.right;
            wp1.y = bounds.bottom;
            this.toScreen(wp1,wp2);
            if (wp2.x < _ctx.canvas.width) { m[4] = (pos.x -= wp2.x -  _ctx.canvas.width) }
            if (wp2.y < _ctx.canvas.height) { m[5] = (pos.y -= wp2.y -  _ctx.canvas.height) }
        
        },
        toWorld(from,point = {}){  // convert screen to world coords
            let xx, yy;
            if(dirty){ this.update() }
            xx = from.x - m[4];     
            yy = from.y - m[5];     
            point.x = xx * im[0] + yy * im[2]; 
            point.y = xx * im[1] + yy * im[3];
            return point;
        },        
        toScreen(from,point = {}){  // convert world coords to screen coords
            if(dirty){ this.update() }
            point.x =  from.x * m[0] + from.y * m[2] + m[4]; 
            point.y = from.x * m[1] + from.y * m[3] + m[5];
            return point;
        },        
        scaleAt(at, amount){ // at in screen coords
            if(dirty){ this.update() }
            scale *= amount;
            pos.x = at.x - (at.x - pos.x) * amount;
            pos.y = at.y - (at.y - pos.y) * amount;            
            dirty = true;
        },
        move(x,y){  // move is in screen coords
            pos.x += x;
            pos.y += y;
            dirty = true;
        },
        setBounds(top,left,right,bottom){
            bounds.top = top;
            bounds.left = left;
            bounds.right = right;
            bounds.bottom = bottom;
            useConstraint = true;
            dirty = true;
        }
    };
    return API;
})();
// view.setBounds(0,0,width,height)

// mouse position state
const mouse = {
    pos : {x : 0, y : 0},
    worldPos : {x : 0, y : 0},
    posLast : {x : 0, y : 0},
    button : false,
    overId : "",                // id of element mouse is over
    dragging : false,
    whichWheel : -1,            // first wheel evt will get the wheel
    wheel : 0,
}

//read mouse events
// allows mouseup evt to be heard no matter where mouse has moved to
"mousemove,mousedown,mouseup,mousewheel,wheel,DOMMouseScroll".split(",")
    .forEach(eventName=>document.addEventListener(eventName,mouseEvent));
function mouseEvent (evt){
    mouse.overId = evt.target.id;
    if(evt.target.id === "canvas" || mouse.dragging){ // only interested in canvas mouse events including drag evt started on the canvas.

        mouse.posLast.x = mouse.pos.x;
        mouse.posLast.y = mouse.pos.y;    
        mouse.pos.x = evt.clientX - canvas.offsetLeft;
        mouse.pos.y = evt.clientY - canvas.offsetTop;    
        view.toWorld(mouse.pos, mouse.worldPos); // gets the world coords (where on canvas 2 the mouse is)
        if (evt.type === "mousemove"){
            if(mouse.button){
                view.move(
                   mouse.pos.x - mouse.posLast.x,
                   mouse.pos.y - mouse.posLast.y
                )
            }
        } else if (evt.type === "mousedown") { mouse.button = true; mouse.dragging = true }        
        else if (evt.type === "mouseup") { mouse.button = false; mouse.dragging = false }
        else if(evt.type === "mousewheel" && (mouse.whichWheel === 1 || mouse.whichWheel === -1)){
            mouse.whichWheel = 1;
            mouse.wheel = evt.wheelDelta;
        }else if(evt.type === "wheel" && (mouse.whichWheel === 2 || mouse.whichWheel === -1)){
            mouse.whichWheel = 2;
            mouse.wheel = -evt.deltaY;
        }else if(evt.type === "DOMMouseScroll" && (mouse.whichWheel === 3 || mouse.whichWheel === -1)){
            mouse.whichWheel = 3;
            mouse.wheel = -evt.detail;
        }

        if(mouse.wheel !== 0){
            // evt.preventDefault();
            view.scaleAt(mouse.pos, Math.exp((mouse.wheel / 120) * 0.2)); //zoom intensity = 0.2
            mouse.wheel = 0;
        }
    }
}
