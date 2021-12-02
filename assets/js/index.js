

class Vector {
  /**
   * @param {number} x 
   * @param {number} y 
   */
  constructor(x, y) {
    this._x = `${x}`;
    this._y = `${y}`;
  }

  get x() {
    return parseFloat(this._x);
  }

  get y() {
    return parseFloat(this._y);
  }

  set x(setx) {
    this._x = `${setx}`
  }

  set y(setY) {
    this._y = `${setY}`
  }

  /**
   * @param {Vector} other 
   * @returns {Vector} 
   */
  plus(other) {
    return new Vector(parseFloat(this.x) + other.x, parseFloat(this.y) + other.y);
  }

  /**
   * @param {Vector} factor 
   * @returns {Vector}
   */
  times(factor) {
    return new Vector(parseFloat(this.x) * factor, parseFloat(this.y) * factor);
  }
}

class Player {
  /**
   * @param {Vector} pos Player`s position
   */
  constructor(pos) {
    this.type = 'player';
    this.pos = pos.plus(new Vector(0, -0.5));
    this.size = new Vector(0.8, 1.5);
    this.speed = new Vector(0, 0);
  }

  /**
   * #
   * @param {*} step 
   * @param {Level} level Current level
   * @param {*} keys 
   */
  moveX(step, level, keys) {
    this.speed.x = 0;
    if (keys.left) this.speed.x -= playerXSpeed;
    if (keys.right) this.speed.x += playerXSpeed;
  
    var motion = new Vector(this.speed.x * step, 0);
    var newPos = this.pos.plus(motion);
    var obstacle = level.obstacleAt(newPos, this.size);
    if (obstacle) {
      level.playerTouched(obstacle);
    } else {
      this.pos = newPos;
    }
  }

  /**
   * 
   * @param {*} step 
   * @param {Level} level 
   * @param {*} keys 
   */
  moveY(step, level, keys) {
    this.speed.y += step * gravity;
    var motion = new Vector(0, this.speed.y * step);
    var newPos = this.pos.plus(motion);
    var obstacle = level.obstacleAt(newPos, this.size);
    if (obstacle) {
      level.playerTouched(obstacle);
      if (keys.up && this.speed.y > 0)
        this.speed.y = -jumpSpeed;
      else
        this.speed.y = 0;
    } else {
      this.pos = newPos;
    }
  }

  /**
   * @param {*} step 
   * @param {Level} level 
   * @param {*} keys 
   */
  act(step, level, keys) {
    this.moveX(step, level, keys);
    this.moveY(step, level, keys);
  
    const otherActor = level.actorAt(this);
    if (otherActor) {
      level.playerTouched(otherActor.type, otherActor);
    }
  
    // Losing animation
    if (level.status == "lost") {
      this.pos.y += step;
      this.size.y -= step;
    }
  }
}

class Arrow {
  constructor(pos, direction) {
    this.id = Date.now();
    this.pos = pos;
    this.type = 'arrow';
    this.speed = new Vector(direction > 0 ? 3 : -3, 0);
    this.size = new Vector(1, 0.5);
  }

  act(step, level) {
    const newPos = this.pos.plus(this.speed.times(step));
    if (level.obstacleAt(newPos, this.size)) {
      level.removeActor(this.id);
    } else {
      this.pos = newPos;
    }
  }
}

class Enemy {
  constructor(pos) {
    this.id = Date.now();
    this.pos = pos.plus(new Vector(0, -0.5));
    this.type = 'enemy';
    this.speed = new Vector(1, 0);
    this.size = new Vector(0.8, 1.5);
    this.interval = null;
  }

  changeDirection() {
    this.speed = this.speed.times(-1);
  }

  shoot(level) {
    level.addActor(new Arrow(this.pos, this.speed.x));
  }

  act(step, level) {
    const newPos = this.pos.plus(this.speed.times(step));
    if (level.obstacleAt(newPos, this.size) || !level.safeGroundAt(new Vector(this.speed.x > 0 ? this.pos.x + this.size.x : this.pos.x - this.size.x, this.pos.y), this.size)) {
      this.changeDirection();
    } else {
      this.pos = newPos;
    }
    
    if (level.isPlayerInEyeshot(this.pos, this.speed.x) && !this.interval) {
      console.log('see you')
      this.shoot(level);
      this.interval = setInterval(() =>{
        this.shoot(level);
        clearInterval(this.interval);
        this.interval = null;
      }, 2000);
    }
  }
}

class Lava {
  constructor(pos, ch) {
    this.type = 'lava';
    this.pos = pos;
    this.size = new Vector(1, 1);
    if (ch == "=") {
      this.speed = new Vector(2, 0);
    } else if (ch == "|") {
      this.speed = new Vector(0, 2);
    } else if (ch == "v") {
      this.speed = new Vector(0, 3);
      this.repeatPos = pos;
    }
  }

  act(step, level) {
    var newPos = this.pos.plus(this.speed.times(step));
    if (!level.obstacleAt(newPos, this.size))
      this.pos = newPos;
    else if (this.repeatPos)
      this.pos = this.repeatPos;
    else
      this.speed = this.speed.times(-1);
  }
}

class Coin {
  /**
   * @param {Vector} pos Position
   */
  constructor(pos) {
    this.type = 'coin';
    this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1));
    this.size = new Vector(0.5, 0.6);
    this.wobble = Math.random() * Math.PI * 2;
  }

  /**
   * 
   * @param {*} step 
   */
  act(step) {
    this.wobble += step * wobbleSpeed;
    var wobblePos = Math.sin(this.wobble) * wobbleDist;
    this.pos = this.basePos.plus(new Vector(0, wobblePos));
  }
}

const actorChars = {
  "@": Player,
  "o": Coin,
  "=": Lava,
  "|": Lava,
  "v": Lava,
  "$": Enemy,
};

class Level {
  /**
   * @param {string[]} plan Level plan
   */
  constructor(plan) {
    this.width = plan[0].length;
    this.height = plan.length;
    this.grid = [];
    this.actors = [];

    for (var y = 0; y < this.height; y++) {
      var line = plan[y], gridLine = [];
      for (var x = 0; x < this.width; x++) {
        var ch = line[x], fieldType = null;
        var Actor = actorChars[ch];
        if (Actor)
          this.actors.push(new Actor(new Vector(x, y), ch));
        else if (ch == "x")
          fieldType = "wall";
        else if (ch == "!")
          fieldType = "lava";
        gridLine.push(fieldType);
      }
      this.grid.push(gridLine);
    }
  
    this.player = this.actors.filter(a => a.type == "player")[0];
    this.status = this.finishDelay = null;
  }

  addActor(actor) {
    this.actors.push(actor);
  }

  removeActor(id) {
    this.actors = this.actors.filter(a => a.id !== id);
  }

  /**
   * Check if there is a line between position and player
   * @param {Vector} pos1
   * @returns {boolean}
   */
  isPlayerInEyeshot(pos1, direction) {
    const player = this.actors.filter(a => a.type == 'player')[0];
    const startY = pos1.y - (player.size.y / 2);
    const endY = (player.size.y / 2) + pos1.y;
    const byX = direction > 0 ? player.pos.x > pos1.x : player.pos.x < pos1.x;
    const ByY = player.pos.y > startY && player.pos.y < endY;
    
    let obstacleBetween = false;
    for (var y = Math.floor(startY); y < Math.ceil(endY); y++) {
      for (var x = Math.floor(direction > 0 ? pos1.x : player.pos.x); x < Math.ceil(direction > 0 ? player.pos.x : pos1.x); x++) {
        if (this.grid[y][x]) obstacleBetween = true;
      }
    }

    
    return byX && ByY && !obstacleBetween;
  }

  safeGroundAt(pos, size) {
    return this.obstacleAt(new Vector(pos.x, pos.y + 1), size) === 'wall';
  }

  /**
   * @returns {boolean}
   */
  isFinished() {
    return this.status != null && this.finishDelay < 0;
  }

  /**
   * @param {Vector} pos 
   * @param {*} size
   * @returns {string} Type of obstacle
   */
  obstacleAt(pos, size) {
    var xStart = Math.floor(pos.x);
    var xEnd = Math.ceil(pos.x + size.x);
    var yStart = Math.floor(pos.y);
    var yEnd = Math.ceil(pos.y + size.y);
  
    if (xStart < 0 || xEnd > this.width || yStart < 0)
      return "wall";
    if (yEnd > this.height)
      return "lava";
    for (var y = yStart; y < yEnd; y++) {
      for (var x = xStart; x < xEnd; x++) {
        var fieldType = this.grid[y][x];
        if (fieldType) return fieldType;
      }
    }
  }

  /**
   * @param {Actor} actor 
   * @returns {Actor}
   */
  actorAt(actor) {
    for (var i = 0; i < this.actors.length; i++) {
      var other = this.actors[i];
      if (other != actor &&
          actor.pos.x + actor.size.x > other.pos.x &&
          actor.pos.x < other.pos.x + other.size.x &&
          actor.pos.y + actor.size.y > other.pos.y &&
          actor.pos.y < other.pos.y + other.size.y
      ) {  
        return other;
      }
    }
  }

  /**
   * @param {*} step 
   * @param {*} keys 
   */
  animate(step, keys) {
    if (this.status != null)
      this.finishDelay -= step;
  
    while (step > 0) {
      var thisStep = Math.min(step, maxStep);
      this.actors.forEach(function(actor) {
        actor.act(thisStep, this, keys);
      }, this);
      step -= thisStep;
    }
  }

  /**
   * @param {string} type Obstacle type
   * @param {Actor} actor 
   */
  playerTouched(type, actor) {
    if (this.status) {
      return;
    }

    if (type === "lava" || type === 'arrow') {
      this.status = "lost";
      this.finishDelay = 1;
    } else if (type == "coin") {
      this.actors = this.actors.filter(function(other) {
        return other != actor;
      });
      if (!this.actors.some(function(actor) {
        return actor.type == "coin";
      })) {
        this.status = "won";
        this.finishDelay = 1;
      }
    }
  }
}

/**
 * Create DOM Element
 * @param {string} name 
 * @param {string|undefined} className 
 * @param {string|undefined} id 
 * @returns {HTMLElement}
 */
function elt(name, className, id) {
  var elt = document.createElement(name);
  if (className) elt.className = className;
  if (id) elt.id = id;

  return elt;
}

class DOMDisplay {
  /**
   * @param {Element} parent Root element of game field
   * @param {Level} level Current game level
   */
  constructor(parent, level) {
    this.wrap = parent.appendChild(elt("div", "game"));
    this.level = level;
  
    this.wrap.appendChild(this.drawBackground());
    this.actorLayer = null;
    this.drawFrame();
  }

  /**
   * 
   * @returns 
   */
  drawBackground() {
    var table = elt("table", "background");
    table.style.width = this.level.width * scale + "px";
    this.level.grid.forEach(function(row) {
      var rowElt = table.appendChild(elt("tr"));
      rowElt.style.height = scale + "px";
      row.forEach(function(type) {
        rowElt.appendChild(elt("td", type));
      });
    });
    return table;
  }

  /**
   * 
   * @returns {}
   */
  drawActors() {
    var wrap = elt("div");
    this.level.actors.forEach(function(actor) {
      var rect = wrap.appendChild(elt("div",
                                      "actor " + actor.type));
      rect.style.width = actor.size.x * scale + "px";
      rect.style.height = actor.size.y * scale + "px";
      rect.style.left = actor.pos.x * scale + "px";
      rect.style.top = actor.pos.y * scale + "px";
    });
    return wrap;
  }
  
  drawFrame() {
    if (this.actorLayer)
      this.wrap.removeChild(this.actorLayer);
    this.actorLayer = this.wrap.appendChild(this.drawActors());
    this.wrap.className = "game " + (this.level.status || "");
    this.scrollPlayerIntoView();
  }

  /**
   * 
   */
  scrollPlayerIntoView() {
    var width = this.wrap.clientWidth;
    var height = this.wrap.clientHeight;
    var margin = width / 3;
  
    // The viewport
    var left = this.wrap.scrollLeft, right = left + width;
    var top = this.wrap.scrollTop, bottom = top + height;
  
    var player = this.level.player;
    var center = player.pos.plus(player.size.times(0.5))
                   .times(scale);
  
    if (center.x < left + margin)
      this.wrap.scrollLeft = center.x - margin;
    else if (center.x > right - margin)
      this.wrap.scrollLeft = center.x + margin - width;
    if (center.y < top + margin)
      this.wrap.scrollTop = center.y - margin;
    else if (center.y > bottom - margin)
      this.wrap.scrollTop = center.y + margin - height;
  }
  
  clear() {
    this.wrap.parentNode.removeChild(this.wrap);
  }
}

var scale = 20;
var maxStep = 0.05;
var wobbleSpeed = 8, wobbleDist = 0.07;
var playerXSpeed = 7;
var gravity = 30;
var jumpSpeed = 17;

const INITIAL_HEALTH = 3;

const trackKeys = pressedModeCodes => {
  var tracked = Object.create(null);
  function handler(event) {
    if (pressedModeCodes.hasOwnProperty(event.keyCode)) {
      var down = event.type == "keydown";
      tracked[pressedModeCodes[event.keyCode]] = down;
      event.preventDefault();
    }
  }
  addEventListener("keydown", handler);
  addEventListener("keyup", handler);

  return tracked;
}

const trackIfPressed = {37: "left", 38: "up", 39: "right"};
var arrows = trackKeys(trackIfPressed);

function runAnimation(frameFunc) {
  var lastTime = null;
  function frame(time) {
    var stop = false;
    if (lastTime != null) {
      var timeStep = Math.min(time - lastTime, 100) / 1000;
      stop = frameFunc(timeStep) === false;
    }
    lastTime = time;
    if (!stop)
      requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const pauseScreen = isEnabled => {
  document.querySelector('#pause-screen').style = `display:${isEnabled ? 'block' : 'none'}`;
}

/**
 * @param {Level} level 
 * @param {*} Display 
 * @param {function} andThen callback after level finished
 */
function runLevel(level, Display, andThen) {
  var display = new Display(document.body, level);
  let isPaused = false;

  const animate = () => runAnimation(step => {
    if (isPaused) {
      return false;
    }
    level.animate(step, arrows);
    display.drawFrame(step);
    if (level.isFinished()) {
      display.clear();
      if (andThen)
        andThen(level.status);
      return false;
    }
  });
  addEventListener('keydown', e => {
    if (e.keyCode === 27) {
      isPaused = !isPaused;
      pauseScreen(isPaused);
      !isPaused && animate();
    }
  })
  
  animate();
}

const playAgainScreen = className => {
  document.querySelector('#helper-screen .title').className = ' ';
  document.querySelector('#helper-screen div').classList.add('title', className);
  document.querySelector('#helper-screen').style = 'display:flex';
};

const Panel = (count, title) => {
  let block = document.querySelector('#health_block');
  if (block) {
    block.parentNode.removeChild(block);
  }

  if (!count) {
    return;
  }

  block = elt('div', 'panel', 'health_block');
  (new Array(count)).fill(0).forEach(() => block.appendChild(elt('span', 'health')));
  block.innerHTML += `<div class="level">Level ${title}</div>`
  document.body.appendChild(block);
};


/**
 * @param {string[][]} plans 
 * @param {*} Display
 */
const runGame = (plans, Display) => {
  let healthLevel = INITIAL_HEALTH;
  
  const startLevel = n => runLevel(new Level(plans[n]), Display, levelRunner(n));
  const levelRunner = n => status => {
    if (status == "lost") {
      healthLevel--;
      if (!healthLevel) {
        Panel(null);
        playAgainScreen('you-lose');
      } else {
        startLevel(healthLevel ? n : 0);
        Panel(healthLevel, healthLevel ? n + 1 : 1);
      }
    } else if (n < plans.length - 1) {
      startLevel(n + 1);
      Panel(healthLevel, n + 2);
    } else {
      playAgainScreen('you-win');
      Panel(null);
    }
  };

  startLevel(0);
  Panel(healthLevel, 1);
}