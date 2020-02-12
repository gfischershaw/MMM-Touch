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
    gestureCommands: {
      "default": {
        "TAP_1": (commander) => {
          commander.sendNotification("SHOW_ALERT", {
            title: "TOUCH Test.",
            timer: 3000,
          })
        },
        "PRESS_1": (commander) => {
          commander.getModules().forEach((m)=>{m.hide()})
          commander.setMode("hidden")
        }
      },
      "hidden": {
        "PRESS_1": (commander) => {
          commander.getModules().forEach((m)=>{m.show()})
          commander.setMode("default")
        }
      }
    },
    onNotification: null
  },

  start: function() {
    this.gesture = null
    this.curCommand = null
    this.useDisplay = this.config.useDisplay
    this.tempTimer = null
    this.onNotification = (typeof this.config.onNotification == "function") ? this.config.onNotification : ()=>{}
    if (this.config.debug) {
      log = _log
    }
    this.mode = this.config.defaultMode
    this.commands = {}
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
    dom.appendChild(mode)
    dom.appendChild(command)
    var test = document.createElement("div")
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
    this.updateMode(this.mode)
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
      if (payload) {
        this.setMode(payload)
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
      .on(Gesture.EVENT.CANCELED, ()=>{
        log("Canceled.")
      })
      .on(Gesture.EVENT.RECOGNIZED, (res)=>{
        log("Recognized:", res)
        this.touchEnded()
        this.doCommand(res)

      })
      .on(Gesture.EVENT.UNRECOGNIZED, ()=>{
        log("Unecognized")
        this.touchEnded()
      })
      .on(Gesture.EVENT.FIRSTTOUCH, ()=>{
        this.touchStarted()
      })
      .on(Gesture.EVENT.YIELD, ()=>{})
  },


  touchStarted: function() {
    var dom = document.getElementById("TOUCH")
    dom.classList.add("activated")
    var command = document.querySelector("#TOUCH .command")
    command.innerHTML = ""
    command.classList.remove("fired")
  },

  touchEnded: function() {
    var dom = document.getElementById("TOUCH")
    dom.classList.remove("activated")

  },

  updateMode: function(mode) {
    var dom = document.getElementById("TOUCH")
    dom.innerHTML = mode
  },

  fireCommand: function(c) {
    var command = document.querySelector("#TOUCH .command")
    command.innerHTML = c
    command.classList.add("fired")
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
      log("Command executed:", mode, command)
      this.fireCommand(command)
    }
  }
})

class Gesture {
  static get EVENT() {
    return {
      "RECOGNIZED": "RECOGNIZED",
      "UNRECOGNIZED": "UNRECOGNIZED",
      "CANCELED": "CANCELED",
      "STARTED": "STARTED",
      "FIRSTTOUCH": "FIRSTTOUCH",
      "YIELD": "YIELD"
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
    this._dom = document
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
    this._dom.addEventListener("touchstart", handlerTouch, true)
    this._dom.addEventListener("touchend", handlerRelease, true)
    this._dom.addEventListener("touchmove", handlerMove, true)
    this._dom.addEventListener("touchcancel", handlerCancel, true)
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
    //log("EventEmit:", eventName)
    this._getEventListByName(eventName).forEach(function(fn){
      fn.apply(this,args)
    }.bind(this))
  }

  removeListener(eventName, fn){
    this._getEventListByName(eventName).delete(fn);
  }

/** Gesture Handler part **/

  cancel() {
    this.emit(Gesture.EVENT.CANCELED, null)
    this._init()
  }

  ready() {
    this._init()
  }

  _init() {
    log("New Gesture")
    this._rec = {
      startFromTouch: false,
      allFingerReleased: false,
      touching:0,
      firstTime: null,
      lastTime: null,
      startTouches: {},
      lastTouches: {},
    }
    this.emit(Gesture.EVENT.STARTED)
  }

  _handlerCancel(evt) {
    this.cancel()
  }

  _handlerTouch(type, evt) {
    // check target has onclick
    var cancelBubbling = false
    var i = 0
    if (evt.target.onclick !== null && evt.target !== this._dom) {
      cancelBubbling = true
    }
    while (i < evt.path.length && cancelBubbling !== true) {
      if (evt.path[i].onclick !== null) {
        cancelBubbling = true
      }
      i++
    }
    if (cancelBubbling) {
      this.emit(Gesture.EVENT.YIELD)
      this.cancel()
    }


    var r = this._rec
    var touches = evt.touches
    r.touching = touches.length
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      r.lastTouches[id] = {
        identifier: t.identifier,
        x: t.pageX,
        y: t.pageY,
      }
      if (Object.keys(r.startTouches).length == 0) {
        // first touch
        r.firstTime = evt.timeStamp
        this.emit(Gesture.EVENT.FIRSTTOUCH)
        if (type == "touch") r.startFromTouch = true
        r.target = evt.target
        r.path = evt.path
      }
      if (!r.startTouches.hasOwnProperty(id)) {
        // new touch
        r.startTouches[id] = Object.assign({}, r.lastTouches[id])
      }
    }
    this._recognize()
  }

  _handlerRelease(evt) {
    var r = this._rec
    r.touching = evt.touches.length
    var touches = evt.changedTouches
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      r.lastTouches[id] = {
        x: t.pageX,
        y: t.pageY,
        identifier: t.identifier
      }
    }
    if (r.touching == 0) {
      // all finger released0
      r.lastTime = evt.timeStamp
      r.allFingerReleased = true
      this._recognize()
    }
  }

  _recognize() {
    var r = this._rec
    var sc = this._getCentroid(r.startTouches)
    var ec = this._getCentroid(r.lastTouches)
    var dist = this._getDistance(sc, ec)
    var dir = this._getDirection(sc, ec)
    var dur = this._getDuration()
    if (!sc || !ec) return false
    var result = null

    if (result = this._isTapped(dist, dir, dur)) {}
    else if (result = this._isSwiped(dist, dir, dur)) {}
    else if (sc.count !== ec.count) { return false }
    else if (result = this._isRotated(dist, dir, dur)) {}
    else if (result = this._isPinched(sc, ec, dist, dir, dur)) {}
    else if (result = this._isMoved(dist, dir, dur)) {}
    else if (result = this._isPressed(dist, dir, dur)) {}
    else {
      // nothing happened. but should check current pressing is zero
      if (r.touching == 0) {
        this.emit(Gesture.EVENT.UNRECOGNIZED, null)
        this._init()
      }
      return false
    }
    var temp = {
      distance: dist,
      direction: dir,
      duration: dur,
      target: r.target,
      path: r.path
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
    //If who can make this better, feel free to make PR.
    if (dur < this._threshold.moment_ms) return false
    var ss = Object.keys(this._rec.startTouches)
    var es = Object.keys(this._rec.lastTouches)
    if ((ss.length !== es.length) || (ss.length !== 2) ) return false
    if (!ss.every((si)=>{return es.includes(si)})) return false
    var sv = {
      xd:this._rec.startTouches[ss[0]].x - this._rec.startTouches[ss[1]].x,
      yd:this._rec.startTouches[ss[0]].y - this._rec.startTouches[ss[1]].y
    }
    var ev = {
      xd:this._rec.lastTouches[ss[0]].x - this._rec.lastTouches[ss[1]].x,
      yd:this._rec.lastTouches[ss[0]].y - this._rec.lastTouches[ss[1]].y
    }
    var cross = sv.xd * ev.yd + sv.yd * ev.xd
    if (cross == 0) return false
    var dg = Math.atan2(sv.yd, sv.xd) - Math.atan2(ev.yd, ev.xd)
    var degree = dg * 180 / Math.PI
    if (Math.abs(degree) > this._threshold.rotate_dg) {
      var g = (degree > 0) ? Gesture.GESTURE.ROTATE_CCW : Gesture.GESTURE.ROTATE_CW
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
        fingers: Object.keys(this._rec.startTouches).length,
      }
    }
    return false
  }

  _isPressed(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (this._rec.allFingerReleased) return false
    if (dist > this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) return false
    if (dur < this._threshold.press_ms) return false
    return {
      gesture: Gesture.GESTURE.PRESS,
      fingers: Object.keys(this._rec.startTouches).length,
    }
  }

  _isPinched(sp, ep, dist, dir, dur) {
    if (this._rec.touching < 2) return false
    var threshold = this._threshold.pinch_px * Object.keys(this._rec.startTouches).length
    var g = Gesture.GESTURE.UNRECOGNIZED
    var spoints = Object.values(this._rec.startTouches)
    var epoints = Object.values(this._rec.lastTouches)
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
      fingers: Object.keys(this._rec.startTouches).length,
      pinchSum: edSum - sdSum,
    }
  }

  _isSwiped(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (!this._rec.allFingerReleased) return false
    if (dist < this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) {
      var g = Gesture.GESTURE.UNRECOGNIZED
      if (dir == Gesture.DIRECTION.UP) g = Gesture.GESTURE.SWIPE_UP
      if (dir == Gesture.DIRECTION.DOWN) g = Gesture.GESTURE.SWIPE_DOWN
      if (dir == Gesture.DIRECTION.LEFT) g = Gesture.GESTURE.SWIPE_LEFT
      if (dir == Gesture.DIRECTION.RIGHT) g = Gesture.GESTURE.SWIPE_RIGHT
      return {
        gesture: g,
        fingers: Object.keys(this._rec.startTouches).length,
      }
    }
    return false
  }

  _isTapped(dist, dir, dur) {
    if (!this._rec.startFromTouch) return false
    if (!this._rec.allFingerReleased) return false
    if (dist > this._threshold.move_px) return false
    if (dur < this._threshold.moment_ms) {
      var g = Gesture.GESTURE.TAP
      return {
        gesture: g,
        fingers: Object.keys(this._rec.startTouches).length,
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
