const exec = require('child_process').exec

const NodeHelper = require("node_helper")
module.exports = NodeHelper.create({
  socketNotificationReceived: function(noti, payload) {
    if (noti == "SHELL_EXEC") {
      console.log("[TOUCH] shellExec trying:", payload)
      exec(payload, (error, stdout, stderr)=>{
        if (error) {
          console.log("[TOUCH] shellExec error:\n ------ \n", error, "\n ----- \n")
        }
        if (stderr) console.log("[TOUCH] shellExec stdErr:\n ------ \n", stderr, "\n ----- \n")
        console.log("[TOUCH] shellExec stdOut:\n ------ \n", stdout, "\n ----- \n")
      })
    }
  },
})
