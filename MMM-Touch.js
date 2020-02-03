var _log = function() {
  var context = "[TOUCH]";
  return Function.prototype.bind.call(console.log, console, context);
}()

var log = function() {
  //do nothing
}

Module.register("MMM-Touch", {
  defaults: {
    debug: true,
    gestureConfig: {
      pinchThreshold: 100,
      timeoutThreshold: 1000 * 5,
      moveThreshold: 100,
      fingerThreshold: 5,
      pressThreshold: 1000 * 3,
      restartThreshold: 1000 * 0.3,
    },
    triggers: [],
  },

  start: function() {
    this.gesture = null
    if (this.config.debug) {
      log = _log
    }
  },

  getStyles: function() {
    return ["MMM-Touch.css"]
  },

  getDom: function() {
    var dom = document.createElement("div")
    dom.id = "TOUCH"
    var t1 = document.createElement("div")
    t1.className = "region_1"
    dom.appendChild(t1)
    var t2 = document.createElement("div")
    t2.className = "region_2"
    dom.appendChild(t2)
    return dom
  },

  notificationReceived: function (noti, payload, sender) {
    if (noti == "DOM_OBJECTS_CREATED") {
      if (this.gesture) {
        log("Already gesture engine is started.")
      } else {
        this.defineTouch()

      }

      //this.registerTriggers()
    }

    if (noti == "TOUCH_CANCEL") {
      this.gesture.cancel()
    }
  },

  defineTouch: function() {
    this.gesture = new Gesture(this.config.gestureConfig)
    var listener = this.gesture.getListener()
    listener
      .on("canceled", (res)=>{
        log("Canceled.")
      })
      .on("firsttouch", (res)=>{
        log("First Touch started.")
      })
      .on("lastrelease", (res)=>{
        log("Last Touch released.")
      })
      .on("recognized", (res)=>{
        log("Recognized:", res.command, res)
        this.gesture.start()
      })
      .on("unrecognized", (res)=>{
        log("Unecognized")
        this.gesture.start()
      })
  }
})

// touch1~5
// move1~5


class Gesture {
  constructor(config) {
    this._status = {
      "READY" : 0,
      "STARTED" : 1,
      "ENDED" : 2,
      "RECOGNIZED": 3,
    }
    this._config = config
    this._dom = document.body
    var handlerTouch = (evt) => {
      this._handlerTouch(evt)
    }
    var handlerRelease = (evt) => {
      this._handlerRelease(evt)
    }
    var handlerCancel = (evt) => {
      this._handlerCancel(evt)
    }
    this._dom.addEventListener("touchstart", handlerTouch)
    this._dom.addEventListener("touchend", handlerRelease)
    this._dom.addEventListener("touchmove", handlerTouch)
    this._dom.addEventListener("touchcancel", handlerCancel)
    this._listener = new TouchEventEmitter()
    this.start()
  }

  getListener() {
    return this._listener
  }

  cancel() {
    this._canceld = true
    this._process()
  }

  start() {
    setTimeout(()=>{
      this._init()
    }, this._config.restartThreshold)
  }


  _init() {
    this._gesture = {
      status: 0,
      count: 0,
      startTime: 0,
      endTime: 0,
      touches: {},
      startWeight: {
        x:0,
        y:0,
      },
      endWeight: {
        x:0,
        y:0,
      },
    }
    this._canceled = false
    this._timeout = null

  }

  _handlerTouch(evt) {
    if (this._canceled) this._process()
    if (this._gesture.status >= this._status.ENDED) return
    if (this._gesture.status == this._status.READY) {
      this._gesture.status = this._status.STARTED
      this._gesture.startTime = evt.timeStamp
      this._listener.emit("firsttouch")
      this._timeout = setTimeout(()=>{
        this.cancel()
      }, this._config.timeoutThreshold)
    }
    var touches = evt.changedTouches
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      if (this._gesture.touches.hasOwnProperty(id)) {
        // existed finger
      } else {
        // new finger
        this._gesture.touches[id] = []
        this._gesture.startWeight.x += t.pageX
        this._gesture.startWeight.y += t.pageY
        this._gesture.count++
      }
      this._gesture.touches[id].push({
        x: t.pageX,
        y: t.pageY,
        timeStamp: evt.timeStamp
      })
    }
  }

  _handlerRelease(evt) {
    if (this._canceled) this._process()
    if (this._gesture.status >= this._status.ENDED) return
    var touches = evt.changedTouches
    var error = false
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i]
      var id = t.identifier
      if (this._gesture.touches.hasOwnProperty(id)) {
        // existed finger
        this._gesture.touches[id].push({
          x: t.pageX,
          y: t.pageY,
          timeStamp: evt.timeStamp
        })
        this._gesture.endWeight.x += t.pageX
        this._gesture.endWeight.y += t.pageY
        this._gesture.count--
      } else {
        // new finger
        error = true
      }
    }
    if (error) {
      this.cancel()
      return
    }
    if (this._gesture.count == 0 ) {
      this._gesture.status = this._status.ENDED
      this._gesture.endTime = evt.timeStamp
      this._listener.emit("lastrelease")
      this._process()
    } else {
      this.cancel()
    }
  }


  _handlerCancel(evt) {
    this.cancel()
  }


  _process() {
    clearTimeout(this._timeout)
    this._timeout = null
    if (this._canceled) {
      this._listener.emit("canceled")
      this.start()
      return
    }
    var result = null
    result = this._recognize(this._gesture)

    if (result) {
      this._listener.emit("recognized", result)
    } else {
      this._listener.emit("unrecognized", result)
    }
  }

  _recognize(gesture = this._gesture) {
    var getDistance = (startPos, pointPos)=>{
      var x = startPos.x - pointPos.x
      var y = startPos.y - pointPos.y
      return Math.hypot(x, y)
    }
    var getDirection = (start, end) => {
      if (getDistance(start, end) < this._config.moveThreshold) {
        return 0
      }
      var moveX = (end.x - start.x)
      var moveY = (end.y - start.y)
      if (Math.abs(moveX) >= Math.abs(moveY)) {
        if (moveX >= 0) {
          return 2 // right
        } else {
          return 4 // left
        }
      } else {
        if (moveY >= 0) {
          return 3 // down
        } else {
          return 1 // up
        }
      }
    }
    var pinch = 0
    var fingers = Object.keys(gesture.touches).length
    if (!fingers) return false
    var duration = gesture.endTime - gesture.startTime
    var startGesture = {
      x: gesture.startWeight.x / fingers,
      y: gesture.startWeight.y / fingers,
    }
    var endGesture = {
      x: gesture.endWeight.x / fingers,
      y: gesture.endWeight.y / fingers,
    }
    var dStart = 0
    var dEnd = 0
    var path = []
    for (var i in gesture.touches) {
      if (gesture.touches.hasOwnProperty(i)) {
        var t = gesture.touches[i]
        if (t.length >= 2) {
          var start = t[0]
          var end = t[t.length - 1]
          var tx = getDistance(startGesture, start)
          dStart += (getDistance(startGesture, start) / fingers)
          dEnd += (getDistance(endGesture, end) / fingers)
        } else {
          return false
        }
      }
    }
    if (dEnd - dStart > this._config.pinchThreshold) pinch = 1 // pinchout
    if (dStart - dEnd > this._config.pinchThreshold) pinch = 2 // pinchin
    var distance = dEnd - dStart
    var direction = getDirection(startGesture, endGesture)
    var move = getDistance(gesture.startWeight, gesture.endWeight)

    var command = ""
    if (pinch == 1) {
      command += "PinchOut"
    } else if (pinch == 2) {
      command += "PinchIn"
    } else {
      const c = ["Tap", "Up", "Right", "Down", "Left"]
      command += c[direction]
    }
    command += fingers
    var result = {
      command: command,
      fingers: fingers,
      duration: duration,
      direction: direction,
      pinch: pinch,
      distance: distance,
      move: move,
      touches: gesture.touches,
    }
    return result
  }
}

class TouchEventEmitter {
  constructor(){
    this.events = {}
  }
  _getEventListByName(eventName){
    if(typeof this.events[eventName] === 'undefined'){
      this.events[eventName] = new Set()
    }
    return this.events[eventName]
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
    this._getEventListByName(eventName).forEach(function(fn){
      fn.apply(this,args)
    }.bind(this))
  }

  removeListener(eventName, fn){
    this._getEventListByName(eventName).delete(fn);
  }
}
