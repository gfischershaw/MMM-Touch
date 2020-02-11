var _log = function() {
  var context = "[TOUCH]";
  return Function.prototype.bind.call(console.log, console, context);
}()

var log = function() {
  //do nothing
}

Module.register("MMM-Touch", {
  defaults: {
    debug: false,
    useDisplay: true,
    threshold: {
      moment_ms: 1000 * 0.5, // TAP and SWIPE should be quicker than this.
      press_ms: 1000 * 3, // PRESS should be longer than this.
      move_px: 50, // MOVE and SWIPE should go further than this.
      pinch_px: 50, // Average of traveling distance of each finger should be more than this for PINCH
      rotate_dg: 20, // Average rotating angle of each finger should be more than this for ROTATE
    },
    defaultMode: "default",
    gestureCommands: {},
    onNotification: (commander, noti, payload, sender) => {}
  },

  start: function() {
    console.log(">", this.config)
    this.gesture = null
    this.curCommand = null
    this.useDisplay = this.config.useDisplay
    this.onNotification = this.config.onNotification
    if (this.config.debug) {
      log = _log
    }
    this.mode = this.config.defaultMode
    this.commands = {}
    console.log(this.config.gestureCommands)
    for(var mode in this.config.gestureCommands) {
      if (this.config.gestureCommands.hasOwnProperty(mode)) {
        var commands = this.config.gestureCommands[mode]
        for (var gest in commands) {
          if (commands.hasOwnProperty(gest)) {
            this.registerCommand(mode, gest, commands[gest])
          }
        }
      }
    }
    this.commanderCallbacks = {
      sendNotification: (noti, payload) => {
        this.sendNotification(noti, payload)
      },
      shellExec: (scr) => {
        if (!scr) return false
        this.sendSocketNotification("SHELL_EXEC", scr)
      },
      getModules: () => {
        return MM.getModules()
      },
      getMode: () => {
        return this.mode
      },
      setMode: (mode = null) => {
        return this.setMode(mode)
      },
      forceCommand: (mode, gestureObject) => {
        return this.forceCommand(mode, gestureObject)
      }
    }
  },

  getStyles: function() {
    return ["MMM-Touch.css"]
  },

  getDom: function() {
    var dom = document.createElement("div")
    dom.id = "TOUCH"
    if (!this.config.useDisplay) {
      dom.classList.add("hidden")
      return dom
    }

    var mode = document.createElement("div")
    mode.classList.add("mode")
    mode.innerHTML = this.mode
    var command = document.createElement("div")
    command.classList.add("command")
    if (this.curCommand) {
      command.classList.add("fired")
      command.innerHTML = this.curCommand
      this.curCommand = null
    }
    dom.appendChild(mode)
    dom.appendChild(command)
    return dom
  },

  registerCommand: function(mode, gest, func) {
    if (!this.commands.hasOwnProperty(mode)) {
      this.commands[mode] = {}
    }
    if (typeof func == "function") this.commands[mode][gest] = func
  },

  setMode: function(mode = null) {
    if (!mode) return false
    if (!this.commands.hasOwnProperty(mode)) return false
    this.mode = mode
    this.updateDom()
    return mode
  },

  notificationReceived: function (noti, payload, sender) {
    if (noti == "DOM_OBJECTS_CREATED") {
      if (this.gesture) {
        log("Already gesture engine is started.")
      } else {
        this.defineTouch()
      }
    }

    if (noti == "TOUCH_USE_DISPLAY") {
      this.useDisplay = payload
      this.updateDom()
    }

    if (noti == "TOUCH_GET_MODE") {
      if (typeof payload == "function") {
        payload(this.mode)
      }
    }

    if (noti == "TOUCH_SET_MODE") {
      if (payload.mode) {
        this.setMode(payload.mode)
      }
    }

    if (noti == "TOUCH_REGISTER_COMMAND") {
      this.registerCommand(payload.mode, payload.gesture, payload.func)
    }

    if (noti == "TOUCH_FORCE_COMMAND") {
      this.forceCommand(payload.mode, payload.gestureObject)
    }

    if (noti == "TOUCH_CANCEL") {
      this.gesture.cancel()
    }

    if (typeof this.onNotification == "function") {
      this.onNotification(new GestureCommander(this.commanderCallbacks), noti, payload, sender)
    }
  },

  defineTouch: function() {
    this.gesture = new Gesture(this.config.threshold)
    this.gesture
      .on("canceled", (res)=>{
        log("Canceled.")
      })
      .on(Gesture.EVENT.RECOGNIZED, (res)=>{
        log("Recognized:", res)
        this.doCommand(res)
      })
      .on(Gesture.EVENT.UNRECOGNIZED, (res)=>{
        log("Unecognized")
      })
  },

  forceCommand: function(mode, gestureObject) {
    return this.doCommand(gestureObject, mode)
  },

  doCommand: function(gest, mode=this.mode) {
    var command = gest.gesture + "_" + gest.fingers
    if (!this.commands.hasOwnProperty(mode)) return
    if (this.commands[mode].hasOwnProperty(command)) {
      this.curCommand = command
      this.commands[mode][command](new GestureCommander(this.commanderCallbacks), gest)
      this.updateDom()
    }
  }
})

class Gesture {
  static get EVENT() {
    return {
      "RECOGNIZED": "RECOGNIZED",
      "UNRECOGNIZED": "UNRECOGNIZED"
    }
  }

  static get GESTURE() {
    return {
      "ROTATE_CW": "ROTATE_CW",
      "ROTATE_CCW": "ROTATE_CCW",
      "MOVE_UP": "MOVE_UP",
      "MOVE_DOWN": "MOVE_DOWN",
      "MOVE_LEFT": "MOVE_LEFT",
      "MOVE_RIGHT": "MOVE_RIGHT",
      "PINCH_IN": "PINCH_IN",
      "PINCH_OUT": "PINCH_OUT",
      "PRESS": "PRESS",
      "SWIPE_UP": "SWIPE_UP",
      "SWIPE_DOWN": "SWIPE_DOWN",
      "SWIPE_LEFT": "SWIPE_LEFT",
      "SWIPE_RIGHT": "SWIPE_RIGHT",
      "TAP": "TAP",
      "UNRECOGNIZED": "UNRECOGNIZED"
    }
  }

  static get DIRECTION() {
    return {
      "NODIRECTION": "NODIRECTION",
      "UP": "UP",
      "DOWN" : "DOWN",
      "LEFT" : "LEFT",
      "RIGHT" : "RIGHT"
    }
  }

  constructor(threshold) {
    this._events = {}
    this._threshold = threshold
    this._dom = document.body
    var handlerTouch = (evt) => {
      this._handlerTouch("touch", evt)
    }
    var handlerRelease = (evt) => {
      this._handlerRelease(evt)
    }
    var handlerCancel = (evt) => {
      this._handlerCancel(evt)
    }
    var handlerMove = (evt) => {
      this._handlerTouch("move", evt)
    }
    this._dom.addEventListener("touchstart", handlerTouch)
    this._dom.addEventListener("touchend", handlerRelease)
    this._dom.addEventListener("touchmove", handlerMove)
    this._dom.addEventListener("touchcancel", handlerCancel)
    this._rec = null
    this.ready()
  }
/** EventEmitter part **/
  _getEventListByName(eventName){
    if(typeof this._events[eventName] === 'undefined'){
      this._events[eventName] = new Set()
    }
    return this._events[eventName]
  }

  on(eventName, fn){
    this._getEventListByName(eventName).add(fn)
    return this
  }

  once(eventName, fn){
    const self = this
    const onceFn = function(...args){
      self.removeListener(eventName, onceFn)
      fn.apply(self, args)
    }
    this.on(eventName, onceFn)
    return this
  }

  emit(eventName, ...args){
    log("EventEmit:", eventName)
    this._getEventListByName(eventName).forEach(function(fn){
      fn.apply(this,args)
    }.bind(this))
  }

  removeListener(eventName, fn){
    this._getEventListByName(eventName).delete(fn);
  }

/** Gesture Handler part **/

  cancel() {
    this.emit(Gesture.EVENT.UNRECOGNIZED, null)
    this._init()
  }

  ready() {
    this._init()
  }

  _init() {
    log("New Gesture")
    this._rec = {
      startFromTouch: false,
      firstTime: null,
      lastTime: null,
      fingerIndexSet: new Set(),
      pressingIndexSet: new Set(),
      startPoints: {},
      curPoints: {},
    }
  }

  _handlerTouch(type, evt) {
    var r = this._rec
    var touches = evt.changedTouches
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      r.pressingIndexSet.add(id) //Anyhow, pressed.
      r.lastTime = evt.timeStamp
      if (!r.startPoints.hasOwnProperty(id)) {
        if (Object.keys(r.startPoints).length == 0) {
          r.firstTime = evt.timeStamp
        }
        r.startPoints[id] = {
          x: t.pageX,
          y: t.pageY,
        }
      }
      r.curPoints[id] = {
        x: t.pageX,
        y: t.pageY
      }
      if (type == "touch") {
        if (r.fingerIndexSet.has(id)) {
          //already registered. how?
        } else {
          if (r.pressingIndexSet.size == 1) {
            r.startFromTouch = true
          }
          r.fingerIndexSet.add(id)
        }
      } else {
        // when moving. (pressing)
      }
    }
    this._recognize()
  }

  _handlerRelease(evt) {
    var r = this._rec
    var touches = evt.changedTouches
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      r.pressingIndexSet.delete(id)
      r.curPoints[id] = {
        x: t.pageX,
        y: t.pageY
      }
      if (r.pressingIndexSet.size == 0) {
        r.lastTime = evt.timeStamp
      }
    }
    this._recognize()
  }

  _recognize() {
    var r = this._rec
    var sc = this._getCentroid(r.startPoints)
    var ec = this._getCentroid(r.curPoints)
    var dist = this._getDistance(sc, ec)
    var dir = this._getDirection(sc, ec)
    var dur = this._getDuration()
    if (!sc || !ec) return false
    var result = null
    if (result = this._isTapped(dist, dir, dur)) {}
    else if (result = this._isSwiped(dist, dir, dur)) {}
    else if (sc.count !== ec.count) { return false }
    else if (result = this._isRotated(dist, dir, dur)) {}
    else if (result = this._isPinched(dist, dir, dur)) {}
    else if (result = this._isMoved(dist, dir, dur)) {}
    else if (result = this._isPressed(dist, dir, dur)) {}
    else {
      // nothing happened. but should check current pressing is zero
      if (r.pressingIndexSet.size == 0) {
        this.emit(Gesture.EVENT.UNRECOGNIZED, null)
        this._init()
      }
      return false
    }
    var temp = {
      distance: dist,
      direction: dir,
      duration: dur,
    }
    this.emit(Gesture.EVENT.RECOGNIZED, Object.assign({}, temp, result))
    this._init()
    return true
  }

  _getCentroid(points) {
    var count = 0
    var x = 0
    var y = 0
    for (var i in points) {
      if (points.hasOwnProperty(i)) {
        count++
        x += points[i].x
        y += points[i].y
      }
    }
    if (count > 0) {
      return {
        xSum: x,
        ySum: y,
        x: x / count,
        y: y / count,
        count: count
      }
    } else {
      return false
    }
  }

  _getDuration() {
    return this._rec.lastTime - this._rec.firstTime
  }

  _getDistance(sp, ep) {
    var x = sp.x - ep.x
    var y = sp.y - ep.y
    return Math.hypot(x, y)
  }

  _getDirection (sp, ep) {
    var moveX = (ep.x - sp.x)
    var moveY = (ep.y - sp.y)
    if (Math.abs(moveX) >= Math.abs(moveY)) {
      if (moveX >= 0) {
        return Gesture.DIRECTION.RIGHT
      } else {
        return Gesture.DIRECTION.LEFT
      }
    } else {
      if (moveY >= 0) {
        return Gesture.DIRECTION.DOWN
      } else {
        return Gesture.DIRECTION.UP
      }
    }
  }

  _getDegree(sp, ep) {
    return Math.atan2(ep.y - sp.y, ep.x - sp.x) * 180 / Math.PI
  }

  _isRotated(dist, dir, dur) {
    //I'm not good at Mathmatics, so cannot make determining rotation with over 2 fingers.
    var ss = Object.keys(this._rec.startPoints)
    var es = Object.keys(this._rec.curPoints)
    if ((ss.length !== es.length) || (ss.length !== 2) ) return false
    if (!ss.every((si)=>{return es.includes(si)})) return false

    var sv = {
      xd:this._rec.startPoints[ss[1]].x - this._rec.startPoints[ss[0]].x,
      yd:this._rec.startPoints[ss[1]].y - this._rec.startPoints[ss[0]].y
    }
    var ev = {
      xd:this._rec.curPoints[ss[1]].x - this._rec.curPoints[ss[0]].x,
      yd:this._rec.curPoints[ss[1]].y - this._rec.curPoints[ss[0]].y
    }
    var cross = sv.xd * ev.yd - sv.yd * ev.xd
    var degree = Math.acos(cross / (Math.sqrt(sv.xd * sv.xd + sv.yd * sv.yd) * Math.sqrt(sv.xd * sv.xd + sv.yd * sv.yd))) * 180 / Math.PI

    if (Math.abs(degree) > this._threshold.rotate_dg) {
      var g = (cross) ? Gesture.GESTURE.ROTATE_CCW : Gesture.GESTURE.ROTATE_CW
      return {
        gesture: g,
        fingers: 2,
        degree: degree,
      }
    }
    return false
  }

  _isMoved(dist, dir, dur) {
    if (dur < this._threshold.moment_ms) return false
    if (dist > this._threshold.move_px) {
      var g = Gesture.GESTURE.UNRECOGNIZED
      if (dir == Gesture.DIRECTION.UP) g = Gesture.GESTURE.MOVE_UP
      if (dir == Gesture.DIRECTION.DOWN) g = Gesture.GESTURE.MOVE_DOWN
      if (dir == Gesture.DIRECTION.LEFT) g = Gesture.GESTURE.MOVE_LEFT
      if (dir == Gesture.DIRECTION.RIGHT) g = Gesture.GESTURE.MOVE_RIGHT
      return {
        gesture: g,
        fingers: this._rec.pressingIndexSet.size,
      }
    }
    return false
  }

  _isPressed(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (this._rec.pressingIndexSet.size == 0) return false
    if (dist > this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) return false
    if (dur < this._threshold.press_ms) return false
    return {
      gesture: Gesture.GESTURE.PRESS,
      fingers: this._rec.fingerIndexSet.size,
    }
  }

  _isPinched(dist, dir, dur) {
    if (this._rec.pressingIndexSet.size < 2) return false
    var threshold = this._threshold.pinch_px * Object.keys(this._rec.startPoints).length
    var g = Gesture.GESTURE.UNRECOGNIZED
    var spoints = Object.values(this._rec.startPoints)
    var epoints = Object.values(this._rec.curPoints)
    var sdSum = 0
    var edSum = 0
    for (var i = 0; i < spoints.length; i++) {
      sdSum += this._getDistance(sp, spoints[i])
      edSum += this._getDistance(ep, epoints[i])
    }
    if (edSum >= sdSum + threshold) {
      g = Gesture.GESTURE.PINCH_OUT
    } else if (edSum < sdSum - threshold) {
      g = Gesture.GESTURE.PINCH_IN
    } else {
      return false
    }
    return {
      gesture: g,
      fingers: this._rec.pressingIndexSet.size,
      pinchSum: edSum - sdSum,
    }
  }

  _isSwiped(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (this._rec.pressingIndexSet.size !== 0) return false
    if (dist < this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) {
      var g = Gesture.GESTURE.UNRECOGNIZED
      if (dir == Gesture.DIRECTION.UP) g = Gesture.GESTURE.SWIPE_UP
      if (dir == Gesture.DIRECTION.DOWN) g = Gesture.GESTURE.SWIPE_DOWN
      if (dir == Gesture.DIRECTION.LEFT) g = Gesture.GESTURE.SWIPE_LEFT
      if (dir == Gesture.DIRECTION.RIGHT) g = Gesture.GESTURE.SWIPE_RIGHT
      return {
        gesture: g,
        fingers: this._rec.fingerIndexSet.size,
      }
    }
    return false
  }

  _isTapped(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (this._rec.pressingIndexSet.size !== 0) return false
    if (dist > this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) {
      var g = Gesture.GESTURE.TAP
      return {
        gesture: g,
        fingers: this._rec.fingerIndexSet.size,
      }
    }
    return false
  }
}

class GestureCommander {
  constructor (callbacks) {
    this._callbacks = callbacks
  }

  sendNotification(noti, payload) {
    log("Notification firing:", noti)
    this._callbacks.sendNotification(noti, payload)
  }

  shellExec(scr) {
    log("Shell command executing:", scr)
    this._callbacks.shellExec(scr)
  }

  getModule(mName = null) {
    var modules = this.getModules()
    if (mName == null) mName = "MMM-Touch"
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].name == mName) return modules[i]
    }
  }

  getModules() {
    return this._callbacks.getModules()
  }

  getMode() {
    return this._callbacks.getMode()
  }

  setMode(mode = null) {
    return this._callbacks.setMode(mode)
  }

  forceCommand(mode, gestureObject) {
    return this._callbacks.forceCommand(mode, gestureObject)
  }
}
