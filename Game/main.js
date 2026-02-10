const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { alpha: true });
const restartBtn = document.getElementById('restart');
const fuelFill = document.getElementById('fuel-fill');
const fuelText = document.getElementById('fuel-text');
const overlay = document.getElementById('overlay');

const ROWS = 8;
const COLS = 8;
const CELL = canvas.width / COLS;
const GEM_TYPES = 6;
const MATCH_MIN = 3;
const FUEL_PER_GEM = 6; // fuel per gem removed
const FUEL_GOAL = 100;

let grid = [];
let selected = null;
let animating = false;
let fuel = 0;
let running = true;

// colors and simple gem draw styles
const COLORS = ["#ff6b6b","#f39c12","#f6e58d","#6dd3ce","#4ecdc4","#5b8def","#9b59b6"];
// pick first GEM_TYPES
const TYPES = COLORS.slice(0, GEM_TYPES);

// initialize
function randType(){ return Math.floor(Math.random()*GEM_TYPES); }

function makeGrid(){
  grid = Array.from({length:ROWS}, () => Array.from({length:COLS}, ()=>({ t: randType(), id: Math.random() })));
  // remove any initial matches
  let changed = true;
  while(changed){
    changed = false;
    const matches = findMatches();
    if(matches.length){
      changed = true;
      for(const m of matches) for(const {r,c} of m) grid[r][c].t = randType();
    }
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // subtle board bg
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const x = c*CELL, y = r*CELL;
      const gem = grid[r][c];
      if(!gem) continue;
      // tile shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      roundRect(ctx,x+6,y+6,CELL-12,CELL-12,8);
      // gem circle
      ctx.beginPath();
      ctx.fillStyle = TYPES[gem.t];
      ctx.ellipse(x+CELL/2, y+CELL/2, CELL*0.32, CELL*0.32, 0, 0, Math.PI*2);
      ctx.fill();
      // highlight if selected
      if(selected && selected.r===r && selected.c===c){
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x+CELL/2, y+CELL/2, CELL*0.32, CELL*0.32, 0, 0, Math.PI*2);
        ctx.stroke();
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fill();
}

// find all matches (returns array of match arrays of {r,c})
function findMatches(){
  const matches = [];
  // rows
  for(let r=0;r<ROWS;r++){
    let run = [{r,c:0}];
    for(let c=1;c<COLS;c++){
      if(grid[r][c] && grid[r][c-1] && grid[r][c].t === grid[r][c-1].t){
        run.push({r,c});
      } else {
        if(run.length>=MATCH_MIN) matches.push([...run]);
        run = [{r,c}];
      }
    }
    if(run.length>=MATCH_MIN) matches.push([...run]);
  }
  // cols
  for(let c=0;c<COLS;c++){
    let run = [{r:0,c}];
    for(let r=1;r<ROWS;r++){
      if(grid[r][c] && grid[r-1][c] && grid[r][c].t === grid[r-1][c].t){
        run.push({r,c});
      } else {
        if(run.length>=MATCH_MIN) matches.push([...run]);
        run = [{r,c}];
      }
    }
    if(run.length>=MATCH_MIN) matches.push([...run]);
  }
  // dedupe overlapping by using key
  const seen = new Set();
  const out = [];
  for(const m of matches){
    const key = m.map(p=>p.r+','+p.c).sort().join('|');
    if(!seen.has(key)){ seen.add(key); out.push(m); }
  }
  return out;
}

function removeMatches(matches){
  let removed = 0;
  for(const m of matches){
    for(const {r,c} of m){
      if(grid[r][c]){
        grid[r][c] = null;
        removed++;
      }
    }
  }
  return removed;
}

function collapseGrid(){
  for(let c=0;c<COLS;c++){
    let write = ROWS-1;
    for(let r=ROWS-1;r>=0;r--){
      if(grid[r][c]){
        if(write!==r){
          grid[write][c] = grid[r][c];
          grid[r][c] = null;
        }
        write--;
      }
    }
    for(let r=write;r>=0;r--){
      grid[r][c] = { t: randType(), id: Math.random() };
    }
  }
}

function swap(a,b){
  const tmp = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = tmp;
}

function adjacent(a,b){
  const dr = Math.abs(a.r-b.r), dc = Math.abs(a.c-b.c);
  return (dr+dc)===1;
}

function attemptSwap(a,b){
  if(animating || !adjacent(a,b)) return;
  animating = true;
  swap(a,b);
  const matches = findMatches();
  if(matches.length){
    handleMatches(matches);
  } else {
    // revert after tiny delay for feedback
    setTimeout(()=>{
      swap(a,b);
      animating = false;
      draw();
    }, 180);
  }
}

function handleMatches(matches){
  const removed = removeMatches(matches);
  gainFuel(removed * FUEL_PER_GEM);
  draw();
  setTimeout(()=>{
    collapseGrid();
    // after collapse, look for chain matches
    const more = findMatches();
    if(more.length){
      setTimeout(()=>handleMatches(more), 160);
    } else {
      animating = false;
      draw();
    }
    draw();
  },160);
}

function gainFuel(n){
  fuel = Math.min(FUEL_GOAL, fuel + n);
  updateFuelUI();
  if(fuel >= FUEL_GOAL) levelComplete();
}

function updateFuelUI(){
  const pct = Math.round((fuel / FUEL_GOAL) * 100);
  fuelFill.style.width = pct+'%';
  fuelText.textContent = `${fuel} / ${FUEL_GOAL}`;
}

function levelComplete(){
  running = false;
  overlay.hidden = false;
  overlay.textContent = "Level complete — Drone fueled!";
}

function restart(){
  running = true;
  overlay.hidden = true;
  fuel = 0;
  updateFuelUI();
  selected = null;
  animating = false;
  makeGrid();
  draw();
}

// input handling (touch + mouse)
function posToCell(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width/rect.width);
  const y = (clientY - rect.top) * (canvas.height/rect.height);
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if(r<0||r>=ROWS||c<0||c>=COLS) return null;
  return {r,c};
}

let dragStart = null;
let pointerActive = false;

canvas.addEventListener('pointerdown', (e)=>{
  if(!running || animating) return;
  const cell = posToCell(e.clientX, e.clientY);
  if(!cell) return;
  selected = cell;
  dragStart = {x: e.clientX, y: e.clientY, cell};
  pointerActive = true;
  canvas.setPointerCapture(e.pointerId);
  draw();
});

canvas.addEventListener('pointermove', (e)=>{
  if(!pointerActive || !dragStart) return;
  // detect swipe beyond threshold to adjacent cell
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const thresh = Math.max(12, CELL * 0.25); // small threshold but responsive
  if(Math.hypot(dx,dy) < thresh) return;
  // determine primary direction
  const primary = Math.abs(dx) > Math.abs(dy) ? (dx>0 ? 'right' : 'left') : (dy>0 ? 'down' : 'up');
  const src = dragStart.cell;
  let tgt = {r: src.r, c: src.c};
  if(primary === 'right') tgt.c = src.c + 1;
  if(primary === 'left') tgt.c = src.c - 1;
  if(primary === 'down') tgt.r = src.r + 1;
  if(primary === 'up') tgt.r = src.r - 1;
  if(tgt.r<0||tgt.r>=ROWS||tgt.c<0||tgt.c>=COLS) return;
  // attempt swap and end drag
  attemptSwap(src, tgt);
  selected = null;
  dragStart = null;
  pointerActive = false;
});

canvas.addEventListener('pointerup', (e)=>{
  canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);
  pointerActive = false;
  dragStart = null;
  if(!running || animating) { selected = null; draw(); return; }
  const cell = posToCell(e.clientX, e.clientY);
  if(!cell){ selected=null; draw(); return; }
  if(selected){
    if(selected.r===cell.r && selected.c===cell.c){
      // tap same cell -> clear selection
      selected = null;
      draw();
    } else {
      attemptSwap(selected, cell);
      selected = null;
      setTimeout(draw, 40);
    }
  }
});

canvas.addEventListener('pointercancel', ()=>{ selected=null; dragStart=null; pointerActive=false; draw(); });

restartBtn.addEventListener('click', restart);

// initialize and start
makeGrid();
updateFuelUI();
draw();

// keyboard focus + WASD/arrow controls
let focus = {r:Math.floor(ROWS/2), c:Math.floor(COLS/2)};

function moveFocus(dir){
  const prev = {r: focus.r, c: focus.c};
  if(dir === 'up' && focus.r > 0) focus.r--;
  if(dir === 'down' && focus.r < ROWS - 1) focus.r++;
  if(dir === 'left' && focus.c > 0) focus.c--;
  if(dir === 'right' && focus.c < COLS - 1) focus.c++;
  return prev;
}

window.addEventListener('keydown', (e)=>{
  if(!running) return;
  const key = e.key.toLowerCase();
  const dirKeys = {
    'arrowup':'up','arrowdown':'down','arrowleft':'left','arrowright':'right',
    'w':'up','s':'down','a':'left','d':'right'
  };
  if(dirKeys[key]){
    e.preventDefault();
    const prev = moveFocus(dirKeys[key]);
    // if there's a selected cell and it's adjacent to the new focus, swap
    if(selected && !(selected.r === focus.r && selected.c === focus.c)){
      if(adjacent(selected, focus)){
        attemptSwap(selected, focus);
        selected = null;
      } else {
        // move selection to new focus
        selected = {r: focus.r, c: focus.c};
      }
    } else {
      // if nothing selected, set selection to prev (allow quick swap by moving)
      if(selected === null){
        // set selected to previous focus so next move can swap
        selected = prev;
        // if new focus adjacent to selected, perform swap immediately
        if(adjacent(selected, focus)){
          attemptSwap(selected, focus);
          selected = null;
        }
      } else {
        selected = {r: focus.r, c: focus.c};
      }
    }
    draw();
  } else if(key === 'enter' || key === ' '){
    // clear selection
    selected = null;
    draw();
  }
});